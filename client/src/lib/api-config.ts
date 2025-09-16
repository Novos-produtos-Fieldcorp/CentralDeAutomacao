// Configuração da API
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Backend do Replit (fallback)
const REPLIT_BACKEND = 'https://7eb06766-a8ee-472f-9def-f1ec9df80316-00-19aitpsg3ksn5.spock.replit.dev/api';

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