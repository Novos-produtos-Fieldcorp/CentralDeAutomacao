// Configuração da API - SOLUÇÃO TEMPORÁRIA: usar servidor Replit funcionando
const REPLIT_SERVER_URL = 'https://7eb06766-a8ee-472f-9def-f1ec9df80316-00-19aitpsg3ksn5.spock.replit.dev';

// Detectar ambiente
const isReplit = window.location.hostname.includes('replit.dev');
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// FORÇAR uso do servidor Replit para todas as chamadas de API até resolver Netlify
export const API_BASE_URL = isNetlify 
  ? `${REPLIT_SERVER_URL}/api`  // Netlify → usar Replit server
  : '/api';  // Local/Replit → URLs relativas

console.log('API Configuration:', {
  hostname: window.location.hostname,
  isReplit,
  isLocalDev,
  isNetlify,
  API_BASE_URL
});

export const createApiUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};