import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { BaseModal } from '../../components/BaseModal';
import { dionizioApi } from './api';
import { useDionizioOpcoes } from './useDionizioOpcoes';
import { upperPlaca } from './format';

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  registro?: any | null;
}

const DionizioHotelForm: React.FC<Props> = ({ isOpen, onClose, onSaved, registro }) => {
  const { opcoes } = useDionizioOpcoes();
  const [form, setForm] = useState<any>(
    registro || {
      data: '',
      veiculo_id: '',
      motorista_id: '',
      local: '',
      nome_hotel: '',
      cnpj_hotel: '',
      quantidade_pessoas: 1,
      nome_ajudante: '',
      valor_hotel: '',
      observacoes: '',
    },
  );
  const [salvando, setSalvando] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.data || !form.veiculo_id || !form.motorista_id || !form.local || !form.nome_hotel || !form.valor_hotel) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      if (registro?.id) await dionizioApi.put(`/hoteis/${registro.id}`, form);
      else await dionizioApi.post('/hoteis', form);
      toast.success('Registro de hotel salvo com sucesso');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar registro de hotel');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Novo Registro de Hotel" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Data *</label>
            <input type="date" className={inputCls} value={form.data} onChange={(e) => set('data', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Veículo (Placa) *</label>
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
            <label className={labelCls}>Motorista *</label>
            <select className={inputCls} value={form.motorista_id} onChange={(e) => set('motorista_id', e.target.value)}>
              <option value="">Selecione o motorista</option>
              {opcoes.motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Local *</label>
            <input className={inputCls} placeholder="Cidade / Local" value={form.local} onChange={(e) => set('local', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Nome do Hotel *</label>
            <input className={inputCls} value={form.nome_hotel} onChange={(e) => set('nome_hotel', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CNPJ</label>
            <input className={inputCls} value={form.cnpj_hotel} onChange={(e) => set('cnpj_hotel', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Quantidade de Pessoas *</label>
            <input type="number" min={1} className={inputCls} value={form.quantidade_pessoas} onChange={(e) => set('quantidade_pessoas', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Nome do Ajudante *</label>
            <input className={inputCls} value={form.nome_ajudante} onChange={(e) => set('nome_ajudante', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Valor do Hotel *</label>
            <input type="number" step="0.01" className={inputCls} placeholder="R$ 0,00" value={form.valor_hotel} onChange={(e) => set('valor_hotel', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Observações</label>
          <textarea className={inputCls} rows={3} placeholder="Observações adicionais..." value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
        </div>

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

export default DionizioHotelForm;
