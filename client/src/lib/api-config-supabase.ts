import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const API_BASE_URL = `${supabaseUrl}/functions/v1`;

console.log('Supabase API Configuration:', {
  supabaseUrl,
  apiBaseUrl: API_BASE_URL,
  hasAnonKey: !!supabaseAnonKey
});

export const createApiUrl = (path: string) => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
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
