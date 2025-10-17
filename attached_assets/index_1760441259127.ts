import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes.js";
import { corsMiddleware } from "./middleware/cors.js";

// Declaração para process global do Node.js
declare const process: {
  env: {
    NODE_ENV?: string;
    PORT?: string;
    DATABASE_URL?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    VITE_CHAT_API_URL?: string;
    VITE_CHAT_ACCOUNT_ID?: string;
  };
};

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS middleware
app.use(corsMiddleware);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0'
  });
});

// Register API routes
app.use('/api', registerRoutes);

// Global error handler
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
  
  res.status(status).json(errorResponse);
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: true,
    status: 404,
    message: `Endpoint não encontrado: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      'GET /health',
      'GET /api/companies',
      'GET /api/motoristas',
      'GET /api/veiculos',
      'GET /api/clientes',
      'GET /api/wiseapp/:companyId/labels',
      'POST /api/wiseapp/:companyId/contacts/:contactId/labels'
    ]
  });
});

// Start server
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

app.listen(port, host, () => {
  console.log('🚀 Backend API iniciado com sucesso!');
  console.log(`📡 Servidor rodando em http://${host}:${port}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://${host}:${port}/health`);
  console.log(`🔗 API base: http://${host}:${port}/api`);
});

export default app;
