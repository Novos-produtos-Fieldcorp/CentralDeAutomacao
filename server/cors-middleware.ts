import { Request, Response, NextFunction } from 'express';

// Middleware CORS robusto para resolver problemas de cross-origin
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  
  // Lista de origens permitidas
  const allowedOrigins = [
    'https://replit.com',
    'https://centralautomacoes.netlify.app',
    'https://feat-dashboard--centralautomacoes.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://localhost:5000'
  ];
  
  // Verificar se a origem é permitida
  const isAllowedOrigin = (requestOrigin: string | undefined): boolean => {
    if (!requestOrigin) return true; // Permitir requisições sem origin
    
    // Verificar origens específicas
    if (allowedOrigins.includes(requestOrigin)) return true;
    
    // Verificar padrões dinâmicos
    return requestOrigin.includes('replit.dev') || 
           requestOrigin.includes('replit.app') ||
           requestOrigin.includes('netlify.app') ||
           requestOrigin.includes('localhost') ||
           requestOrigin.includes('127.0.0.1');
  };
  
  // Definir Access-Control-Allow-Origin
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  // Headers CORS essenciais
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization', 
    'api_access_token',
    'Cache-Control',
    'Pragma',
    'Expires',
    'wiseapp-token',
    'company-id',
    'wiseapp-account-id',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Referer',
    'User-Agent',
    'Sec-Fetch-Mode',
    'Sec-Fetch-Dest',
    'Sec-Fetch-Site',
    'apikey',
    'x-client-info'
  ].join(', '));
  
  // Permitir credenciais para requisições autenticadas
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h
  
  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  next();
};
