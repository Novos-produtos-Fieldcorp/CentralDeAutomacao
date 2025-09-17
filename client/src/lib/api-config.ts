// Configuração da API
// Usar sempre o backend do Replit para evitar problemas com funções Netlify
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Backend do Replit (sempre usar este)
const REPLIT_BACKEND = 'https://da9026f2-e07f-4511-8614-9fa1ec4fc8db-00-11bt9dtr4tpbc.riker.replit.dev/api';

// Fallback temporário: usar backend Replit quando functions do Netlify não funcionam
export const API_BASE_URL = isNetlify ? REPLIT_BACKEND : '/api';

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