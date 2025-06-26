export async function fetchWithRetry<T = any>(
  url: string,
  options: RequestInit,
  retries = 5,
  delay = 1000
): Promise<T> {
  try {
    // Check for network connectivity first
    if (!navigator.onLine) {
      throw new Error('Sem conexão de rede disponível');
    }

    // Validate URL before attempting fetch
    if (!url || !url.startsWith('http') && !url.startsWith('/')) {
      throw new Error('URL da API inválida');
    }

    console.log(`Fetching URL: ${url}`);
    console.log('Request options:', JSON.stringify({
      method: options.method,
      headers: options.headers,
      body: options.body ? '(body present)' : '(no body)'
    }, null, 2));

    // Make the request
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed: ${response.status} - ${errorText}`);
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Falha na autenticação. Verifique seu token de API.');
      }
      
      throw new Error(`Falha na requisição da API: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    
    // Handle connection refused errors specifically
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      // This is likely a CORS or network connectivity issue
      console.error('Network error: Failed to fetch. Possible CORS or connectivity issue.');
      
      // Check if the error is specifically for the Supabase connection
      if (url.includes('supabase.co') || url.includes('supabase-edge-functions')) {
        throw new Error('A conexão com o banco de dados foi recusada. Verifique sua conexão com a internet ou se o serviço está disponível.');
      } else {
        throw new Error('Erro de rede: Falha ao buscar. Possível problema de CORS ou conectividade.');
      }
    }
    
    // For other network errors that might be related to connection refused
    if (error.message && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('connection refused') ||
        error.message.includes('network error') ||
        error.message.includes('supabase.co')
    )) {
      throw new Error('A conexão com o banco de dados foi recusada. Verifique sua conexão com a internet ou se o serviço está disponível.');
    }
    
    if (retries > 0) {
      console.log(`Retrying... (${5 - retries + 1}/${5})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

// Function to proxy requests through our Supabase Edge Function
export async function proxyRequest<T = any>(
  endpoint: string,
  method: string = 'GET',
  params: Record<string, string> = {},
  body?: any,
  apiKey?: string,
  accountId?: string
): Promise<T> {
  // Get API key from localStorage if not provided
  const token = apiKey || localStorage.getItem('wiseapp_token');
  const account = accountId || localStorage.getItem('account_id');
  
  if (!token) {
    throw new Error('Token WiseApp não encontrado. Configure seu token primeiro.');
  }
  
  if (!account) {
    throw new Error('ID da conta é obrigatório. Verifique os parâmetros da URL.');
  }
  
  // Build URL for the proxy function - use proxy in development
  let proxyUrl: string;
  if (import.meta.env.DEV) {
    // In development, use the Vite proxy
    proxyUrl = `/supabase-edge-functions/proxy-wiseapp?endpoint=${encodeURIComponent(endpoint)}&account_id=${account}&api_key=${token}`;
  } else {
    // In production, use the direct Supabase URL
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    proxyUrl = `${baseUrl}/functions/v1/proxy-wiseapp?endpoint=${encodeURIComponent(endpoint)}&account_id=${account}&api_key=${token}`;
  }
  
  // Add any additional query parameters
  if (Object.keys(params).length > 0) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, value);
    });
    proxyUrl += `&${queryParams.toString()}`;
  }
  
  // Set up request options
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  // Add body for non-GET requests
  if (method !== 'GET' && method !== 'HEAD' && body) {
    options.body = JSON.stringify(body);
  }
  
  // Make the request with retry logic
  return fetchWithRetry<T>(proxyUrl, options);
}