import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BaseModal } from '../../components/BaseModal';
import { dionizioApi } from './api';
import DionizioUploadField from './DionizioUploadField';

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const TIPOS_PAGAMENTO = ['Dinheiro', 'PIX', 'Cartão', 'Boleto', 'Transferência'];

interface Viagem {
  id: number;
  referencia: string | null;
  origem: string;
  destino: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  registro?: any | null;
  viagemIdFixo?: number | null;
}

const DionizioDescargaForm: React.FC<Props> = ({ isOpen, onClose, onSaved, registro, viagemIdFixo }) => {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [form, setForm] = useState<any>(
    registro || {
      viagem_id: viagemIdFixo || '',
      data_descarga: '',
      horario: '',
      local_descarga: '',
      tipo_carga: '',
      numero_carga: '',
      numero_nota: '',
      tipo_pagamento: '',
      valor_descarga: '',
      comprovante_pagamento_url: null,
      recibo_nota_fiscal_url: null,
      observacoes: '',
    },
  );
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    dionizioApi
      .get('/viagens')
      .then(setViagens)
      .catch(() => setViagens([]));
  }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.viagem_id || !form.data_descarga || !form.local_descarga || !form.tipo_carga || !form.valor_descarga) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      if (registro?.id) await dionizioApi.put(`/descargas/${registro.id}`, form);
      else await dionizioApi.post('/descargas', form);
      toast.success('Descarga cadastrada com sucesso');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao cadastrar descarga');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Nova Descarga/Entrega" size="lg">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Viagem *</label>
          <select className={inputCls} value={form.viagem_id} disabled={!!viagemIdFixo} onChange={(e) => set('viagem_id', e.target.value)}>
            <option value="">Selecione a viagem</option>
            {viagens.map((v) => (
              <option key={v.id} value={v.id}>
                {v.referencia || `#${v.id}`} — {v.origem} {v.destino ? `→ ${v.destino}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Data da Descarga *</label>
            <input type="date" className={inputCls} value={form.data_descarga} onChange={(e) => set('data_descarga', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Horário *</label>
            <input type="time" className={inputCls} value={form.horario} onChange={(e) => set('horario', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Local da Descarga *</label>
            <input className={inputCls} placeholder="Centro de Distribuição SP" value={form.local_descarga} onChange={(e) => set('local_descarga', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tipo de Carga *</label>
            <input className={inputCls} placeholder="Materiais de construção" value={form.tipo_carga} onChange={(e) => set('tipo_carga', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Número da Carga *</label>
            <input className={inputCls} placeholder="CG-2024-001" value={form.numero_carga} onChange={(e) => set('numero_carga', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Número da Nota *</label>
            <input className={inputCls} placeholder="NF-12345" value={form.numero_nota} onChange={(e) => set('numero_nota', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tipo de Pagamento *</label>
            <select className={inputCls} value={form.tipo_pagamento} onChange={(e) => set('tipo_pagamento', e.target.value)}>
              <option value="">Selecione o tipo de pagamento</option>
              {TIPOS_PAGAMENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Valor da Descarga *</label>
            <input type="number" step="0.01" className={inputCls} placeholder="R$ 0,00" value={form.valor_descarga} onChange={(e) => set('valor_descarga', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DionizioUploadField
            label="Comprovante de Pagamento (Foto)"
            prefix="descarga-comprovante"
            variant="camera"
            required
            value={form.comprovante_pagamento_url}
            onChange={(url) => set('comprovante_pagamento_url', url)}
          />
          <DionizioUploadField
            label="Recibo/Nota Fiscal (Foto)"
            prefix="descarga-recibo"
            variant="camera"
            required
            value={form.recibo_nota_fiscal_url}
            onChange={(url) => set('recibo_nota_fiscal_url', url)}
          />
        </div>

        <div>
          <label className={labelCls}>Observações</label>
          <textarea
            className={inputCls}
            rows={3}
            placeholder="Descreva detalhes sobre a descarga, ocorrências, etc."
            value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
          />
        </div>

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full mt-2 px-4 py-2.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Cadastrar Descarga'}
        </button>
      </div>
    </BaseModal>
  );
};

export default DionizioDescargaForm;
