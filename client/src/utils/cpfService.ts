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

// Função para verificar se a API está acessível
const checkApiConnectivity = async (apiUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout para test
    
    await fetch(apiUrl, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
};

export const consultarCpfApi = async (cpf: string): Promise<CpfData> => {
  if (!cpf || cpf.length !== 11) {
    throw new Error('CPF deve conter exatamente 11 dígitos');
  }

  const API_URL = 'https://api.cellereit.com.br/v1/cpf';
  const BEARER_TOKEN = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIzS1dxVWt4U2pTSDc5OUxnc3cyX0htRFozZDlkVzZoNmtsVGx2Q2t2dkdzIn0.eyJleHAiOjE3MzE5MzcwMzEsImlhdCI6MTczMTkzNjczMSwianRpIjoiNzU2NGU1ZTgtNzdiNC00YmE3LWI0YjMtZmZiYTgwNDQ3Y2NiIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5jZWxsZXJlaXQuY29tLmJyL2F1dGgvcmVhbG1zL3BvcnRhbC1jbGllbnRlcy1hcGkiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiNDY0ZTUwOTYtZDJlZi00ZmIxLTk4M2EtNzczYjM5ZGYyOWI4IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoicGRjYS1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiZjJiMWU3NmQtMDNhMy00ZWE0LWI4YzQtZmUwNjQ1NDI0N2M1IiwiYWNyIjoiMSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJvcmdhbml6YXRpb24iLCJvZmZsaW5lX2FjY2VzcyIsImRlZmF1bHQtcm9sZXMtcG9ydGFsLWNsaWVudGVzLWFwaSIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJlbWFpbCBwbGFucyBwcm9maWxlIiwic2lkIjoiZjJiMWU3NmQtMDNhMy00ZWE0LWI4YzQtZmUwNjQ1NDI0N2M1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImdyb3VwcyI6WyJhY2NvdW50QWRtaW5zIiwib3JnYW5pemF0aW9ucyJdLCJiaWxsaW5nQWNjb3VudElkIjoiNjczYjNlYTUyMDE0Y2I5OGQxNGMxM2Y0IiwicHJlZmVycmVkX3VzZXJuYW1lIjoiaW5mb0BmaWVsZGNvcnAuY29tLmJyIiwiZ2l2ZW5fbmFtZSI6IiIsImxvY2FsZSI6InB0LUJSIiwiZmFtaWx5X25hbWUiOiIiLCJlbWFpbCI6ImluZm9AZmllbGRjb3JwLmNvbS5iciJ9.nuykYiaqFUPpvGc59H-m5uI_bKbqfz1KwEKGObTN0OPsVxEJ5Oyt2h919nhZ4HjPC5i8hgvCS9BKphombNddPPGmyVTJWKSDQh-ZhcM1qUZvAf1RKZGfWeebnue3bKQA32EEboAzzyDg4Mkk_q9vsFzpBMfM6G2ol5SZIJannTPA2uT7fHMvE52clBFkSc4bGRM5p5osyct0aYhX3B2P2sj3_0DCZsbDKMeMG6UqT-px10dQFvMZGACBKsftCXqtsTSjThz--S2cbpWsDu-b5oe4fVwxcwF712n63A8Z-NCn112csIxXWlPbKHKCbOT0oKeNAxuTeiIRkJ05L_tANA';
  
  // Primeiro, verificar conectividade com a API base
  const baseUrl = 'https://api.cellereit.com.br';
  const isConnected = await checkApiConnectivity(baseUrl);
  
  if (!isConnected) {
    console.warn('API Cellereit não está acessível no momento');
    throw new Error('Serviço de consulta de CPF temporariamente indisponível. Tente novamente mais tarde.');
  }

  try {
    console.log('Consultando CPF:', cpf);
    console.log('URL da API:', `${API_URL}/${cpf}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(`${API_URL}/${cpf}`, {
      method: 'GET',
      headers: {
        'Authorization': BEARER_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token de acesso expirado ou inválido');
      } else if (response.status === 404) {
        throw new Error('CPF não encontrado na base de dados');
      } else if (response.status === 429) {
        throw new Error('Limite de consultas excedido. Tente novamente em alguns minutos');
      } else {
        throw new Error(`Erro na consulta: ${response.status} - ${response.statusText}`);
      }
    }

    const apiResponse: CpfApiResponse = await response.json();
    
    // Processar dados da API e extrair informações relevantes
    const pessoaFisica = apiResponse.CadastroPessoaFisica;
    const receitaFederal = apiResponse.ReceitaFederalCpf;
    
    // Construir objeto com dados encontrados
    const result: CpfData = {
      nome: pessoaFisica?.Nome || receitaFederal?.NomePessoaFisica || undefined,
      dt_nascimento: pessoaFisica?.DataNascimento || receitaFederal?.DataNascimento || undefined,
      telefone: pessoaFisica?.Telefones?.[0]?.TelefoneComDDD || undefined
    };

    // Dados de endereço se disponíveis
    if (pessoaFisica?.Enderecos && pessoaFisica.Enderecos.length > 0) {
      const endereco = pessoaFisica.Enderecos[0];
      result.logradouro = endereco.Logradouro;
      result.numero = endereco.Numero;
      result.complemento = endereco.Complemento;
      result.bairro = endereco.Bairro;
      result.cidade = endereco.Cidade;
      result.estado = endereco.UF;
      result.cep = endereco.CEP;
    }

    return result;
  } catch (error) {
    console.error('Erro ao consultar CPF:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout: A consulta demorou muito para responder');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('Erro de conectividade: Verifique sua conexão de internet ou tente novamente');
      } else {
        throw error;
      }
    } else {
      throw new Error('Erro inesperado ao consultar CPF');
    }
  }
};