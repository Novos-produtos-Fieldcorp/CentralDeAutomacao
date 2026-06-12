// Acesso à tabela public.painel_blixx_grupos (Supabase) para o módulo
// "Painel de Controle Blixx". Os grupos são criados/gerenciados por nós;
// os contatos membros vêm do WiseApp/Chatwoot e ficam num snapshot JSONB.
import { supabase } from '../../../lib/supabase';
import type { Grupo, MembroGrupo } from './painelTypes';

interface GrupoRow {
  id: string;
  company_id: number | null;
  nome: string;
  contatos: MembroGrupo[] | null;
  created_at: string;
}

function fromRow(row: GrupoRow): Grupo {
  return {
    id: row.id,
    nome: row.nome,
    membros: Array.isArray(row.contatos) ? row.contatos : [],
    criadoEm: row.created_at,
  };
}

export async function buscarGrupos(companyId: number | null): Promise<Grupo[]> {
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('painel_blixx_grupos')
    .select('id, company_id, nome, contatos, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as GrupoRow[]).map(fromRow);
}

export async function criarGrupo(
  companyId: number | null,
  nome: string,
  membros: MembroGrupo[],
): Promise<Grupo> {
  if (!companyId) throw new Error('company_id ausente');
  const { data, error } = await supabase
    .from('painel_blixx_grupos')
    .insert({ company_id: companyId, nome, contatos: membros })
    .select('id, company_id, nome, contatos, created_at')
    .single();
  if (error) throw error;
  return fromRow(data as GrupoRow);
}

export async function removerGrupo(id: string): Promise<void> {
  const { error } = await supabase.from('painel_blixx_grupos').delete().eq('id', id);
  if (error) throw error;
}
