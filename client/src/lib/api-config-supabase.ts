import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Detectar ambiente
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

// Usar Supabase Functions em produção
const forceExpressBackend = false;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuração híbrida: usar API local em desenvolvimento, Supabase Functions em produção
// Em Netlify a Edge Function é "api", então a URL correta é .../functions/v1/api (evita /v1/v1/ na path)
export const API_BASE_URL = forceExpressBackend ? '/api' : (isNetlify ? `${supabaseUrl}/functions/v1/api` : '/api');

console.log('Hybrid API Configuration:', {
  hostname: window.location.hostname,
  environment: forceExpressBackend ? 'Express Backend' : (isNetlify ? 'Netlify (Supabase Functions)' : isLocalDev ? 'Local (Express API)' : 'Unknown'),
  apiBaseUrl: API_BASE_URL,
  supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  forceExpressBackend
});

export const createApiUrl = (path: string) => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Usar backend Express quando necessário
  if (forceExpressBackend) {
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
  
  // Em desenvolvimento local
  if (isLocalDev) {
    // Se já tem prefixo wiseapp/, usar diretamente
    if (cleanPath.startsWith('wiseapp/')) {
      return `${API_BASE_URL}/${cleanPath}`;
    }

    if (cleanPath.startsWith('comentarios/')) {
      return `${API_BASE_URL}/${cleanPath}`;
    }
    // Para rotas de sincronização sem prefixo, adicionar wiseapp/
    if (cleanPath.includes('sync-') || cleanPath.includes('bulk-sync-')) {
      return `${API_BASE_URL}/wiseapp/${cleanPath}`;
    }
    // Para outras rotas WiseApp, adicionar prefixo 'wiseapp'
    return `${API_BASE_URL}/wiseapp/${cleanPath}`;
  }
  
  // Em produção (Netlify), usar Supabase Functions
  // API_BASE_URL já termina em /api, então NÃO adicionar /api novamente
  if (isNetlify) {
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

// Helper para criar headers de autenticação para Edge Functions do Supabase
export const getSupabaseEdgeFunctionHeaders = (additionalHeaders: Record<string, string> = {}) => {
  // A anon key do Supabase é pública e deve ser enviada nas requisições às Edge Functions
  return {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    // O gateway das Edge Functions exige o header Authorization (Bearer) — sem ele retorna 401
    'Authorization': `Bearer ${supabaseAnonKey}`,
    ...additionalHeaders
  };
};
