
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

const REPLIT_BACKEND = 'https://cbc1561b-2d4f-411e-98f5-2b46e017850a-00-3brgcq7ngokp0.picard.replit.dev/api';

export const API_BASE_URL = SUPABASE_FUNCTIONS_URL || REPLIT_BACKEND;

console.log('API Configuration:', {
  hostname: window.location.hostname,
  environment: isNetlify ? 'Netlify' : isLocalDev ? 'Local' : 'Production',
  API_BASE_URL,
  usingSupabaseFunctions: !!SUPABASE_FUNCTIONS_URL,
  usingReplitBackend: !SUPABASE_FUNCTIONS_URL
});

export const createApiUrl = (path: string) => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  if (API_BASE_URL.endsWith('/functions/v1')) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  
  return `${API_BASE_URL}/api/${cleanPath}`;
};