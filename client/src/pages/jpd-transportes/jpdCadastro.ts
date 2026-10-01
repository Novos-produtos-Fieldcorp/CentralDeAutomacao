// Exclusão de cadastros mestres (placa em jpd_veiculos, motorista em motoristas_jpd).
// Se houver BVs ou lançamentos vinculados o backend responde 409 com a lista deles
// (VinculosError); o usuário então escolhe reatribuir ou excluir junto (AcaoExclusao).

export type Vinculos = { fretes: any[]; abastecimentos: any[] };

export type AcaoExclusao = { acao: 'reatribuir'; para: string } | { acao: 'excluir' };

export type TipoCadastro = 'placa' | 'motorista';

export class VinculosError extends Error {
  vinculos: Vinculos;
  tipo: TipoCadastro;
  /** Identificador usado na API: a placa (minúscula) ou o id do motorista. */
  id: string;
  constructor(message: string, vinculos: Vinculos, tipo: TipoCadastro, id: string) {
    super(message);
    this.vinculos = vinculos;
    this.tipo = tipo;
    this.id = id;
  }
}

/** `id`: a placa (minúscula) ou o id numérico do motorista (como string). */
export async function excluirCadastro(tipo: TipoCadastro, id: string, acao?: AcaoExclusao): Promise<void> {
  const base = tipo === 'placa' ? `/api/jpd/veiculos/${encodeURIComponent(id)}` : `/api/jpd/motoristas/${id}`;
  const params = new URLSearchParams();
  if (acao) {
    params.set('acao', acao.acao);
    if (acao.acao === 'reatribuir') params.set('para', acao.para);
  }
  const qs = params.toString();
  const res = await fetch(qs ? `${base}?${qs}` : base, { method: 'DELETE' });
  if (res.ok) return;
  const err = await res.json().catch(() => ({}));
  if (res.status === 409 && err.vinculos) throw new VinculosError(err.error, err.vinculos, tipo, id);
  throw new Error(err.error || `Falha ao excluir ${tipo === 'placa' ? 'placa' : 'motorista'}`);
}
