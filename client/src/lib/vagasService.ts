import { supabase } from './supabase';
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

// Helper function to set company context for RLS - SECURE VERSION
const setCompanyContext = async (companyId: number) => {
  if (!companyId || companyId <= 0) {
    throw new Error('Company ID deve ser um número válido e positivo');
  }
  
  // Set company context using SQL function (replaces insecure set_config)
  await supabase.rpc('set_current_company_id', { company_id: companyId });
};

// Buscar vagas com dados relacionados para uma empresa
export const fetchVagasWithRelations = async (companyId: number): Promise<VagaWithRelations[]> => {
  try {
    // Set company context for RLS
    await setCompanyContext(companyId);
    
    // Buscar vagas
    const { data: vagas, error: vagasError } = await supabase
      .from('vaga')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (vagasError) {
      throw new Error(`Erro ao buscar vagas: ${vagasError.message}`);
    }

    if (!vagas || vagas.length === 0) {
      return [];
    }

    // Buscar dados relacionados em paralelo
    const [clientesData, unidadesData, operacoesData, statusData] = await Promise.all([
      supabase.from('cliente').select('cliente_id, nome').eq('company_id', companyId),
      supabase.from('unidade').select('id, unidade').eq('company_id', companyId),
      supabase.from('operacao').select('id, operacao').eq('company_id', companyId),
      supabase.from('st_vaga').select('id, status_vaga').eq('company_id', companyId)
    ]);

    // Criar mapas de lookup
    const clientesMap = new Map();
    clientesData.data?.forEach(c => clientesMap.set(c.cliente_id, c.nome));
    
    const unidadesMap = new Map();
    unidadesData.data?.forEach(u => unidadesMap.set(u.id, u.unidade));
    
    const operacoesMap = new Map();
    operacoesData.data?.forEach(o => operacoesMap.set(o.id, o.operacao));
    
    const statusMap = new Map();
    statusData.data?.forEach(s => statusMap.set(s.id, s.status_vaga));

    // Enriquecer vagas com dados relacionados
    const enrichedVagas: VagaWithRelations[] = vagas.map(vaga => ({
      ...vaga,
      cliente_nome: clientesMap.get(vaga.cliente_id) || null,
      unidade_nome: unidadesMap.get(vaga.unidade_id) || null,
      operacao_nome: operacoesMap.get(vaga.operacao_id) || null,
      status_nome: statusMap.get(vaga.st_vaga_id) || null,
    }));

    return enrichedVagas;
  } catch (error) {
    console.error('Erro ao buscar vagas com relações:', error);
    throw error;
  }
};

// Buscar status de vagas para uma empresa
export const fetchStatusVagas = async (companyId: number) => {
  const { data, error } = await supabase
    .from('st_vaga')
    .select('*')
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Erro ao buscar status das vagas: ${error.message}`);
  }

  return data || [];
};

// Buscar clientes para uma empresa  
export const fetchClientes = async (companyId: number) => {
  const { data, error } = await supabase
    .from('cliente')
    .select('cliente_id, nome')
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Erro ao buscar clientes: ${error.message}`);
  }

  return data || [];
};

// Buscar unidades para uma empresa
export const fetchUnidades = async (companyId: number) => {
  const { data, error } = await supabase
    .from('unidade')
    .select('id, unidade')
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Erro ao buscar unidades: ${error.message}`);
  }

  return data || [];
};

// Buscar operações para uma empresa
export const fetchOperacoes = async (companyId: number) => {
  const { data, error } = await supabase
    .from('operacao')
    .select('id, operacao')
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Erro ao buscar operações: ${error.message}`);
  }

  return data || [];
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

// ========== CRUD OPERATIONS ==========

// Criar nova vaga
export const createVaga = async (vagaData: Omit<InsertVaga, 'created_at' | 'updated_at'>) => {
  await setCompanyContext(vagaData.company_id);
  
  const { data, error } = await supabase
    .from('vaga')
    .insert({
      ...vagaData,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar vaga: ${error.message}`);
  }

  return data;
};

// Atualizar vaga existente
export const updateVaga = async (id: number, vagaData: Partial<Omit<InsertVaga, 'company_id' | 'created_at'>>, companyId: number) => {
  await setCompanyContext(companyId);
  
  const { data, error } = await supabase
    .from('vaga')
    .update({
      ...vagaData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar vaga: ${error.message}`);
  }

  return data;
};

// Deletar vaga
export const deleteVaga = async (id: number, companyId: number) => {
  await setCompanyContext(companyId);
  
  const { error } = await supabase
    .from('vaga')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Erro ao deletar vaga: ${error.message}`);
  }

  return { success: true };
};

// Atualizar status da vaga
export const updateVagaStatus = async (id: number, statusId: number, companyId: number) => {
  await setCompanyContext(companyId);
  
  const { data, error } = await supabase
    .from('vaga')
    .update({ 
      st_vaga_id: statusId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar status da vaga: ${error.message}`);
  }

  return data;
};

// ========== AUXILIARY CRUD OPERATIONS ==========

// Criar novo status de vaga
export const createStatusVaga = async (statusData: Omit<InsertStVaga, 'created_at' | 'updated_at'>) => {
  await setCompanyContext(Number(statusData.company_id));
  
  const { data, error } = await supabase
    .from('st_vaga')
    .insert(statusData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar status de vaga: ${error.message}`);
  }

  return data;
};

// Criar nova unidade
export const createUnidade = async (unidadeData: Omit<InsertUnidade, 'created_at' | 'updated_at'>) => {
  await setCompanyContext(Number(unidadeData.company_id));
  
  const { data, error } = await supabase
    .from('unidade')
    .insert(unidadeData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar unidade: ${error.message}`);
  }

  return data;
};

// Criar nova operação
export const createOperacao = async (operacaoData: Omit<InsertOperacao, 'created_at' | 'updated_at'>) => {
  await setCompanyContext(Number(operacaoData.company_id));
  
  const { data, error } = await supabase
    .from('operacao')
    .insert(operacaoData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar operação: ${error.message}`);
  }

  return data;
};