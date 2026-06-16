import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import BlixxFileField from './BlixxFileField';

interface BlixxAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: number | null;
  /** motorista_blixx_id quando editando; ausente = criar. */
  motoristaId?: number | null;
}

const ST_CADASTRO_OPTIONS = [
  'Cadastrado',
  'qualificado',
  'documentacao',
  'contrato_enviado',
  'contratado',
  'repescagem',
  'gestao_risco',
  'rejeitado',
];

const EMPTY = {
  nome: '',
  cpf: '',
  dt_nascimento: '',
  genero: '',
  telefone: '',
  email: '',
  funcao: 'Agregado',
  st_cadastro: 'Cadastrado',
  ativo: true,
  // documentos
  cnh: '',
  comprovante_residencia: '',
  certificado_tdd: '',
  certificado_tar: '',
  exame_toxicologico: '',
  // contato de emergencia
  nome_contato_emergencia: '',
  telefone_contato_emergencia: '',
  parentesco_contato_emergencia: '',
};

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const BlixxAgregadoModal: React.FC<BlixxAgregadoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  motoristaId,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY });
  const isEdit = !!motoristaId;

  useEffect(() => {
    if (!isOpen) return;
    if (!motoristaId) {
      setFormData({ ...EMPTY });
      return;
    }
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('motorista_blixx')
        .select('*')
        .eq('motorista_blixx_id', motoristaId)
        .maybeSingle();
      if (error) {
        toast.error('Erro ao carregar agregado');
      } else if (data) {
        setFormData({
          ...EMPTY,
          ...data,
          telefone: data.telefone != null ? String(data.telefone) : '',
          dt_nascimento: data.dt_nascimento ?? '',
        });
      }
      setLoading(false);
    };
    load();
  }, [isOpen, motoristaId]);

  const set = (patch: Partial<typeof EMPTY>) => setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const telefoneDigits = formData.telefone.replace(/\D/g, '');
      const payload = {
        ...formData,
        telefone: telefoneDigits ? Number(telefoneDigits) : null,
        dt_nascimento: formData.dt_nascimento || null,
        company_id: companyId,
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase
          .from('motorista_blixx')
          .update(payload)
          .eq('motorista_blixx_id', motoristaId);
        if (error) throw error;
        toast.success('Agregado atualizado com sucesso');
      } else {
        const { error } = await supabase.from('motorista_blixx').insert(payload);
        if (error) throw error;
        toast.success('Agregado cadastrado com sucesso');
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar agregado blixx:', error);
      toast.error('Erro ao salvar agregado');
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
            {isEdit ? 'Editar Agregado' : 'Adicionar Agregado'} (Blixx)
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados pessoais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Nome *</label><input type="text" value={formData.nome} onChange={(e) => set({ nome: e.target.value })} className={inputCls} required /></div>
            <div><label className={labelCls}>CPF *</label><input type="text" value={formData.cpf} onChange={(e) => set({ cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })} className={inputCls} required /></div>
            <div><label className={labelCls}>Data de nascimento</label><input type="date" value={formData.dt_nascimento} onChange={(e) => set({ dt_nascimento: e.target.value })} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Gênero</label>
              <select value={formData.genero} onChange={(e) => set({ genero: e.target.value })} className={inputCls}>
                <option value="">Selecione</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div><label className={labelCls}>Telefone</label><input type="text" value={formData.telefone} onChange={(e) => set({ telefone: e.target.value })} className={inputCls} placeholder="5511999999999" /></div>
            <div><label className={labelCls}>Email</label><input type="email" value={formData.email} onChange={(e) => set({ email: e.target.value })} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Status do cadastro</label>
              <select value={formData.st_cadastro} onChange={(e) => set({ st_cadastro: e.target.value })} className={inputCls}>
                {ST_CADASTRO_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 self-end pb-2">
              <input type="checkbox" checked={formData.ativo} onChange={(e) => set({ ativo: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span>Ativo (contratado)</span>
            </label>
          </div>

          {/* Documentos */}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <legend className="px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Documentos</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BlixxFileField field="cnh" prefix={formData.cpf || companyId || ''} label="CNH" value={formData.cnh} onChange={(url) => set({ cnh: url })} />
              <BlixxFileField field="comprovante_residencia" prefix={formData.cpf || companyId || ''} label="Comprovante de residência" value={formData.comprovante_residencia} onChange={(url) => set({ comprovante_residencia: url })} />
              <BlixxFileField field="certificado_tdd" prefix={formData.cpf || companyId || ''} label="Certificado TDD" value={formData.certificado_tdd} onChange={(url) => set({ certificado_tdd: url })} />
              <BlixxFileField field="certificado_tar" prefix={formData.cpf || companyId || ''} label="Certificado TAR" value={formData.certificado_tar} onChange={(url) => set({ certificado_tar: url })} />
              <BlixxFileField field="exame_toxicologico" prefix={formData.cpf || companyId || ''} label="Exame toxicológico" value={formData.exame_toxicologico} onChange={(url) => set({ exame_toxicologico: url })} />
            </div>
          </fieldset>

          {/* Contato de emergência */}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <legend className="px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Contato de emergência</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={labelCls}>Nome</label><input type="text" value={formData.nome_contato_emergencia} onChange={(e) => set({ nome_contato_emergencia: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Telefone</label><input type="text" value={formData.telefone_contato_emergencia} onChange={(e) => set({ telefone_contato_emergencia: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Parentesco</label><input type="text" value={formData.parentesco_contato_emergencia} onChange={(e) => set({ parentesco_contato_emergencia: e.target.value })} className={inputCls} /></div>
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

export default BlixxAgregadoModal;
