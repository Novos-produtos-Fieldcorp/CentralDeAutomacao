// Configuração da API - forçar uso do servidor Replit para garantir funcionamento
const REPLIT_SERVER_URL = 'https://b8a2fe25-be22-41f5-b1a6-2cecdb29b3a3-00-fbhfhvazvvim.worf.replit.dev';

// Detectar se está rodando no Replit ou foi deployado
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE_URL = (isLocalDev || isReplit) 
  ? '/api'  // URLs relativas quando no ambiente correto
  : `${REPLIT_SERVER_URL}/api`;  // URLs absolutas quando acessado via outros domínios (ex: Netlify)

console.log('API Configuration:', {
  hostname: window.location.hostname,
  isReplit,
  isLocalDev, 
  API_BASE_URL
});

export const createApiUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};