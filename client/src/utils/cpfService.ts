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

// SECURITY NOTE: CPF lookup functionality has been disabled due to security concerns
// External API calls with credentials should be handled server-side

export const consultarCpfApi = async (cpf: string): Promise<CpfData> => {
  // DISABLED: This function contained a hardcoded Bearer token which is a security vulnerability
  // TODO: Implement secure CPF lookup via backend service if needed
  throw new Error('CPF lookup service temporarily disabled for security reasons. Please contact administrator if this feature is needed.');
};