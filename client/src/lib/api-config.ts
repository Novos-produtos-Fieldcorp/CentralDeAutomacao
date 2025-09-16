// Configuração da API
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Backend do Replit (fallback)
const REPLIT_BACKEND = 'https://e61f9f22-50c3-4e0f-9fb2-cca97e9cec43-00-3amgtfagebvlo.janeway.replit.dev/api';

// Usar funções do Netlify quando disponível, senão usar backend Replit
export const API_BASE_URL = isNetlify ? '/api' : '/api';

console.log('API Configuration:', {
  hostname: window.location.hostname,
  environment: isNetlify ? 'Netlify' : isReplit ? 'Replit' : isLocalDev ? 'Local' : 'Unknown',
  API_BASE_URL,
  usingReplitBackend: isNetlify
});

export const createApiUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};