// Configuração da API - sempre usar rotas diretas do Express
export const API_BASE_URL = '/api';

console.log('API Configuration:', {
  hostname: window.location.hostname,
  API_BASE_URL
});

export const createApiUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};