import axios from 'axios';

interface GeocodingCache {
  [key: string]: {
    address: string;
    timestamp: number;
  };
}

interface NominatimResponse {
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

// In-memory cache for geocoded addresses
const cache: GeocodingCache = {};
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Rate limiting: 1 request per second for Nominatim
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

/**
 * Generate cache key from coordinates
 */
function getCacheKey(lat: number, lng: number): string {
  // Round to 5 decimal places (~1 meter precision) for cache key
  const roundedLat = lat.toFixed(5);
  const roundedLng = lng.toFixed(5);
  return `${roundedLat},${roundedLng}`;
}

/**
 * Wait to respect rate limit
 */
async function respectRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`⏱️ [Geocoding] Rate limit: aguardando ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Format address from Nominatim response
 */
function formatAddress(data: NominatimResponse): string {
  if (!data.address) {
    return data.display_name;
  }

  const parts: string[] = [];
  const addr = data.address;

  // Street address
  if (addr.road) {
    if (addr.house_number) {
      parts.push(`${addr.road}, ${addr.house_number}`);
    } else {
      parts.push(addr.road);
    }
  }

  // Neighborhood/suburb
  if (addr.suburb) {
    parts.push(addr.suburb);
  }

  // City
  if (addr.city) {
    parts.push(addr.city);
  }

  // State
  if (addr.state) {
    parts.push(addr.state);
  }

  // Postal code
  if (addr.postcode) {
    parts.push(`CEP ${addr.postcode}`);
  }

  return parts.length > 0 ? parts.join(' - ') : data.display_name;
}

/**
 * Reverse geocode coordinates to address using Nominatim
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // Validate coordinates
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    console.warn('⚠️ [Geocoding] Coordenadas inválidas');
    return null;
  }

  // Check cache first
  const cacheKey = getCacheKey(lat, lng);
  const cached = cache[cacheKey];
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`✅ [Geocoding] Cache hit para ${cacheKey}`);
    return cached.address;
  }

  try {
    // Respect Nominatim rate limit
    await respectRateLimit();

    console.log(`🌍 [Geocoding] Buscando endereço para lat=${lat}, lng=${lng}`);

    // Call Nominatim API
    const response = await axios.get<NominatimResponse>(
      'https://nominatim.openstreetmap.org/reverse',
      {
        params: {
          lat,
          lon: lng,
          format: 'json',
          addressdetails: 1,
          'accept-language': 'pt-BR,pt,en',
        },
        headers: {
          'User-Agent': 'FleetManagementApp/1.0',
        },
        timeout: 5000,
      }
    );

    if (!response.data || !response.data.display_name) {
      console.warn(`⚠️ [Geocoding] Resposta vazia para ${cacheKey}`);
      return null;
    }

    const address = formatAddress(response.data);
    
    // Store in cache
    cache[cacheKey] = {
      address,
      timestamp: Date.now(),
    };

    console.log(`✅ [Geocoding] Endereço encontrado: ${address}`);
    return address;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        console.error('🚫 [Geocoding] Rate limit excedido');
      } else {
        console.error(`❌ [Geocoding] Erro na API: ${error.message}`);
      }
    } else {
      console.error('❌ [Geocoding] Erro desconhecido:', error);
    }
    return null;
  }
}

/**
 * Batch reverse geocoding - optimized to check cache first, only throttle API calls
 */
export async function reverseGeocodeBatch(
  coordinates: Array<{ lat: number; lng: number; id: string | number }>
): Promise<Array<{ id: string | number; address: string | null }>> {
  const results: Array<{ id: string | number; address: string | null }> = [];
  const uncachedCoords: Array<{ lat: number; lng: number; id: string | number }> = [];

  // First pass: check cache for all coordinates
  for (const coord of coordinates) {
    const cacheKey = getCacheKey(coord.lat, coord.lng);
    const cached = cache[cacheKey];
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      // Cache hit - add immediately
      results.push({
        id: coord.id,
        address: cached.address,
      });
      console.log(`✅ [Geocoding Batch] Cache hit para ${cacheKey}`);
    } else {
      // Cache miss - needs API call
      uncachedCoords.push(coord);
    }
  }

  console.log(`📊 [Geocoding Batch] ${results.length} cached, ${uncachedCoords.length} need API calls`);

  // Second pass: fetch uncached coordinates with rate limiting
  for (const coord of uncachedCoords) {
    const address = await reverseGeocode(coord.lat, coord.lng);
    results.push({
      id: coord.id,
      address,
    });
  }

  return results;
}

/**
 * Clear old cache entries (can be called periodically)
 */
export function cleanCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of Object.entries(cache)) {
    if (now - value.timestamp > CACHE_TTL) {
      delete cache[key];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 [Geocoding] Cache limpo: ${cleaned} entradas removidas`);
  }
}

// Clean cache every 24 hours
setInterval(cleanCache, 24 * 60 * 60 * 1000);
