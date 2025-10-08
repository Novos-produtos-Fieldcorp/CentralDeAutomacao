import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Detectar ambiente
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuração híbrida: usar API local em desenvolvimento, Supabase Functions em produção
export const API_BASE_URL = isNetlify ? `${supabaseUrl}/functions/v1` : '/api';

console.log('Hybrid API Configuration:', {
  hostname: window.location.hostname,
  environment: isNetlify ? 'Netlify (Supabase Functions)' : isLocalDev ? 'Local (Express API)' : 'Unknown',
  apiBaseUrl: API_BASE_URL,
  supabaseUrl,
  hasAnonKey: !!supabaseAnonKey
});

export const createApiUrl = (path: string) => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Em desenvolvimento local
  if (isLocalDev) {
    // Se já tem prefixo wiseapp/, usar diretamente
    if (cleanPath.startsWith('wiseapp/')) {
      return `${API_BASE_URL}/${cleanPath}`;
    }
    // Para rotas de sincronização sem prefixo, adicionar wiseapp/
    if (cleanPath.includes('sync-') || cleanPath.includes('bulk-sync-')) {
      return `${API_BASE_URL}/wiseapp/${cleanPath}`;
    }
    // Para outras rotas WiseApp, adicionar prefixo 'wiseapp'
    return `${API_BASE_URL}/wiseapp/${cleanPath}`;
  }
  
  // Em produção (Netlify), remover prefixo wiseapp/ e usar Supabase Functions
  if (isNetlify) {
    const finalPath = cleanPath.startsWith('wiseapp/') ? cleanPath.replace('wiseapp/', '') : cleanPath;
    return `${API_BASE_URL}/${finalPath}`;
  }
  
  // Fallback
  return `${API_BASE_URL}/${cleanPath}`;
};

export const supabaseApiRequest = async (url: string, options: RequestInit = {}) => {
  const companyId = localStorage.getItem('company_id') || '1';
  
  const { data: { session } } = await supabase.auth.getSession();
  
  const apiUrl = url.startsWith('/') ? createApiUrl(url.slice(1)) : createApiUrl(url);
  
  const response = await fetch(apiUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'company-id': companyId,
      ...(session?.access_token && {
        'Authorization': `Bearer ${session.access_token}`
      }),
      ...options.headers,
    },
  });

  return response;
};
