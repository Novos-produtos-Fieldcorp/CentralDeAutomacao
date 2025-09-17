import { supabase } from './supabase';

export interface VagaWithRelations {
  id: number;
  nome: string;
  descricao: string;
  quantidade: number;
  dias_trabalho: string;
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

// Buscar vagas com dados relacionados para uma empresa
export const fetchVagasWithRelations = async (companyId: number): Promise<VagaWithRelations[]> => {
  try {
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