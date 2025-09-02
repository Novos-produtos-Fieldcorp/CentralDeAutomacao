export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
  keyGenerator?: (params: any) => string;
}

// Cache simples em memória para APIs
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: any, ttl: number): void {
    // Cleanup old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const apiCache = new MemoryCache(500);

// Função de retry com backoff exponencial
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = (error) => {
      // Retry apenas em erros de rede/servidor, não em erros de cliente
      return error.status >= 500 || error.code === 'ECONNREFUSED' || 
             error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
    }
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries || !retryCondition(error)) {
        throw error;
      }
      
      // Calcular delay com backoff exponencial e jitter
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );
      const jitter = delay * 0.1 * Math.random(); // 10% jitter
      
      console.log(`[RETRY] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay + jitter)}ms:`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
}

// Função para cache com TTL
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300000, keyGenerator } = options; // Default: 5 minutos
  
  const cacheKey = keyGenerator ? keyGenerator(key) : key;
  
  // Verificar cache primeiro
  const cached = apiCache.get(cacheKey);
  if (cached !== null) {
    console.log(`[CACHE HIT] ${cacheKey}`);
    return cached;
  }
  
  console.log(`[CACHE MISS] ${cacheKey}`);
  
  // Executar função e cachear resultado
  try {
    const result = await fn();
    apiCache.set(cacheKey, result, ttl);
    return result;
  } catch (error) {
    // Em caso de erro, não cachear
    throw error;
  }
}

// Combinar retry + cache para APIs críticas
export async function apiWithRetryAndCache<T>(
  key: string,
  fn: () => Promise<T>,
  retryOptions: RetryOptions = {},
  cacheOptions: CacheOptions = {}
): Promise<T> {
  return withCache(
    key,
    () => retryWithBackoff(fn, retryOptions),
    cacheOptions
  );
}

// Utilitários para WiseApp API
export const WiseAppRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryCondition: (error) => {
    // WiseApp: retry em 5xx, timeout, ou connection errors
    return error.status >= 500 || 
           error.code === 'ECONNREFUSED' || 
           error.code === 'ENOTFOUND' || 
           error.code === 'ETIMEDOUT' ||
           error.message?.includes('timeout');
  }
};

export const WiseAppCacheOptions: CacheOptions = {
  ttl: 180000, // 3 minutos para WiseApp (dados mais dinâmicos)
  maxSize: 200,
  keyGenerator: (params: any) => `wiseapp:${JSON.stringify(params)}`
};

// Limpar cache periodicamente (opcional)
setInterval(() => {
  const size = apiCache.size();
  if (size > 0) {
    console.log(`[CACHE] Current cache size: ${size} entries`);
  }
}, 300000); // Check every 5 minutes

export { apiCache };