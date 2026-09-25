import React, { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtNum, capitalizeNome, fmtDataHoraBR } from './format';
import { SITUACAO_BV_OPTIONS } from './jpdEnums';
import { useVeiculos } from './useVeiculos';
import { useMotoristas } from './useMotoristas';
import JpdCreatableSelect, { Option } from './JpdCreatableSelect';

export type FieldType = 'text' | 'number' | 'date' | 'select';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
};

// Os 26 campos do exemplo.csv (na mesma ordem do arquivo)
export const FRETE_FIELDS: FieldDef[] = [
  { key: 'origem', label: 'Origem', type: 'text' },
  { key: 'destinatario', label: 'Destinatário', type: 'text' },
  { key: 'motorista', label: 'Motorista', type: 'select' },
  { key: 'placa_do_carro', label: 'Placa do carro', type: 'select' },
  { key: 'numero_do_bv', label: 'Número do BV', type: 'text' },
  { key: 'total_km', label: 'Total KM', type: 'number' },
  { key: 'data_do_bv', label: 'Data do BV', type: 'date' },
  { key: 'data_da_carga', label: 'Data da carga', type: 'date' },
  { key: 'data_da_descarga', label: 'Data da descarga', type: 'date' },
  { key: 'valor_do_frete', label: 'Valor do frete', type: 'number' },
  { key: 'outras_receitas', label: 'Outras receitas', type: 'number' },
  { key: 'abastecimento_pago_pela_jpd', label: 'Abastecimento pago pela JPD', type: 'number' },
  { key: 'abastecimento_descontado_do_frete', label: 'Abastecimento descontado do frete', type: 'number' },
  { key: 'demais_despesas', label: 'Demais despesas', type: 'number' },
  { key: 'seguros', label: 'Seguros', type: 'number' },
  { key: 'aluguel', label: 'Aluguel', type: 'number' },
  { key: 'pneus', label: 'Pneus', type: 'number' },
  { key: 'parcela_pneus', label: 'Parcela pneus', type: 'number' },
  { key: 'plano_manutencao_ipva', label: 'Plano manutenção + IPVA', type: 'number' },
  { key: 'faltas_em_litros', label: 'Faltas em litros', type: 'number' },
  { key: 'faltas_abonadas_rs', label: 'Faltas abonadas em R$', type: 'number' },
  { key: 'faltas_cobradas_rs', label: 'Faltas cobradas em R$', type: 'number' },
  { key: 'data_do_faturamento', label: 'Data do faturamento', type: 'date' },
  { key: 'valor_faturado', label: 'Valor faturado', type: 'number' },
  { key: 'numero_do_cte', label: 'Número do CTE', type: 'text' },
  {
    key: 'situacao_do_bv',
    label: 'Situação do BV',
    type: 'select',
    options: [...SITUACAO_BV_OPTIONS],
  },
];

// Campos de custo de abastecimento (preenchidos ao vincular um lançamento, ou manualmente)
export const CUSTO_FIELDS: FieldDef[] = [
  { key: 'fornecedor', label: 'Fornecedor', type: 'text' },
  { key: 'combustivel', label: 'Combustível', type: 'text' },
  { key: 'litros', label: 'Litros', type: 'number' },
  { key: 'valor_unitario', label: 'Valor Unitário', type: 'number' },
  { key: 'valor_bruto', label: 'Valor Bruto', type: 'number' },
  { key: 'desconto', label: 'Desconto', type: 'number' },
  { key: 'arla', label: 'Arla', type: 'number' },
];

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';

type Frete = Record<string, any>;

interface Props {
  companyId: number | null;
  initial?: Frete | null;
  onClose: () => void;
  onSaved: (saved: Frete) => void;
}

const toFormValue = (v: any) => (v === null || v === undefined ? '' : String(v));

// Converte o texto de um campo numérico para forma canônica (ponto decimal,
// sem separador de milhar) antes de enviar ao backend. Aceita tanto o formato
// canônico do OCR ("26580.89") quanto o pt-BR digitado/localizado ("26.580,89").
const toCanonicalNumber = (v: string): string => {
  if (v == null) return '';
  let s = String(v).trim();
  if (s === '') return '';
  // Remove tudo que não for dígito, separador ou sinal (ex.: "R$", espaços).
  s = s.replace(/[^\d.,-]/g, '');
  if (s === '') return '';
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // O separador que vem por último é o decimal; o outro é de milhar.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.'); // pt-BR: 26.580,89
    } else {
      s = s.replace(/,/g, ''); // en-US: 26,580.89
    }
  } else if (hasComma) {
    s = s.replace(',', '.'); // só vírgula = decimal
  }
  // só ponto (ou nenhum separador) já está em forma canônica.
  return s;
};

