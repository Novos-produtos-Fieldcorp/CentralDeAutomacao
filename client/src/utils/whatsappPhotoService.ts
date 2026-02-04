import { apiRequest } from '@/lib/queryClient';
import { API_BASE_URL } from '@/lib/api-config-supabase';

export interface WhatsAppPhotoUpdate {
  motorista_id: number;
  foto_whatsapp: string;
}

/**
 * Salva a foto do WhatsApp de um motorista no banco de dados
 */
export const saveWhatsAppPhoto = async (motoristaId: number, photoUrl: string): Promise<boolean> => {
  try {
    await apiRequest(`/api/motoristas/${motoristaId}/whatsapp-photo`, {
      method: 'PATCH',
      body: JSON.stringify({ foto_whatsapp: photoUrl }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao salvar foto do WhatsApp:', error);
    return false;
  }
};

/**
 * Busca a foto do perfil do WhatsApp usando exatamente a mesma lógica do FloatingChat
 */
export const fetchWhatsAppPhoto = async (phoneNumber: string, apiKey?: string, accountId?: string): Promise<string | null> => {
  try {
    // For Netlify compatibility, use provided parameters or fallback to localStorage only in dev environment
    let token = apiKey;
    let account = accountId;
    
    if (!token || !account) {
      try {
        token = token || localStorage?.getItem('wiseapp_token') || undefined;
        account = account || localStorage?.getItem('account_id') || undefined;
      } catch {
        // Silently handle localStorage errors in serverless environments
      }
    }
    
    if (!token || !account) {
      console.warn('API key or account ID not found');
      return null;
    }

    // Searching contact for phone number

    // Usar axios igual ao FloatingChat para manter consistência
    const axios = (await import('axios')).default;
    const apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Formatar número igual ao FloatingChat
    let formattedNumber = phoneNumber;
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = `+55${phoneNumber}`;
    }
    const digitsOnly = formattedNumber.replace(/\D/g, '');

    // Primeiro tentar busca por ID exato
    try {
      const searchResponse = await apiClient.get(`/v1/accounts/${account}/contacts/search`, {
        params: {
          q: digitsOnly
        }
      });
      
      if (searchResponse.data?.payload?.[0]) {
        const contact = searchResponse.data.payload[0];
        // Contact found via search
        
        // Buscar dados completos do contato igual ao FloatingChat
        const contactResponse = await apiClient.get(`/v1/accounts/${accountId}/contacts/${contact.id}`);
        
        if (contactResponse.data) {
          const photoUrl = contactResponse.data.avatar_url || contactResponse.data.thumbnail;
          
          if (photoUrl && photoUrl.trim() !== '') {
            // Contact photo URL found
            return photoUrl;
          }
        }
      }
    } catch (error) {
      // Error in specific search, trying general search
    }

    // Se não encontrou, tentar busca geral como o FloatingChat
    try {
      const searchUrl = `/v1/accounts/${accountId}/contacts?q=${encodeURIComponent(phoneNumber)}&sort=name&_t=${Date.now()}`;
      const response = await apiClient.get(searchUrl);
      
      if (response.data && response.data.payload && response.data.payload.length > 0) {
        const contact = response.data.payload[0];
        // Contact found via general search
        
        const photoUrl = contact.avatar_url || contact.thumbnail;
        
        if (photoUrl && photoUrl.trim() !== '') {
          // Contact photo URL found
          return photoUrl;
        }
      }
    } catch (error) {
      // Error in general search
    }
    
    // No contact or photo found for phone number
    return null;
  } catch (error) {
    console.error('Erro ao buscar foto do WhatsApp:', error);
    return null;
  }
};

/**
 * Otimiza a URL da foto para reduzir o tamanho
 */
export const optimizePhotoUrl = (url: string): string => {
  // Se for uma URL do WhatsApp, adiciona parâmetros para reduzir o tamanho
  if (url.includes('whatsapp') || url.includes('wa.me')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}s=96`; // Tamanho pequeno (96px)
  }
  
  return url;
};