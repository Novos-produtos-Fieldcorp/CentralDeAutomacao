import { apiRequest } from '@/lib/queryClient';

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
 * Busca a foto do perfil do WhatsApp usando a mesma lógica do FloatingChat
 */
export const fetchWhatsAppPhoto = async (phoneNumber: string): Promise<string | null> => {
  try {
    const apiKey = localStorage.getItem('wiseapp_token');
    const accountId = localStorage.getItem('account_id');
    
    if (!apiKey || !accountId) {
      console.warn('API key or account ID not found');
      return null;
    }

    console.log('Searching contact for phone:', phoneNumber);

    // Usar fetch para buscar contatos (mesma abordagem do FloatingChat)
    const searchUrl = `/api/api/v1/accounts/${accountId}/contacts?q=${encodeURIComponent(phoneNumber)}&sort=name&_t=${Date.now()}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'api_access_token': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.payload && data.payload.length > 0) {
      const contact = data.payload[0];
      console.log('Found contact:', contact);
      
      // Usar a mesma lógica do FloatingChat: priorizar avatar_url, depois thumbnail
      const photoUrl = contact.avatar_url || contact.thumbnail;
      
      if (photoUrl && photoUrl.trim() !== '') {
        console.log('Found contact photo URL:', photoUrl);
        return photoUrl;
      }
    }
    
    console.log('No contact or photo found for phone:', phoneNumber);
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