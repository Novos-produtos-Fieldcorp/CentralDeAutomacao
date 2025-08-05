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
 * Busca a foto do perfil do WhatsApp usando a API WiseApp
 */
export const fetchWhatsAppPhoto = async (phoneNumber: string): Promise<string | null> => {
  try {
    const response = await apiRequest(`/api/wiseapp/contact-photo`, {
      method: 'POST',
      body: JSON.stringify({ phone_number: phoneNumber }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data.photo_url || null;
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