import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export type FieldType = 'text' | 'number' | 'date' | 'select';

export type FieldDef = { key: string; label: string; type: FieldType; options?: string[] };

// Os 26 campos do exemplo.csv (na mesma ordem do arquivo)
export const FRETE_FIELDS: FieldDef[] = [
  { key: 'origem', label: 'Origem', type: 'text' },
  { key: 'destinatario', label: 'Destinatário', type: 'text' },
  { key: 'motorista', label: 'Motorista', type: 'text' },
  { key: 'placa_do_carro', label: 'Placa do carro', type: 'text' },
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
  { key: 'situacao_do_bv', label: 'Situação do BV', type: 'select', options: ['pago', 'pendente', 'em_analise'] },
];

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';

type Frete = Record<string, any>;

interface Props {
  companyId: number | null;
  initial?: Frete | null;
  onClose: () => void;
  onSaved: () => void;
}

const toFormValue = (v: any) => (v === null || v === undefined ? '' : String(v));

const JpdFreteForm: React.FC<Props> = ({ companyId, initial, onClose, onSaved }) => {
  const [fields, setFields] = useState<Frete>(() => {
    const init: Frete = {};
    for (const f of FRETE_FIELDS) init[f.key] = toFormValue(initial?.[f.key]);
    return init;
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error('Empresa não identificada');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/jpd/fretes/${initial!.id}` : '/api/jpd/fretes';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, company_id: companyId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar');
      }
      toast.success(isEdit ? 'Frete atualizado' : 'Frete criado');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {isEdit ? `Editar frete #${initial!.id}` : 'Novo frete'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FRETE_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
                <span className="mb-1">{f.label}</span>
                {f.type === 'select' ? (
                  <select value={fields[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {f.options!.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    step={f.type === 'number' ? 'any' : undefined}
                    value={fields[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={inputCls}
                  />
                )}
              </label>
            ))}
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
