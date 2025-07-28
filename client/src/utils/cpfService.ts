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

  try {
    const response = await fetch(`https://api.gw.cellereit.com.br/bg-check/cpf-completo?cpf=${cpf}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIzS1dxVWt4U2pTSDc5OUxnc3cyX0htRFozZDlkVzZoNmtsVGx2Q2t2dkdzIn0.eyJleHAiOjE3MzE5MzcwMzEsImlhdCI6MTczMTkzNjczMSwianRpIjoiNzU2NGU1ZTgtNzdiNC00YmE3LWI0YjMtZmZiYTgwNDQ3Y2NiIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5jZWxsZXJlaXQuY29tLmJyL2F1dGgvcmVhbG1zL3BvcnRhbC1jbGllbnRlcy1hcGkiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiNDY0ZTUwOTYtZDJlZi00ZmIxLTk4M2EtNzczYjM5ZGYyOWI4IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoicGRjYS1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiZjJiMWU3NmQtMDNhMy00ZWE0LWI4YzQtZmUwNjQ1NDI0N2M1IiwiYWNyIjoiMSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJvcmdhbml6YXRpb24iLCJvZmZsaW5lX2FjY2VzcyIsImRlZmF1bHQtcm9sZXMtcG9ydGFsLWNsaWVudGVzLWFwaSIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJlbWFpbCBwbGFucyBwcm9maWxlIiwic2lkIjoiZjJiMWU3NmQtMDNhMy00ZWE0LWI4YzQtZmUwNjQ1NDI0N2M1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImdyb3VwcyI6WyJhY2NvdW50QWRtaW5zIiwib3JnYW5pemF0aW9ucyJdLCJiaWxsaW5nQWNjb3VudElkIjoiNjczYjNlYTUyMDE0Y2I5OGQxNGMxM2Y0IiwicHJlZmVycmVkX3VzZXJuYW1lIjoiaW5mb0BmaWVsZGNvcnAuY29tLmJyIiwiZ2l2ZW5fbmFtZSI6IiIsImxvY2FsZSI6InB0LUJSIiwiZmFtaWx5X25hbWUiOiIiLCJlbWFpbCI6ImluZm9AZmllbGRjb3JwLmNvbS5iciJ9.nuykYiaqFUPpvGc59H-m5uI_bKbqfz1KwEKGObTN0OPsVxEJ5Oyt2h919nhZ4HjPC5i8hgvCS9BKphombNddPPGmyVTJWKSDQh-ZhcM1qUZvAf1RKZGfWeebnue3bKQA32EEboAzzyDg4Mkk_q9vsFzpBMfM6G2ol5SZIJannTPA2uT7fHMvE52clBFkSc4bGRM5p5osyct0aYhX3B2P2sj3_0DCZsbDKMeMG6UqT-px10dQFvMZGACBKsftCXqtsTSjThz--S2cbpWsDu-b5oe4fVwxcwF712n63A8Z-NCn112csIxXWlPbKHKCbOT0oKeNAxuTeiIRkJ05L_tANA'
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao consultar CPF na API');
    }

    const data: CpfApiResponse = await response.json();
    const pessoa = data.CadastroPessoaFisica || {};
    const receita = data.ReceitaFederalCpf || {};
    const endereco = (pessoa.Enderecos && pessoa.Enderecos[0]) || {};

    return {
      nome: pessoa.Nome || receita.NomePessoaFisica || '',
      dt_nascimento: (pessoa.DataNascimento || receita.DataNascimento || '').substring(0, 10),
      telefone: pessoa.Telefones && pessoa.Telefones[0] ? pessoa.Telefones[0].TelefoneComDDD.replace(/\D/g, '') : '',
      logradouro: endereco.Logradouro || '',
      numero: endereco.Numero || '',
      complemento: endereco.Complemento || '',
      bairro: endereco.Bairro || '',
      cidade: endereco.Cidade || '',
      estado: endereco.UF || '',
      cep: endereco.CEP || ''
    };
  } catch (error) {
    console.error('Erro ao consultar CPF:', error);
    throw new Error(error instanceof Error ? error.message : 'Erro ao consultar CPF');
  }
};