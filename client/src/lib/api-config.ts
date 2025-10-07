// Configuração da API
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Backend do Replit (fallback)
const REPLIT_BACKEND = 'https://cbc1561b-2d4f-411e-98f5-2b46e017850a-00-3brgcq7ngokp0.picard.replit.dev/api';

// Determinar a URL base da API
let apiBase = '/api'; // Usar caminho relativo para o mesmo domínio

// Se estiver rodando localmente (desenvolvimento)
if (isLocalDev || window.location.hostname === '0.0.0.0') {
  apiBase = 'http://localhost:5000/api';
} 
// Se estiver no Netlify, usar o backend do Replit
else if (isNetlify) {
  apiBase = REPLIT_BACKEND;
}

export const API_BASE_URL = apiBase;

console.log('API Configuration:', {
  hostname: window.location.hostname,
  environment: isNetlify ? 'Netlify' : isReplit ? 'Replit' : isLocalDev ? 'Local' : 'Unknown',
  API_BASE_URL,
  usingReplitBackend: isNetlify
});

export const createApiUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // If API_BASE_URL is relative (/api), constructing the relative path keeps origin. If absolute, use it directly.
  return API_BASE_URL.endsWith('/') ? `${API_BASE_URL}${cleanPath}` : `${API_BASE_URL}/${cleanPath}`;
};