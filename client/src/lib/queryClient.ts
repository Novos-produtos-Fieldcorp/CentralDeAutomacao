import { QueryClient } from '@tanstack/react-query';
import { createApiUrl } from './api-config';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Default fetcher function for queries
export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const companyId = localStorage.getItem('company_id') || '1';
  
  // Usar URL dinâmica baseada no ambiente
  const apiUrl = url.startsWith('/') ? createApiUrl(url.slice(1)) : createApiUrl(url);
  console.log('API Request to:', apiUrl);
  
  const response = await fetch(apiUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'company-id': companyId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};