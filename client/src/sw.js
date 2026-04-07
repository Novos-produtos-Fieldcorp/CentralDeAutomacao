// Service Worker inteligente com cache por account_id
const CACHE_PREFIX = 'fleet-app-';
const STATIC_CACHE = 'fleet-static-v1';
const API_CACHE_PREFIX = 'fleet-api-';

// Recursos estáticos que sempre podem ser cacheados
const STATIC_ASSETS = [
  '/',
  '/src/index.css',
  '/src/main.tsx',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png'
];

// Instalação do service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Ativação do service worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Para requisições de API, usar cache específico por account_id
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return handleApiRequest(event, url);
  }
  
  // Para recursos estáticos, usar cache padrão
  return handleStaticRequest(event, url);
});

// Handle para requisições de API com cache por account_id
async function handleApiRequest(event, url) {
  // Usar account_id global se disponível, senão extrair da requisição
  const accountId = self.currentAccountId || getAccountIdFromRequest(request);
  const cacheKey = accountId ? `${API_CACHE_PREFIX}${accountId}` : API_CACHE_PREFIX + 'default';
  
  try {
    // Tentar cache primeiro (para GET requests)
    if (request.method === 'GET') {
      const cachedResponse = await getCachedResponse(cacheKey, request);
      if (cachedResponse) {
        console.log('[SW] Cache hit for API:', url.pathname);
        return cachedResponse;
      }
    }
    
    // Se não tem cache, fazer requisição
    console.log('[SW] Cache miss for API:', url.pathname);
    const response = await fetch(request);
    
    // Cache only respostas bem-sucedidas
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(cacheKey);
      // Limitar cache a 50 entradas por account_id
      const keys = await cache.keys();
      if (keys.length >= 50) {
        await cache.delete(keys[0]);
      }
      // Adicionar timestamp ao cache
      const responseToCache = response.clone();
      responseToCache.headers.set('sw-cache-time', Date.now().toString());
      cache.put(request, responseToCache);
    }
    
    return response;
  } catch (error) {
    console.error('[SW] API request failed:', error);
    
    // Tentar retornar cache antigo se disponível
    if (request.method === 'GET') {
      const cachedResponse = await getCachedResponse(cacheKey, request);
      if (cachedResponse) {
        console.log('[SW] Fallback to cache for API:', url.pathname);
        return cachedResponse;
      }
    }
    
    return new Response('Network error', { status: 503 });
  }
}

// Handle para recursos estáticos
async function handleStaticRequest(event, url) {
  try {
    const cachedResponse = await getCachedResponse(STATIC_CACHE, event.request);
    if (cachedResponse) {
      console.log('[SW] Cache hit for static:', url.pathname);
      return cachedResponse;
    }
    
    console.log('[SW] Cache miss for static:', url.pathname);
    const response = await fetch(event.request);
    
    // Cache only respostas bem-sucedidas
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      // Adicionar timestamp ao cache
      const responseToCache = response.clone();
      responseToCache.headers.set('sw-cache-time', Date.now().toString());
      cache.put(event.request, responseToCache);
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Static request failed:', error);
    return new Response('Network error', { status: 503 });
  }
}

// Função para extrair account_id da requisição
function getAccountIdFromRequest(request) {
  // Tentar extrair dos headers
  const accountIdHeader = request.headers.get('X-Account-ID');
  if (accountIdHeader) {
    return accountIdHeader;
  }
  
  // Tentar extrair da URL (para requisições diretas)
  const url = new URL(request.url);
  const accountIdParam = url.searchParams.get('account_id');
  if (accountIdParam) {
    return accountIdParam;
  }
  
  // Tentar extrair do referer
  const referer = request.headers.get('referer');
  if (referer) {
    const refererUrl = new URL(referer);
    const refererAccountId = refererUrl.searchParams.get('account_id');
    if (refererAccountId) {
      return refererAccountId;
    }
  }
  
  return null;
}

// Função para buscar resposta do cache
async function getCachedResponse(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      // Verificar se o cache ainda é válido (5 minutos para API, 1 dia para estáticos)
      const cacheTime = cached.headers.get('sw-cache-time');
      if (cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        const maxAge = cacheName.startsWith(API_CACHE_PREFIX) ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000;
        
        if (age < maxAge) {
          return cached;
        } else {
          // Cache expirado, remover
          await cache.delete(request);
        }
      } else {
        return cached;
      }
    }
  } catch (error) {
    console.error('[SW] Cache read error:', error);
  }
  
  return null;
}

// Sync messages para comunicação com o app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    const { accountId } = event.data;
    if (accountId) {
      const cacheKey = `${API_CACHE_PREFIX}${accountId}`;
      caches.delete(cacheKey).then(() => {
        console.log(`[SW] Cleared cache for account: ${accountId}`);
      });
    }
  }
  
  if (event.data && event.data.type === 'SET_ACCOUNT_ID') {
    const { accountId } = event.data;
    console.log(`[SW] Account ID set: ${accountId}`);
    // Armazenar account_id globalmente para uso nas requisições
    self.currentAccountId = accountId;
  }
});
