import { createApiUrl } from '../lib/api-config';

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
}

/**
 * Consulta CEP através do proxy backend para evitar problemas de CORS
 */
export const consultarCep = async (cep: string): Promise<ViaCepResponse> => {
  // Remove caracteres não numéricos
  const cepLimpo = cep.replace(/\D/g, '');
  
  if (cepLimpo.length !== 8) {
    throw new Error('CEP deve conter exatamente 8 dígitos');
  }

  try {
    const response = await fetch(createApiUrl(`cep/${cepLimpo}`));
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 404) {
        throw new Error('CEP não encontrado. Verifique se digitou corretamente.');
      }
      
      if (response.status === 503) {
        throw new Error('⚠️ Consulta de CEP temporariamente indisponível. Preencha o endereço manualmente.');
      }
      
      if (response.status >= 500) {
        throw new Error('⚠️ Serviço de CEP temporariamente indisponível. Tente novamente em alguns segundos.');
      }
      
      throw new Error(errorData.error || `Erro ${response.status} ao consultar CEP`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
    }
    
    // Se já é uma mensagem de erro tratada, mantém ela
    if (error instanceof Error && error.message.includes('⚠️')) {
      throw error;
    }
    
    throw error;
  }
};

/**
 * Verifica disponibilidade das APIs de CEP
 */
export const verificarDisponibilidadeCep = async (): Promise<{ disponivel: boolean; mensagem: string }> => {
  try {
    const response = await fetch(createApiUrl('cep/01310100'));
    if (response.ok) {
      return { disponivel: true, mensagem: 'Consulta de CEP disponível' };
    } else if (response.status === 404) {
      // Se for 404, significa que as APIs estão funcionando mas o CEP específico não foi encontrado
      return { disponivel: true, mensagem: 'Consulta de CEP disponível' };
    } else {
      return { 
        disponivel: false, 
        mensagem: 'Serviço de consulta de CEP temporariamente indisponível. Preencha o endereço manualmente.' 
      };
    }
  } catch (error) {
    return { 
      disponivel: false, 
      mensagem: 'Serviço de consulta de CEP temporariamente indisponível. Preencha o endereço manualmente.' 
    };
  }
};

/**
 * Formata CEP para exibição (00000-000)
 */
export const formatarCep = (cep: string): string => {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) return cep;
  return `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
};

/**
 * Valida formato de CEP
 */
export const validarCep = (cep: string): boolean => {
  const cepLimpo = cep.replace(/\D/g, '');
  return cepLimpo.length === 8 && /^\d{8}$/.test(cepLimpo);
};