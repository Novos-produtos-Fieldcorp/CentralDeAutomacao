// CPF API Service
interface CpfApiResponse {
  CadastroPessoaFisica?: {
    Nome?: string;
    DataNascimento?: string;
    Telefones?: Array<{
      TelefoneComDDD: string;
    }>;
    Enderecos?: Array<{
      Logradouro?: string;
      Numero?: string;
      Complemento?: string;
      Bairro?: string;
      Cidade?: string;
      UF?: string;
      CEP?: string;
    }>;
  };
  ReceitaFederalCpf?: {
    NomePessoaFisica?: string;
    DataNascimento?: string;
  };
}

interface CpfData {
  nome?: string;
  dt_nascimento?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export const consultarCpfApi = async (cpf: string): Promise<CpfData> => {
  if (!cpf || cpf.length !== 11) {
    throw new Error('CPF deve conter exatamente 11 dígitos');
  }

  console.log('Consultando CPF via backend proxy:', cpf);
  
  try {
    const response = await fetch(`/api/cpf/${cpf}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('CPF deve conter exatamente 11 dígitos');
      } else if (response.status === 401) {
        throw new Error('Token de acesso expirado ou inválido');
      } else if (response.status === 404) {
        throw new Error('CPF não encontrado na base de dados');
      } else if (response.status === 408) {
        throw new Error('Timeout: A consulta demorou muito para responder');
      } else if (response.status === 429) {
        throw new Error('Limite de consultas excedido. Tente novamente em alguns minutos');
      } else if (response.status === 503) {
        throw new Error('Serviço de consulta CPF temporariamente indisponível');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro na consulta: ${response.status}`);
      }
    }

    const data: CpfData = await response.json();
    console.log('✓ CPF consultado com sucesso via backend');
    return data;

  } catch (error) {
    console.error('Erro ao consultar CPF via backend:', error);
    throw error;
  }
};