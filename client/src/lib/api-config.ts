// Configuração da API
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Backend do Replit (fallback)
const REPLIT_BACKEND = 'https://cbc1561b-2d4f-411e-98f5-2b46e017850a-00-3brgcq7ngokp0.picard.replit.dev/api';

// Usar backend do Replit no Netlify.
// Quando em desenvolvimento e o hostname for 0.0.0.0 (ex: binding do vite), mapear para localhost:5000
let apiBase = '/api';
if (isNetlify) apiBase = REPLIT_BACKEND;
else if (window.location.hostname === '0.0.0.0') apiBase = 'http://localhost:5000/api';

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