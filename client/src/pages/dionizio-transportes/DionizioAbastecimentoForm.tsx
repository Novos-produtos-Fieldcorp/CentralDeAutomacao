import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { BaseModal } from '../../components/BaseModal';
import { dionizioApi } from './api';
import { useDionizioOpcoes } from './useDionizioOpcoes';
import DionizioUploadField from './DionizioUploadField';
import { upperPlaca } from './format';

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';
const readonlyCls =
  'border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 w-full';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const TIPOS_COMBUSTIVEL = ['Diesel S10', 'Diesel Comum', 'Arla', 'Gasolina', 'Etanol'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  registro?: any | null;
}

const DionizioAbastecimentoForm: React.FC<Props> = ({ isOpen, onClose, onSaved, registro }) => {
  const { opcoes } = useDionizioOpcoes();
  const [form, setForm] = useState<any>(
    registro || {
      veiculo_id: '',
      data_abastecimento: '',
      tipo_combustivel: TIPOS_COMBUSTIVEL[0],
      quilometragem_atual: '',
      litros: '',
      valor_total: '',
      local_abastecimento: '',
      nota_fiscal_url: null,
    },
  );
  const [salvando, setSalvando] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const precoPorLitro = Number(form.litros) > 0 ? Number(form.valor_total) / Number(form.litros) : null;

  const salvar = async () => {
    if (!form.veiculo_id || !form.data_abastecimento || !form.quilometragem_atual || !form.litros || !form.valor_total || !form.local_abastecimento || !form.nota_fiscal_url) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      if (registro?.id) await dionizioApi.put(`/abastecimentos/${registro.id}`, form);
      else await dionizioApi.post('/abastecimentos', form);
      toast.success('Abastecimento salvo com sucesso');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar abastecimento');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Cadastrar Novo Abastecimento" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Placa do Veículo *</label>
            <select className={inputCls} value={form.veiculo_id} onChange={(e) => set('veiculo_id', e.target.value)}>
              <option value="">Selecione o veículo</option>
              {opcoes.veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {upperPlaca(v.placa)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data do Abastecimento *</label>
            <input type="date" className={inputCls} value={form.data_abastecimento} onChange={(e) => set('data_abastecimento', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tipo de Combustível</label>
            <select className={inputCls} value={form.tipo_combustivel} onChange={(e) => set('tipo_combustivel', e.target.value)}>
              {TIPOS_COMBUSTIVEL.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Quilometragem Atual (Km) *</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Informe a quilometragem do veículo no momento do abastecimento"
              value={form.quilometragem_atual}
              onChange={(e) => set('quilometragem_atual', e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Litros *</label>
            <input type="number" step="0.01" className={inputCls} placeholder="0.00" value={form.litros} onChange={(e) => set('litros', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Valor Total (R$) *</label>
            <input type="number" step="0.01" className={inputCls} placeholder="0,00" value={form.valor_total} onChange={(e) => set('valor_total', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Preço por Litro</label>
            <input className={readonlyCls} readOnly value={precoPorLitro != null ? precoPorLitro.toFixed(3) : '—'} />
          </div>
          <div>
            <label className={labelCls}>Média por Km</label>
            <input className={readonlyCls} readOnly value="Calculado automaticamente" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Local do Abastecimento *</label>
            <input className={inputCls} placeholder="Ex: Posto Shell - Av. Paulista" value={form.local_abastecimento} onChange={(e) => set('local_abastecimento', e.target.value)} />
          </div>
        </div>

        <DionizioUploadField
          label="Nota Fiscal (NFe)"
          required
          prefix="abastecimento-nfe"
          value={form.nota_fiscal_url}
          onChange={(url) => set('nota_fiscal_url', url)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default DionizioAbastecimentoForm;
