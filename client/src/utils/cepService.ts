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
 * Consulta CEP diretamente via APIs externas
 */
export const consultarCep = async (cep: string): Promise<ViaCepResponse> => {
  const cepLimpo = cep.replace(/\D/g, '');
  
  if (cepLimpo.length !== 8) {
    throw new Error('CEP deve conter exatamente 8 dígitos');
  }

  // Usar ViaCEP diretamente
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!response.ok) {
      throw new Error('Falha na consulta CEP');
    }
    
    const data = await response.json();
    
    if (data.erro) {
      throw new Error('CEP não encontrado. Verifique se digitou corretamente.');
    }
    
    return data;
  } catch (error) {
    // Fallback para outros serviços se ViaCEP falhar
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`);
      if (!response.ok) {
        throw new Error('CEP não encontrado. Verifique se digitou corretamente.');
      }
      
      const data = await response.json();
      return {
        cep: data.cep,
        logradouro: data.street,
        complemento: '',
        bairro: data.neighborhood,
        localidade: data.city,
        uf: data.state,
        ibge: '',
        gia: '',
        ddd: '',
        siafi: ''
      };
    } catch (fallbackError) {
      throw new Error('⚠️ Serviço de CEP temporariamente indisponível. Preencha o endereço manualmente.');
    }
  }
};

/**
 * Verifica disponibilidade das APIs de CEP
 */
export const verificarDisponibilidadeCep = async (): Promise<{ disponivel: boolean; mensagem: string }> => {
  try {
    const response = await fetch('https://viacep.com.br/ws/01310100/json/');
    if (response.ok) {
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