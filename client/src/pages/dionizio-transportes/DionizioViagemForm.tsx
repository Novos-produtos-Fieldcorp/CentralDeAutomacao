import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Calculator } from 'lucide-react';
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

const STATUS = ['planejada', 'em_andamento', 'concluida', 'cancelada'];
const STATUS_LABEL: Record<string, string> = { planejada: 'Planejada', em_andamento: 'Em Andamento', concluida: 'Concluída', cancelada: 'Cancelada' };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  registro?: any | null;
}

const DionizioViagemForm: React.FC<Props> = ({ isOpen, onClose, onSaved, registro }) => {
  const { opcoes } = useDionizioOpcoes();
  const [form, setForm] = useState<any>(
    registro || {
      referencia: '',
      origem: '',
      destino: '',
      cliente_id: '',
      data_saida: '',
      data_retorno: '',
      horario_saida: '',
      horario_retorno: '',
      necessita_pernoite: false,
      veiculo_id: '',
      motorista_id: '',
      km_inicial: '',
      km_final: '',
      km_total_estimado: '',
      necessita_ajudante: false,
      base_frete: '',
      custo_ajudante: '',
      custo_pernoite: '',
      numero_pessoas: 1,
      entregas_estimadas: 0,
      entregas_realizadas: 0,
      observacoes: '',
      status: 'planejada',
      comprovante_canhoto_url: null,
    },
  );
  const [salvando, setSalvando] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const freteTotal = (Number(form.base_frete) || 0) + (Number(form.custo_ajudante) || 0) + (Number(form.custo_pernoite) || 0);

  const salvar = async () => {
    if (!form.origem || !form.data_saida || !form.data_retorno || !form.veiculo_id || !form.motorista_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      if (registro?.id) await dionizioApi.put(`/viagens/${registro.id}`, form);
      else await dionizioApi.post('/viagens', form);
      toast.success('Viagem salva com sucesso');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar viagem');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Cadastrar Nova Viagem" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Referência da Viagem</label>
            <input className={inputCls} placeholder="EX: VG-2026-001" value={form.referencia} onChange={(e) => set('referencia', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Cliente</label>
            <select className={inputCls} value={form.cliente_id || ''} onChange={(e) => set('cliente_id', e.target.value)}>
              <option value="">Selecione o cliente (opcional)</option>
              {opcoes.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Origem *</label>
            <input className={inputCls} placeholder="São Paulo, SP" value={form.origem} onChange={(e) => set('origem', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Destino</label>
            <input className={inputCls} placeholder="Rio de Janeiro, RJ" value={form.destino} onChange={(e) => set('destino', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data de Saída *</label>
            <input type="date" className={inputCls} value={form.data_saida} onChange={(e) => set('data_saida', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data de Retorno *</label>
            <input type="date" className={inputCls} value={form.data_retorno} onChange={(e) => set('data_retorno', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Horário de Saída</label>
            <input type="time" className={inputCls} value={form.horario_saida} onChange={(e) => set('horario_saida', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Horário de Retorno</label>
            <input type="time" className={inputCls} value={form.horario_retorno} onChange={(e) => set('horario_retorno', e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input id="necessita_pernoite" type="checkbox" checked={!!form.necessita_pernoite} onChange={(e) => set('necessita_pernoite', e.target.checked)} />
            <label htmlFor="necessita_pernoite" className="text-sm text-gray-700 dark:text-gray-300">
              Necessita Pernoite
            </label>
          </div>
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
            <label className={labelCls}>KM Inicial *</label>
            <input type="number" className={inputCls} value={form.km_inicial} onChange={(e) => set('km_inicial', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>KM Final *</label>
            <input type="number" className={inputCls} value={form.km_final} onChange={(e) => set('km_final', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>KM Total Estimado *</label>
            <input type="number" className={inputCls} value={form.km_total_estimado} onChange={(e) => set('km_total_estimado', e.target.value)} />
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white mb-3">
            <Calculator className="w-4 h-4 text-blue-600" /> Custos Extras
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input id="necessita_ajudante" type="checkbox" checked={!!form.necessita_ajudante} onChange={(e) => set('necessita_ajudante', e.target.checked)} />
              <label htmlFor="necessita_ajudante" className="text-sm text-gray-700 dark:text-gray-300">
                Necessita Ajudante
              </label>
            </div>
            <div />
            <div>
              <label className={labelCls}>Base de Frete</label>
              <input type="number" step="0.01" className={inputCls} placeholder="R$ 0,00" value={form.base_frete} onChange={(e) => set('base_frete', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Custo Ajudante</label>
              <input type="number" step="0.01" className={inputCls} placeholder="R$ 0,00" value={form.custo_ajudante} onChange={(e) => set('custo_ajudante', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Custo Pernoite</label>
              <input type="number" step="0.01" className={inputCls} placeholder="R$ 0,00" value={form.custo_pernoite} onChange={(e) => set('custo_pernoite', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Frete Total</label>
              <input className={readonlyCls} readOnly value={freteTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            </div>
            <div>
              <label className={labelCls}>Número de Pessoas *</label>
              <input type="number" min={1} className={inputCls} value={form.numero_pessoas} onChange={(e) => set('numero_pessoas', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Entregas Estimadas</label>
              <input type="number" min={0} className={inputCls} value={form.entregas_estimadas} onChange={(e) => set('entregas_estimadas', e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Observações</label>
          <textarea className={inputCls} rows={3} placeholder="Informações adicionais sobre a viagem..." value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Status *</label>
          <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <DionizioUploadField
          label="Comprovante do Canhoto"
          prefix="canhoto"
          accept="image/*,.pdf,.doc,.docx"
          value={form.comprovante_canhoto_url}
          onChange={(url) => set('comprovante_canhoto_url', url)}
        />

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full mt-2 px-4 py-2.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Cadastrar Viagem'}
        </button>
      </div>
    </BaseModal>
  );
};

export default DionizioViagemForm;
