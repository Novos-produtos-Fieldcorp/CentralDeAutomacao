// Configuração da API baseada no ambiente
const isNetlify = window.location.hostname.includes('netlify.app') || window.location.hostname.includes('.netlify.com');
const isProduction = process.env.NODE_ENV === 'production';

export const API_BASE_URL = isNetlify || (isProduction && !window.location.hostname.includes('localhost')) 
  ? '/.netlify/functions/api' 
  : '/api';

console.log('API Configuration:', {
  hostname: window.location.hostname,
  isNetlify,
  isProduction,
  API_BASE_URL
});

export const createApiUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};