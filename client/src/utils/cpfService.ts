// CPF API Service - Proxy backend /api/cpf/:cpf
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
    const response = await fetch(`/api/cpf/${cpf}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Erro ao consultar CPF');
    }

    const result: CpfData = await response.json();

    return result || {};

  } catch (error) {
    console.error('❌ Erro ao consultar CPF via rota direta:', error);
    throw error;
  }
};