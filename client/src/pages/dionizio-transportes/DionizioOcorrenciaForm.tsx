import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Loader2, X } from 'lucide-react';
import { BaseModal } from '../../components/BaseModal';
import { dionizioApi } from './api';
import { useDionizioOpcoes } from './useDionizioOpcoes';
import { uploadToDionizioBucket } from './upload';
import { upperPlaca } from './format';

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const TIPOS_EVENTO = ['Avaria', 'Acidente', 'Multa', 'Manutenção'];
const GRAVIDADES = ['baixa', 'media', 'alta'];
const STATUS = ['pendente', 'em_andamento', 'resolvido'];
const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em Andamento', resolvido: 'Resolvido' };
const GRAVIDADE_LABEL: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  registro?: any | null;
}

const DionizioOcorrenciaForm: React.FC<Props> = ({ isOpen, onClose, onSaved, registro }) => {
  const { opcoes } = useDionizioOpcoes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [form, setForm] = useState<any>(
    registro || {
      tipo_evento: TIPOS_EVENTO[0],
      data: '',
      veiculo_id: '',
      gravidade: 'media',
      status: 'pendente',
      descricao_detalhada: '',
      observacoes_gerais: '',
      fotos: [] as string[],
    },
  );
  const [salvando, setSalvando] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const adicionarFotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setEnviandoFoto(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadToDionizioBucket(file, 'ocorrencia'));
      }
      set('fotos', [...(form.fotos || []), ...urls]);
      toast.success('Fotos enviadas');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar fotos');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFoto = (url: string) => set('fotos', (form.fotos || []).filter((f: string) => f !== url));

  const salvar = async () => {
    if (!form.tipo_evento || !form.data || !form.descricao_detalhada) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      if (registro?.id) await dionizioApi.put(`/ocorrencias/${registro.id}`, form);
      else await dionizioApi.post('/ocorrencias', form);
      toast.success('Evento registrado com sucesso');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar evento');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Registrar Novo Evento" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tipo de Evento</label>
            <select className={inputCls} value={form.tipo_evento} onChange={(e) => set('tipo_evento', e.target.value)}>
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data</label>
            <input type="date" className={inputCls} value={form.data} onChange={(e) => set('data', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Placa do Veículo</label>
            <select className={inputCls} value={form.veiculo_id || ''} onChange={(e) => set('veiculo_id', e.target.value)}>
              <option value="">Selecione o veículo</option>
              {opcoes.veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {upperPlaca(v.placa)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Gravidade</label>
            <select className={inputCls} value={form.gravidade} onChange={(e) => set('gravidade', e.target.value)}>
              {GRAVIDADES.map((g) => (
                <option key={g} value={g}>
                  {GRAVIDADE_LABEL[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Descrição Detalhada</label>
          <textarea className={inputCls} rows={3} placeholder="Descreva o evento de forma detalhada..." value={form.descricao_detalhada} onChange={(e) => set('descricao_detalhada', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Observações Gerais (opcional)</label>
          <textarea className={inputCls} rows={2} placeholder="Observações adicionais..." value={form.observacoes_gerais} onChange={(e) => set('observacoes_gerais', e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Fotos do Evento</label>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => adicionarFotos(e.target.files)} />
          <div
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md py-6 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400"
          >
            {enviandoFoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            <span>{enviandoFoto ? 'Enviando...' : 'Clique para adicionar fotos ou arraste aqui'}</span>
          </div>
          {form.fotos?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {form.fotos.map((url: string) => (
                <div key={url} className="relative">
                  <img src={url} alt="Foto do evento" className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-600" />
                  <button
                    type="button"
                    onClick={() => removerFoto(url)}
                    className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60">
            {salvando ? 'Salvando...' : 'Registrar Evento'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default DionizioOcorrenciaForm;
