// Configuração da API
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Backend do Replit (fallback)
const REPLIT_BACKEND = 'https://1e1a5ee6-9748-4d09-b3ab-4870aa096db9-00-1wwkj8tjwx7bv.kirk.replit.dev/api';

// Usar backend do Replit no Netlify, senão usar API local
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