const ALL_FIELDS = [...FRETE_FIELDS, ...CUSTO_FIELDS];
const NUMERIC_KEYS = new Set(ALL_FIELDS.filter((f) => f.type === 'number').map((f) => f.key));

const JpdFreteForm: React.FC<Props> = ({ initial, onClose, onSaved }) => {
  const [fields, setFields] = useState<Frete>(() => {
    const init: Frete = {};
    for (const f of ALL_FIELDS) init[f.key] = toFormValue(initial?.[f.key]);
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [abastecimentos, setAbastecimentos] = useState<Frete[]>([]);
  const [observacoes, setObservacoes] = useState<{ id: number; observacao: string; created_at: string }[]>([]);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);
  const isEdit = !!initial?.id;
  const { placas, renomear: renomearPlacaLocal, remover: removerPlacaLocal } = useVeiculos();
  const { motoristas, renomear: renomearMotoristaLocal, remover: removerMotoristaLocal } = useMotoristas();

  const renomearPlaca = async (atual: string, novoTexto: string): Promise<Option> => {
    const res = await fetch(`/api/jpd/veiculos/${encodeURIComponent(atual)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa: novoTexto }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao renomear placa');
    }
    const data = await res.json();
    renomearPlacaLocal(atual, data.placa);
    return { value: data.placa, label: data.placa };
  };

  const removerPlaca = async (atual: string) => {
    const res = await fetch(`/api/jpd/veiculos/${encodeURIComponent(atual)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao excluir placa');
    }
    removerPlacaLocal(atual);
  };

  const renomearMotorista = async (nomeAtual: string, novoTexto: string): Promise<Option> => {
    const m = motoristas.find((x) => x.nome === nomeAtual);
    if (!m) throw new Error('Motorista não encontrado');
    const res = await fetch(`/api/jpd/motoristas/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novoTexto }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao renomear motorista');
    }
    const data = await res.json();
    renomearMotoristaLocal(m.id, data.nome);
    return { value: data.nome, label: capitalizeNome(data.nome) };
  };

  const removerMotorista = async (nomeAtual: string) => {
    const m = motoristas.find((x) => x.nome === nomeAtual);
    if (!m) throw new Error('Motorista não encontrado');
    const res = await fetch(`/api/jpd/motoristas/${m.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao excluir motorista');
    }
    removerMotoristaLocal(m.id);
  };

  // Abastecimentos vinculados a este BV (somente leitura).
  useEffect(() => {
    if (!initial?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/jpd/abastecimentos?frete_id=${initial.id}`);
        if (res.ok) setAbastecimentos(await res.json());
      } catch {
        /* ignora */
      }
    })();
  }, [initial?.id]);

  // Histórico de observações deste BV, mais recente primeiro.
  useEffect(() => {
    if (!initial?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/jpd/fretes/${initial.id}/observacoes`);
        if (res.ok) setObservacoes(await res.json());
      } catch {
        /* ignora */
      }
    })();
  }, [initial?.id]);

  const salvarObservacao = async () => {
    const texto = novaObservacao.trim();
    if (!texto || !initial?.id) return;
    setSalvandoObservacao(true);
    try {
      const res = await fetch(`/api/jpd/fretes/${initial.id}/observacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao: texto }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar observação');
      }
      const criada = await res.json();
      setObservacoes((prev) => [criada, ...prev]);
      setNovaObservacao('');
      toast.success('Observação salva');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar observação');
    } finally {
      setSalvandoObservacao(false);
    }
  };

  const num = (v: any) => (Number(v) || 0);
  const totais = abastecimentos.reduce(
    (acc, a) => ({
      litros: acc.litros + num(a.litros),
      valor_bruto: acc.valor_bruto + num(a.valor_bruto),
      desconto: acc.desconto + num(a.desconto),
      arla: acc.arla + num(a.arla),
    }),
    { litros: 0, valor_bruto: 0, desconto: 0, arla: 0 },
  );

  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const optionsFor = (f: FieldDef): string[] | null => f.options || null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEdit ? `/api/jpd/fretes/${initial!.id}` : '/api/jpd/fretes';
      const method = isEdit ? 'PUT' : 'POST';
      const payload: Frete = {};
      for (const k of Object.keys(fields)) {
        payload[k] = NUMERIC_KEYS.has(k) ? toCanonicalNumber(fields[k]) : fields[k];
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar');
      }
      const saved = await res.json();
      toast.success(isEdit ? 'Boletim atualizado' : 'Boletim criado');
      onSaved(saved);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f: FieldDef) => {
    // Placa e motorista têm cadastro rápido (+ Criar) e lápis/lixeira para
    // editar/excluir o registro mestre, igual ao fluxo de Lançamentos.
    if (f.key === 'placa_do_carro') {
      return (
        <label key={f.key} className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">{f.label}</span>
          <JpdCreatableSelect
            value={fields[f.key]}
            onChange={(v) => set(f.key, v)}
            options={placas}
            createLabel="+ Criar nova placa"
            newPlaceholder="Digite a nova placa"
            className={inputCls}
            uppercase
            onRename={renomearPlaca}
            onRemove={removerPlaca}
          />
        </label>
      );
    }
    if (f.key === 'motorista') {
      return (
        <label key={f.key} className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">{f.label}</span>
          <JpdCreatableSelect
            value={fields[f.key]}
            onChange={(v) => set(f.key, v)}
            options={motoristas.map((m) => ({ value: m.nome, label: capitalizeNome(m.nome) }))}
            createLabel="+ Criar novo motorista"
            newPlaceholder="Digite o nome do motorista"
            className={inputCls}
            onRename={renomearMotorista}
            onRemove={removerMotorista}
          />
        </label>
      );
    }

    let opts = optionsFor(f);
    const cur = fields[f.key];
    if (opts && cur && !opts.includes(cur)) opts = [...opts, cur];
    return (
      <label key={f.key} className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
        <span className="mb-1">{f.label}</span>
        {f.type === 'select' && opts ? (
          <select value={fields[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
            <option value="">—</option>
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={f.type === 'date' ? 'date' : 'text'}
            inputMode={f.type === 'number' ? 'decimal' : undefined}
            value={fields[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
            className={inputCls}
          />
        )}
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {isEdit ? `Editar BV #${initial!.id}` : 'Novo Boletim de Viagem'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FRETE_FIELDS.map(renderField)}
          </div>

          <h4 className="mt-6 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200 border-t border-gray-200 dark:border-gray-700 pt-4">
            Custos de abastecimento
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {CUSTO_FIELDS.map(renderField)}
          </div>

          {isEdit && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                Abastecimentos vinculados
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {abastecimentos.length}
                </span>
              </h4>
              {abastecimentos.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nenhum abastecimento vinculado a este BV. Vincule na aba Lançamentos.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Hodômetro</th>
                        <th className="px-3 py-2 text-left">Fornecedor</th>
                        <th className="px-3 py-2 text-left">Combustível</th>
                        <th className="px-3 py-2 text-right">Litros</th>
                        <th className="px-3 py-2 text-right">Valor bruto</th>
                        <th className="px-3 py-2 text-right">Desconto</th>
                        <th className="px-3 py-2 text-right">Arla</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-200">
                      {abastecimentos.map((a) => (
                        <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2 font-mono text-xs">#{a.id}</td>
                          <td className="px-3 py-2">{a.hodometro ?? '—'}</td>
                          <td className="px-3 py-2">{a.fornecedor ?? '—'}</td>
                          <td className="px-3 py-2">{a.combustivel ?? '—'}</td>
                          <td className="px-3 py-2 text-right">{fmtNum(a.litros)}</td>
                          <td className="px-3 py-2 text-right">{fmtNum(a.valor_bruto)}</td>
                          <td className="px-3 py-2 text-right">{fmtNum(a.desconto)}</td>
                          <td className="px-3 py-2 text-right">{fmtNum(a.arla)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="text-gray-800 dark:text-gray-100 font-semibold border-t-2 border-gray-200 dark:border-gray-600">
                      <tr>
                        <td className="px-3 py-2" colSpan={4}>Total</td>
                        <td className="px-3 py-2 text-right">{fmtNum(totais.litros)}</td>
                        <td className="px-3 py-2 text-right">{fmtNum(totais.valor_bruto)}</td>
                        <td className="px-3 py-2 text-right">{fmtNum(totais.desconto)}</td>
                        <td className="px-3 py-2 text-right">{fmtNum(totais.arla)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              Observação
              {observacoes.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {observacoes.length}
                </span>
              )}
            </h4>
            {isEdit ? (
              <>
                <textarea
                  value={novaObservacao}
                  onChange={(e) => setNovaObservacao(e.target.value)}
                  placeholder="Adicionar observação..."
                  rows={3}
                  className={`${inputCls} resize-y`}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={salvarObservacao}
                    disabled={salvandoObservacao || !novaObservacao.trim()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" /> {salvandoObservacao ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
                {observacoes.length > 0 && (
                  <ul className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                    {observacoes.map((o) => (
                      <li
                        key={o.id}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm"
                      >
                        <p className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{o.observacao}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fmtDataHoraBR(o.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Salve o boletim primeiro para poder adicionar observações.
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JpdFreteForm;
