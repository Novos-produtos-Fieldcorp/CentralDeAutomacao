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
    if (!url || !url.startsWith('http')) {
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
    
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      // This is likely a CORS or network connectivity issue
      console.error('Network error: Failed to fetch. Possible CORS or connectivity issue.');
      throw new Error('Erro de rede: Falha ao buscar. Possível problema de CORS ou conectividade.');
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
  
  // Build URL for the proxy function
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  let proxyUrl = `${baseUrl}/functions/v1/proxy-wiseapp?endpoint=${encodeURIComponent(endpoint)}&account_id=${account}&api_key=${token}`;
  
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