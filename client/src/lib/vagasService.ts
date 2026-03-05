import { supabase } from './supabase';
import { API_BASE_URL } from './api-config-supabase';
import { InsertVaga, Vaga, InsertStVaga, InsertUnidade, InsertOperacao } from '@shared/schema';

export interface VagaWithRelations {
  id: number;
  nome: string;
  descricao: string;
  quantidade: number;
  dias_trabalho: string[];
  horario: string;
  dt_limite: string;
  created_at: string;
  updated_at: string | null;
  company_id: number;
  unidade_id: number | null;
  operacao_id: number | null;
  st_vaga_id: number | null;
  cliente_id: number | null;
  gr_id: number | null;
  // Campos relacionados (joins)
  cliente_nome: string | null;
  unidade_nome: string | null;
  operacao_nome: string | null;
  status_nome: string | null;
}

// ========== FETCH OPERATIONS (via backend - bypasses RLS) ==========

// Buscar vagas com dados relacionados para uma empresa
export const fetchVagasWithRelations = async (companyId: number): Promise<VagaWithRelations[]> => {
  const response = await fetch(`${API_BASE_URL}/vagas/company/${companyId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao buscar vagas: ${response.status}`);
  }
  return response.json();
};

// Buscar status de vagas para uma empresa
export const fetchStatusVagas = async (companyId: number) => {
  const response = await fetch(`${API_BASE_URL}/status-vagas/${companyId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao buscar status das vagas: ${response.status}`);
  }
  return response.json();
};

// Buscar clientes para uma empresa (tabela cliente não tem RLS restritivo, funciona direto)
export const fetchClientes = async (companyId: number) => {
  const { data, error } = await supabase
    .from('cliente')
    .select('cliente_id, nome')
    .eq('company_id', companyId)
    .eq('st_cliente', true);

  if (error) {
    throw new Error(`Erro ao buscar clientes: ${error.message}`);
  }

  return data || [];
};

// Buscar unidades para uma empresa
export const fetchUnidades = async (companyId: number) => {
  const response = await fetch(`${API_BASE_URL}/unidades/${companyId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao buscar unidades: ${response.status}`);
  }
  return response.json();
};

// Buscar operações para uma empresa
export const fetchOperacoes = async (companyId: number) => {
  const response = await fetch(`${API_BASE_URL}/operacoes/${companyId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao buscar operações: ${response.status}`);
  }
  return response.json();
};

// Buscar dados da empresa por account_id
export const fetchCompanyByAccount = async (accountId: string) => {
  const { data, error } = await supabase
    .from('company')
    .select('company_id, id_conta_wiseapp')
    .eq('id_conta_wiseapp', accountId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar dados da empresa: ${error.message}`);
  }

  return data;
};

// ========== CRUD OPERATIONS (via backend - bypasses RLS) ==========

// Criar nova vaga
export const createVaga = async (vagaData: Omit<InsertVaga, 'created_at' | 'updated_at'>) => {
  const response = await fetch(`${API_BASE_URL}/vagas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vagaData),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao criar vaga: ${response.status}`);
  }
  return response.json();
};

// Atualizar vaga existente
export const updateVaga = async (id: number, vagaData: Partial<Omit<InsertVaga, 'company_id' | 'created_at'>>, companyId: number) => {
  const response = await fetch(`${API_BASE_URL}/vagas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...vagaData, company_id: companyId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao atualizar vaga: ${response.status}`);
  }
  return response.json();
};

// Deletar vaga
export const deleteVaga = async (id: number, companyId: number) => {
  const response = await fetch(`${API_BASE_URL}/vagas/${id}?company_id=${companyId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao deletar vaga: ${response.status}`);
  }
  return { success: true };
};

// Atualizar status da vaga
export const updateVagaStatus = async (id: number, statusId: number, companyId: number) => {
  const response = await fetch(`${API_BASE_URL}/vagas/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ st_vaga_id: statusId, company_id: companyId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao atualizar status da vaga: ${response.status}`);
  }
  return response.json();
};

// ========== AUXILIARY CRUD OPERATIONS (via backend - bypasses RLS) ==========

// Criar novo status de vaga
export const createStatusVaga = async (statusData: Omit<InsertStVaga, 'created_at' | 'updated_at'>) => {
  const response = await fetch(`${API_BASE_URL}/status-vagas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(statusData),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao criar status de vaga: ${response.status}`);
  }
  return response.json();
};

// Criar nova unidade
export const createUnidade = async (unidadeData: Omit<InsertUnidade, 'created_at' | 'updated_at'>) => {
  const response = await fetch(`${API_BASE_URL}/unidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unidadeData),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao criar unidade: ${response.status}`);
  }
  return response.json();
};

// Criar nova operação
export const createOperacao = async (operacaoData: Omit<InsertOperacao, 'created_at' | 'updated_at'>) => {
  const response = await fetch(`${API_BASE_URL}/operacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(operacaoData),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao criar operação: ${response.status}`);
  }
  return response.json();
};

// Criar endereço de vaga
export const createEndVaga = async (endData: {
  vaga_id: number;
  logradouro_id: number;
  numero?: string | null;
  ds_complemento?: string | null;
  st_end?: boolean;
}) => {
  const response = await fetch(`${API_BASE_URL}/end-vaga`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(endData),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ao criar endereço da vaga: ${response.status}`);
  }
  return response.json();
};
