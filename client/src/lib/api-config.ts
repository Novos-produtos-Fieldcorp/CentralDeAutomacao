// Detectar ambiente
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Configuração da API baseada no ambiente
export const API_BASE_URL = (isLocalDev || isReplit || isNetlify) 
  ? '/api'  // URLs relativas para todos os ambientes com serverless functions
  : '/api'; // Fallback para relativo

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