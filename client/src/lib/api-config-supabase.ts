import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlify = window.location.hostname.includes('netlify.app');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const API_BASE_URL = isLocalDev ? '/api' : `${supabaseUrl}/functions/v1`;

console.log('🔧 API Configuration (Supabase Only):', {
  hostname: window.location.hostname,
  environment: isLocalDev ? 'Local Development (Express Proxy)' : 'Production (Supabase Edge Functions)',
  apiBaseUrl: API_BASE_URL,
  supabaseUrl,
  hasAnonKey: !!supabaseAnonKey
});

export const createApiUrl = (path: string) => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  if (isLocalDev) {
    if (cleanPath.startsWith('wiseapp/')) {
      return `${API_BASE_URL}/${cleanPath}`;
    }
    if (cleanPath.includes('sync-') || cleanPath.includes('bulk-sync-')) {
      return `${API_BASE_URL}/wiseapp/${cleanPath}`;
    }
    return `${API_BASE_URL}/wiseapp/${cleanPath}`;
  }
  
  if (cleanPath.startsWith('wiseapp/')) {
    return `${API_BASE_URL}/api/${cleanPath}`;
  }
  if (cleanPath.includes('sync-') || cleanPath.includes('bulk-sync-')) {
    return `${API_BASE_URL}/api/wiseapp/${cleanPath}`;
  }
  return `${API_BASE_URL}/api/${cleanPath}`;
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
