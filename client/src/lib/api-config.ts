// Configuração da API
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Para Netlify, usar as funções do Supabase diretamente
// Para desenvolvimento local, usar API local
export const API_BASE_URL = isNetlify ? '' : '/api';

console.log('API Configuration:', {
  hostname: window.location.hostname,
  environment: isNetlify ? 'Netlify (Supabase)' : isLocalDev ? 'Local' : 'Unknown',
  API_BASE_URL,
  usingSupabase: isNetlify
});

export const createApiUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Se API_BASE_URL está vazio (Netlify), usar apenas o path
  if (!API_BASE_URL) {
    return `/${cleanPath}`;
  }
  
  return `${API_BASE_URL}/${cleanPath}`;
};