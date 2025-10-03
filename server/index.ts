import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { corsMiddleware } from "./cors-middleware";

// Declaração para process global do Node.js
declare const process: {
  env: {
    NODE_ENV?: string;
    PORT?: string;
  };
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Aplicar middleware CORS robusto
app.use(corsMiddleware);

// Configurar headers de segurança otimizados
app.use((req, res, next) => {
  // Headers de segurança otimizados para iframe embedding
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  
  // CSP unificado otimizado para iframe e scripts
  const cspPolicy = [
    "frame-ancestors *",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://replit.com https://*.replit.dev",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "font-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', cspPolicy);
  
  // Headers de segurança adicionais
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
});

// Cache strategy otimizado por tipo de rota
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    if (req.path.includes('/wiseapp/') || req.path.includes('/inboxes')) {
      // APIs dinâmicas - força no-cache agressivo para resolver problemas de cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.setHeader('Vary', '*');
      // Header para forçar revalidação
      res.setHeader('ETag', `"${Date.now()}-${Math.random()}"`);
    } else {
      // APIs mais estáveis - cache curto
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
    }
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log('🚀 Iniciando servidor...');
  console.log('📋 Variáveis de ambiente:');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('  PORT:', process.env.PORT);
  
  const server = await registerRoutes(app);
  console.log('✅ Rotas registradas com sucesso');

  // Sistema de error handling robusto com fallbacks
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    let message = err.message || "Internal Server Error";
    
    // Error sanitization - não expor informações sensíveis em produção
    if (process.env.NODE_ENV === 'production') {
      if (status >= 500) {
        message = "Internal Server Error";
      }
    }
    
    // Estrutura de resposta padronizada para erros
    const errorResponse: any = {
      error: true,
      status,
      message,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    };
    
    // Incluir stack trace apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development' && err.stack) {
      errorResponse.stack = err.stack;
    }
    
    // Log detalhado do erro para debugging
    console.error(`[ERROR] ${req.method} ${req.path} - ${status}:`, {
      message: err.message,
      stack: err.stack,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params
    });
    
    // Fallback específico para APIs WiseApp
    if (req.path.includes('/wiseapp/')) {
      if (status >= 500) {
        errorResponse.fallback = "WiseApp API temporarily unavailable";
        errorResponse.retry = true;
      }
    }
    
    res.status(status).json(errorResponse);
    // Não re-throw o erro para evitar crash do servidor
  });

  // API Route Protection - garantir que rotas /api/* não sejam capturadas pelo SPA
  app.use('/api/*', (req, res, next) => {
    // Se chegou aqui, significa que nenhuma rota da API correspondeu
    res.status(404).json({
      error: true,
      status: 404,
      message: `API endpoint not found: ${req.method} ${req.path}`,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      available_endpoints: [
        'GET /api/wiseapp/:companyId/labels',
        'POST /api/wiseapp/:companyId/labels',
        'DELETE /api/wiseapp/:companyId/labels/:labelId',
        'POST /api/wiseapp/:companyId/contacts/:contactId/labels', 
        'DELETE /api/wiseapp/:companyId/contacts/:contactId/labels/:tagId'
      ]
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes  
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Using port 5000 - configurado para aceitar conexões externas no Replit
  const port = process.env.PORT || 5000;
  const host = '0.0.0.0';
  
  console.log('🌐 Configuração do servidor:');
  console.log('  Porta:', port);
  console.log('  Host:', host);
  console.log('  Ambiente:', process.env.NODE_ENV || 'development');
  
  server.listen({
    port,
    host,
    reusePort: false,
  }, () => {
    console.log('✅ Servidor iniciado com sucesso!');
    log(`serving on ${host}:${port}`);
  });
  
  server.on('error', (err) => {
    console.error('❌ Erro ao iniciar servidor:', err);
  });
})();
