// Utilitário para requisições HTTP robustas com retry, fallback e cache
interface RobustFetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  fallbackUrls?: string[];
  cacheKey?: string;
  cacheTtl?: number;
  showProgress?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
  onFallback?: (url: string, error: Error) => void;
}

interface CachedResponse {
  data: any;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CachedResponse>();

// Função para verificar se o cache é válido
function getCachedData(key: string): any | null {
  if (!key) return null;
  
  const cached = cache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  console.log(`[RobustFetch] Using cached data for key: ${key}`);
  return cached.data;
}

// Função para armazenar no cache
function setCachedData(key: string, data: any, ttl: number): void {
  if (!key) return;
  
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
  
  console.log(`[RobustFetch] Cached data for key: ${key}, TTL: ${ttl}ms`);
}

// Função para fazer fetch com timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Função para aguardar com delay exponencial
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função principal robusta para requisições HTTP
export async function robustFetch(
  url: string,
  options: RobustFetchOptions = {}
): Promise<any> {
  const {
    timeout = 10000,
    retries = 3,
    retryDelay = 1000,
    fallbackUrls = [],
    cacheKey,
    cacheTtl = 5 * 60 * 1000, // 5 minutos por padrão
    showProgress = false,
    onRetry,
    onFallback,
    ...fetchOptions
  } = options;

  // Verificar cache primeiro
  if (cacheKey) {
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  const urls = [url, ...fallbackUrls];
  const errors: Error[] = [];
  
  for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
    const currentUrl = urls[urlIndex];
    
    // Se está usando URL de fallback, notificar
    if (urlIndex > 0 && onFallback) {
      onFallback(currentUrl, errors[errors.length - 1]);
    }
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (showProgress && attempt > 0) {
          console.log(`[RobustFetch] Tentativa ${attempt + 1} de ${retries + 1} para URL: ${currentUrl}`);
        }
        
        // Se é uma tentativa de retry, notificar
        if (attempt > 0 && onRetry) {
          onRetry(attempt, errors[errors.length - 1] || new Error('Unknown error'));
        }
        
        // Aguardar delay exponencial antes do retry
        if (attempt > 0) {
          const delayTime = retryDelay * Math.pow(2, attempt - 1);
          await delay(delayTime);
        }
        
        const response = await fetchWithTimeout(currentUrl, fetchOptions, timeout);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Armazenar no cache se for bem-sucedido
        if (cacheKey) {
          setCachedData(cacheKey, data, cacheTtl);
        }
        
        console.log(`[RobustFetch] Sucesso na URL: ${currentUrl} após ${attempt + 1} tentativa(s)`);
        return data;
        
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Unknown error');
        errors.push(errorObj);
        
        console.warn(`[RobustFetch] Erro na tentativa ${attempt + 1} para URL ${currentUrl}:`, errorObj.message);
        
        // Se é a última tentativa da última URL, não continua
        if (urlIndex === urls.length - 1 && attempt === retries) {
          break;
        }
        
        // Se é a última tentativa desta URL, vai para a próxima URL
        if (attempt === retries) {
          break;
        }
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  console.error(`[RobustFetch] Todas as tentativas falharam para as URLs: ${urls.join(', ')}`);
  
  // Se há dados em cache antigo (mesmo expirado), usar como último recurso
  if (cacheKey) {
    const staleCache = cache.get(cacheKey);
    if (staleCache) {
      console.warn(`[RobustFetch] Usando dados em cache expirados como último recurso para: ${cacheKey}`);
      return staleCache.data;
    }
  }
  
  // Lançar erro composto com todas as falhas
  const aggregatedError = new Error(
    `Failed to fetch after ${retries + 1} retries across ${urls.length} URLs. Last errors: ${errors.slice(-3).map(e => e.message).join(', ')}`
  );
  
  throw aggregatedError;
}

// Função específica para WiseApp com configurações otimizadas
export async function robustWiseAppFetch(
  url: string,
  options: RobustFetchOptions = {},
  accountId?: string,
  token?: string
): Promise<any> {
  // Headers padrão para WiseApp
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'wiseapp-token': token }),
    ...(accountId && { 'wiseapp-account-id': accountId })
  };
  
  return robustFetch(url, {
    timeout: 15000, // 15 segundos para WiseApp
    retries: 5, // Mais tentativas para WiseApp
    retryDelay: 2000, // 2 segundos de delay inicial
    cacheTtl: 10 * 60 * 1000, // Cache de 10 minutos para dados do WiseApp
    showProgress: true,
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    },
    onRetry: (attempt, error) => {
      console.log(`[WiseApp] Tentativa ${attempt} falhou: ${error.message}. Tentando novamente...`);
      if (options.onRetry) {
        options.onRetry(attempt, error);
      }
    },
    onFallback: (url, error) => {
      console.log(`[WiseApp] Tentando URL alternativa: ${url} após erro: ${error.message}`);
      if (options.onFallback) {
        options.onFallback(url, error);
      }
    }
  });
}

// Função utilitária para limpar cache
export function clearCache(keyPattern?: string): void {
  if (!keyPattern) {
    cache.clear();
    console.log('[RobustFetch] Cache completamente limpo');
    return;
  }
  
  const keysToDelete: string[] = [];
  for (const key of cache.keys()) {
    if (key.includes(keyPattern)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => cache.delete(key));
  console.log(`[RobustFetch] Removidas ${keysToDelete.length} entradas do cache que continham: ${keyPattern}`);
}

// Função utilitária para verificar conectividade
export async function checkConnectivity(url = '/api/health'): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' }, 5000);
    return response.ok;
  } catch {
    return false;
  }
}

export default robustFetch;