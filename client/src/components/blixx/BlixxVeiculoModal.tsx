import React, { useEffect, useState } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { VEHICLE_TYPES } from '../../constants/vehicleTypes';
import toast from 'react-hot-toast';
import { consultarPlacaApi, validarPlaca, formatarPlaca } from '../../utils/placaService';
import BlixxFileField from './BlixxFileField';

interface BlixxMotoristaOption {
  motorista_blixx_id: number;
  nome: string;
  cpf?: string | null;
}

interface BlixxVeiculoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: number | null;
  motoristas?: BlixxMotoristaOption[];
  /** veiculo_blixx_id quando editando; ausente = criar. */
  veiculoId?: number | null;
}

const EMPTY = {
  placa: '',
  marca: '',
  tipo: '',
  ano: '',
  cor: '',
  tipologia: '',
  combustivel: '',
  peso: '',
  cubagem: '',
  bau: '',
  motorista_blixx_id: '' as string,
  // rastreamento
  possui_rastreador: false,
  marca_rastreador: '',
  marca_rastreador_principal: '',
  id_rastreador_principal: '',
  id_rastreador_3s: '',
  id_rastreador_t4s: '',
  possui_omnilink: false,
  ficha_ativacao_omnilink: '',
  // documentos / proprietario
  crlv: '',
  antt: '',
  documento_proprietario: '',
  nome_proprietario: '',
  telefone_proprietario: '',
  // seguranca
  telas_janela: '',
  trava_bau_traseiro: '',
  bloqueio_porta_lateral: '',
  possui_protetor_estribo: false,
  protetor_estribo: '',
  possui_trava_quinta_roda: false,
  trava_quinta_roda: '',
  veiculo_blindado: false,
};

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const BlixxVeiculoModal: React.FC<BlixxVeiculoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  motoristas = [],
  veiculoId,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consultingPlaca, setConsultingPlaca] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY });
  const isEdit = !!veiculoId;

  useEffect(() => {
    if (!isOpen) return;
    if (!veiculoId) {
      setFormData({ ...EMPTY });
      return;
    }
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('veiculo_blixx')
        .select('*')
        .eq('veiculo_blixx_id', veiculoId)
        .maybeSingle();
      if (error) {
        toast.error('Erro ao carregar veículo');
      } else if (data) {
        setFormData({
          ...EMPTY,
          ...data,
          ano: data.ano ?? '',
          motorista_blixx_id: data.motorista_blixx_id ? String(data.motorista_blixx_id) : '',
        });
      }
      setLoading(false);
    };
    load();
  }, [isOpen, veiculoId]);

  const set = (patch: Partial<typeof EMPTY>) => setFormData((prev) => ({ ...prev, ...patch }));

  const consultarPlacaLocal = async (placa: string) => {
    if (!placa || !validarPlaca(placa)) {
      toast.error('Formato de placa inválido');
      return;
    }
    setConsultingPlaca(true);
    try {
      const data = await consultarPlacaApi(placa);
      set({
        placa: formatarPlaca(data.placa || formData.placa),
        marca: data.marca || formData.marca,
        tipo: data.modelo || formData.tipo,
        ano: data.ano || formData.ano,
        cor: data.cor || formData.cor,
        combustivel: data.combustivel || formData.combustivel,
      });
      toast.success('Dados da placa preenchidos!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar placa');
    } finally {
      setConsultingPlaca(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const placaFormatada = formData.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');

      const payload = {
        ...formData,
        placa: placaFormatada,
        tipologia: formData.tipologia.toUpperCase(),
        motorista_blixx_id: formData.motorista_blixx_id ? Number(formData.motorista_blixx_id) : null,
        company_id: companyId,
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase
          .from('veiculo_blixx')
          .update(payload)
          .eq('veiculo_blixx_id', veiculoId);
        if (error) throw error;
        toast.success('Veículo atualizado com sucesso');
      } else {
        const { data: existing, error: checkError } = await supabase
          .from('veiculo_blixx')
          .select('veiculo_blixx_id')
          .eq('placa', placaFormatada)
          .eq('company_id', companyId)
          .maybeSingle();
        if (checkError) throw checkError;
        if (existing) {
          toast.error(`Já existe um veículo cadastrado com a placa ${placaFormatada}`);
          setSubmitting(false);
          return;
        }
        const { error } = await supabase
          .from('veiculo_blixx')
          .insert({ ...payload, status_veiculo: true });
        if (error) throw error;
        toast.success('Veículo cadastrado com sucesso');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar veículo blixx:', error);
      toast.error('Erro ao salvar veículo');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Editar Veículo' : 'Adicionar Veículo'} (Blixx)
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Placa *</label>
              <div className="relative flex">
                <input
                  type="text"
                  value={formData.placa}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    set({ placa: value });
                    if (value.length === 7 && validarPlaca(value)) consultarPlacaLocal(value);
                  }}
                  className={inputCls.replace('rounded-lg', 'rounded-l-lg flex-1')}
                  placeholder="ABC1234"
                  required
                  maxLength={7}
                />
                <button
                  type="button"
                  onClick={() => consultarPlacaLocal(formData.placa)}
                  disabled={consultingPlaca || !validarPlaca(formData.placa)}
                  className="px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg bg-gray-50 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 disabled:opacity-50"
                  title="Consultar dados da placa"
                >
                  {consultingPlaca ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Marca</label>
              <input type="text" value={formData.marca} onChange={(e) => set({ marca: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Modelo</label>
              <input type="text" value={formData.tipo} onChange={(e) => set({ tipo: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ano</label>
              <input type="text" value={formData.ano} onChange={(e) => set({ ano: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={inputCls} maxLength={4} />
            </div>
            <div>
              <label className={labelCls}>Cor</label>
              <input type="text" value={formData.cor} onChange={(e) => set({ cor: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipologia *</label>
              <select value={formData.tipologia} onChange={(e) => set({ tipologia: e.target.value })} className={inputCls} required>
                <option value="">Selecione um tipo</option>
                {VEHICLE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Combustível</label>
              <input type="text" value={formData.combustivel} onChange={(e) => set({ combustivel: e.target.value.toUpperCase() })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Peso (kg)</label>
              <input type="text" value={formData.peso} onChange={(e) => set({ peso: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cubagem (m³)</label>
              <input type="text" value={formData.cubagem} onChange={(e) => set({ cubagem: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Baú</label>
              <input type="text" value={formData.bau} onChange={(e) => set({ bau: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Agregado</label>
              <select value={formData.motorista_blixx_id} onChange={(e) => set({ motorista_blixx_id: e.target.value })} className={inputCls}>
                <option value="">Selecione um agregado</option>
                {motoristas.map((m) => (
                  <option key={m.motorista_blixx_id} value={m.motorista_blixx_id}>
                    {m.nome}{m.cpf ? ` - ${m.cpf}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 self-end pb-2">
              <input type="checkbox" checked={formData.veiculo_blindado} onChange={(e) => set({ veiculo_blindado: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span>Veículo blindado</span>
            </label>
          </div>

          {/* Rastreamento */}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <legend className="px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Rastreamento</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={formData.possui_rastreador} onChange={(e) => set({ possui_rastreador: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>Possui rastreador</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={formData.possui_omnilink} onChange={(e) => set({ possui_omnilink: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>Possui OMNILINK</span>
              </label>
              <div><label className={labelCls}>Marca do rastreador</label><input type="text" value={formData.marca_rastreador} onChange={(e) => set({ marca_rastreador: e.target.value.toUpperCase() })} className={inputCls} /></div>
              <div><label className={labelCls}>Marca rastreador principal</label><input type="text" value={formData.marca_rastreador_principal} onChange={(e) => set({ marca_rastreador_principal: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>ID rastreador principal</label><input type="text" value={formData.id_rastreador_principal} onChange={(e) => set({ id_rastreador_principal: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>ID rastreador 3S</label><input type="text" value={formData.id_rastreador_3s} onChange={(e) => set({ id_rastreador_3s: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>ID rastreador T4S</label><input type="text" value={formData.id_rastreador_t4s} onChange={(e) => set({ id_rastreador_t4s: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Ficha ativação OMNILINK</label><input type="text" value={formData.ficha_ativacao_omnilink} onChange={(e) => set({ ficha_ativacao_omnilink: e.target.value })} className={inputCls} /></div>
            </div>
          </fieldset>

          {/* Documentos / proprietário */}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <legend className="px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Documentos e proprietário</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Nome do proprietário</label><input type="text" value={formData.nome_proprietario} onChange={(e) => set({ nome_proprietario: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Telefone do proprietário</label><input type="text" value={formData.telefone_proprietario} onChange={(e) => set({ telefone_proprietario: e.target.value })} className={inputCls} /></div>
              <BlixxFileField field="crlv" prefix={formData.placa || companyId || ''} label="CRLV" value={formData.crlv} onChange={(url) => set({ crlv: url })} />
              <BlixxFileField field="antt" prefix={formData.placa || companyId || ''} label="ANTT" value={formData.antt} onChange={(url) => set({ antt: url })} />
              <BlixxFileField field="doc_proprietario" prefix={formData.placa || companyId || ''} label="Documento do proprietário" value={formData.documento_proprietario} onChange={(url) => set({ documento_proprietario: url })} />
            </div>
          </fieldset>

          {/* Segurança */}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <legend className="px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Itens de segurança</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={formData.possui_protetor_estribo} onChange={(e) => set({ possui_protetor_estribo: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>Possui protetor de estribo</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={formData.possui_trava_quinta_roda} onChange={(e) => set({ possui_trava_quinta_roda: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>Possui trava da quinta roda</span>
              </label>
              <BlixxFileField field="telas_janela" prefix={formData.placa || companyId || ''} label="Telas/janela" value={formData.telas_janela} onChange={(url) => set({ telas_janela: url })} />
              <BlixxFileField field="trava_bau_traseiro" prefix={formData.placa || companyId || ''} label="Trava baú traseiro" value={formData.trava_bau_traseiro} onChange={(url) => set({ trava_bau_traseiro: url })} />
              <BlixxFileField field="bloqueio_porta_lateral" prefix={formData.placa || companyId || ''} label="Bloqueio porta lateral" value={formData.bloqueio_porta_lateral} onChange={(url) => set({ bloqueio_porta_lateral: url })} />
              <BlixxFileField field="protetor_estribo" prefix={formData.placa || companyId || ''} label="Protetor de estribo" value={formData.protetor_estribo} onChange={(url) => set({ protetor_estribo: url })} />
              <BlixxFileField field="trava_quinta_roda" prefix={formData.placa || companyId || ''} label="Trava da quinta roda" value={formData.trava_quinta_roda} onChange={(url) => set({ trava_quinta_roda: url })} />
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">Cancelar</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Salvando...</> : 'Salvar'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default BlixxVeiculoModal;
