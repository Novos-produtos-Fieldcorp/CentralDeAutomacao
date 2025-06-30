import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Search, Plus, Edit2, Trash2, X, AlertCircle, 
  Loader2, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp 
} from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import ScrollableTableIndicator from '../components/ScrollableTableIndicator';
import { formatCPF } from '../utils/format';

interface GRStatus {
  id: number;
  status: string;
}

interface GREmpresa {
  id: number;
  nome: string;
}

interface GRMotorista {
  id: number;
  motorista_id: number;
  empresa_id: number;
  status_id: number;
  motivo: string | null;
  created_at: string;
  updated_at: string;
  nome_motorista?: string;
  cpf?: string;
  empresa_nome?: string;
  status_nome?: string;
}

interface AddEmpresaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditEmpresaModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: GREmpresa | null;
  onSuccess: () => void;
}

interface DeleteEmpresaModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: GREmpresa | null;
  onConfirm: () => void;
}

interface AddMotoristaGRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  empresas: GREmpresa[];
  statuses: GRStatus[];
}

interface EditMotoristaGRModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: GRMotorista | null;
  onSuccess: () => void;
  empresas: GREmpresa[];
  statuses: GRStatus[];
}

interface DeleteMotoristaGRModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: GRMotorista | null;
  onConfirm: () => void;
}

// Add Empresa Modal Component
const AddEmpresaModal: React.FC<AddEmpresaModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [nome, setNome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('gr_empresa')
        .insert({ nome });

      if (error) throw error;

      toast.success('Empresa adicionada com sucesso');
      setNome('');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding empresa:', error);
      toast.error('Erro ao adicionar empresa');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Nova Empresa
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome da Empresa *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Empresa Modal Component
const EditEmpresaModal: React.FC<EditEmpresaModalProps> = ({ isOpen, onClose, empresa, onSuccess }) => {
  const [nome, setNome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (empresa) {
      setNome(empresa.nome);
    }
  }, [empresa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !empresa) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('gr_empresa')
        .update({ nome })
        .eq('id', empresa.id);

      if (error) throw error;

      toast.success('Empresa atualizada com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating empresa:', error);
      toast.error('Erro ao atualizar empresa');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !empresa) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Editar Empresa
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome da Empresa *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Delete Empresa Modal Component
const DeleteEmpresaModal: React.FC<DeleteEmpresaModalProps> = ({ isOpen, onClose, empresa, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    onConfirm();
  };

  if (!isOpen || !empresa) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="text-red-500" size={24} />
            Confirmar Exclusão
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Tem certeza que deseja excluir a empresa <span className="font-semibold">{empresa.nome}</span>? Esta ação não pode ser desfeita.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            Todos os registros de gestão de risco associados a esta empresa também serão excluídos.
          </p>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Motorista GR Modal Component
const AddMotoristaGRModal: React.FC<AddMotoristaGRModalProps> = ({ isOpen, onClose, onSuccess, empresas, statuses }) => {
  const [formData, setFormData] = useState({
    motorista_id: '',
    empresa_id: '',
    status_id: '',
    motivo: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchMotoristas();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.length >= 3) {
      searchMotoristas();
    }
  }, [searchTerm]);

  const fetchMotoristas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id, nome, cpf')
        .order('nome')
        .limit(100);

      if (error) throw error;
      setMotoristas(data || []);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const searchMotoristas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id, nome, cpf')
        .or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`)
        .order('nome')
        .limit(100);

      if (error) throw error;
      setMotoristas(data || []);
    } catch (error) {
      console.error('Error searching motoristas:', error);
      toast.error('Erro ao buscar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.motorista_id || !formData.empresa_id || !formData.status_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      
      // Check if motorista already has a GR record
      const { data: existingData, error: existingError } = await supabase
        .from('gr_motorista')
        .select('id')
        .eq('motorista_id', formData.motorista_id)
        .maybeSingle();
        
      if (existingError) throw existingError;
      
      if (existingData) {
        toast.error('Este motorista já possui um registro de gestão de risco');
        return;
      }

      const { error } = await supabase
        .from('gr_motorista')
        .insert({
          motorista_id: parseInt(formData.motorista_id),
          empresa_id: parseInt(formData.empresa_id),
          status_id: parseInt(formData.status_id),
          motivo: formData.motivo || null
        });

      if (error) throw error;

      toast.success('Registro de gestão de risco adicionado com sucesso');
      setFormData({
        motorista_id: '',
        empresa_id: '',
        status_id: '',
        motivo: ''
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding GR record:', error);
      toast.error('Erro ao adicionar registro de gestão de risco');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Novo Registro de Gestão de Risco
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motorista *
            </label>
            <div className="mb-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                {loading && (
                  <Loader2 className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 animate-spin" />
                )}
              </div>
            </div>
            <select
              name="motorista_id"
              value={formData.motorista_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Selecione um motorista</option>
              {motoristas.map(motorista => (
                <option key={motorista.motorista_id} value={motorista.motorista_id}>
                  {motorista.nome} - {formatCPF(motorista.cpf)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Empresa *
            </label>
            <select
              name="empresa_id"
              value={formData.empresa_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Selecione uma empresa</option>
              {empresas.map(empresa => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status *
            </label>
            <select
              name="status_id"
              value={formData.status_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Selecione um status</option>
              {statuses.map(status => (
                <option key={status.id} value={status.id}>
                  {status.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motivo
            </label>
            <textarea
              name="motivo"
              value={formData.motivo}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Motorista GR Modal Component
const EditMotoristaGRModal: React.FC<EditMotoristaGRModalProps> = ({ isOpen, onClose, motorista, onSuccess, empresas, statuses }) => {
  const [formData, setFormData] = useState({
    empresa_id: '',
    status_id: '',
    motivo: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (motorista) {
      setFormData({
        empresa_id: motorista.empresa_id.toString(),
        status_id: motorista.status_id.toString(),
        motivo: motorista.motivo || ''
      });
    }
  }, [motorista]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.empresa_id || !formData.status_id || !motorista) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('gr_motorista')
        .update({
          empresa_id: parseInt(formData.empresa_id),
          status_id: parseInt(formData.status_id),
          motivo: formData.motivo || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', motorista.id);

      if (error) throw error;

      toast.success('Registro de gestão de risco atualizado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating GR record:', error);
      toast.error('Erro ao atualizar registro de gestão de risco');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !motorista) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Editar Registro de Gestão de Risco
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motorista
            </label>
            <input
              type="text"
              value={motorista.nome_motorista || ''}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Empresa *
            </label>
            <select
              name="empresa_id"
              value={formData.empresa_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Selecione uma empresa</option>
              {empresas.map(empresa => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status *
            </label>
            <select
              name="status_id"
              value={formData.status_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Selecione um status</option>
              {statuses.map(status => (
                <option key={status.id} value={status.id}>
                  {status.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motivo
            </label>
            <textarea
              name="motivo"
              value={formData.motivo}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Delete Motorista GR Modal Component
const DeleteMotoristaGRModal: React.FC<DeleteMotoristaGRModalProps> = ({ isOpen, onClose, motorista, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    onConfirm();
  };

  if (!isOpen || !motorista) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="text-red-500" size={24} />
            Confirmar Exclusão
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Tem certeza que deseja excluir o registro de gestão de risco para <span className="font-semibold">{motorista.nome_motorista}</span>? Esta ação não pode ser desfeita.
          </p>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Component
const GestaoRisco = () => {
  const { companyId } = useCompanyData();
  const [activeTab, setActiveTab] = useState<'empresas' | 'motoristas'>('empresas');
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<GREmpresa[]>([]);
  const [motoristasGR, setMotoristasGR] = useState<GRMotorista[]>([]);
  const [statuses, setStatuses] = useState<GRStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Modal states
  const [isAddEmpresaModalOpen, setIsAddEmpresaModalOpen] = useState(false);
  const [isEditEmpresaModalOpen, setIsEditEmpresaModalOpen] = useState(false);
  const [isDeleteEmpresaModalOpen, setIsDeleteEmpresaModalOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<GREmpresa | null>(null);
  
  const [isAddMotoristaGRModalOpen, setIsAddMotoristaGRModalOpen] = useState(false);
  const [isEditMotoristaGRModalOpen, setIsEditMotoristaGRModalOpen] = useState(false);
  const [isDeleteMotoristaGRModalOpen, setIsDeleteMotoristaGRModalOpen] = useState(false);
  const [selectedMotoristaGR, setSelectedMotoristaGR] = useState<GRMotorista | null>(null);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchEmpresas(),
        fetchMotoristasGR(),
        fetchStatuses()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('gr_empresa')
        .select('*')
        .order('nome');

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error('Error fetching empresas:', error);
      toast.error('Erro ao carregar empresas');
    }
  };

  const fetchMotoristasGR = async () => {
    try {
      const { data, error } = await supabase
        .from('gr_motorista')
        .select(`
          *,
          motorista:motorista_id (
            nome,
            cpf
          ),
          empresa:empresa_id (
            nome
          ),
          status:status_id (
            status
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to include names
      const transformedData = (data || []).map(item => ({
        ...item,
        nome_motorista: item.motorista?.nome,
        cpf: item.motorista?.cpf,
        empresa_nome: item.empresa?.nome,
        status_nome: item.status?.status
      }));
      
      setMotoristasGR(transformedData);
    } catch (error) {
      console.error('Error fetching motoristas GR:', error);
      toast.error('Erro ao carregar registros de gestão de risco');
    }
  };

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('gr_status')
        .select('*')
        .order('status');

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
      toast.error('Erro ao carregar status');
    }
  };

  const handleDeleteEmpresa = async () => {
    if (!selectedEmpresa) return;
    
    try {
      const { error } = await supabase
        .from('gr_empresa')
        .delete()
        .eq('id', selectedEmpresa.id);

      if (error) throw error;

      toast.success('Empresa excluída com sucesso');
      fetchEmpresas();
      setIsDeleteEmpresaModalOpen(false);
    } catch (error) {
      console.error('Error deleting empresa:', error);
      toast.error('Erro ao excluir empresa');
    }
  };

  const handleDeleteMotoristaGR = async () => {
    if (!selectedMotoristaGR) return;
    
    try {
      const { error } = await supabase
        .from('gr_motorista')
        .delete()
        .eq('id', selectedMotoristaGR.id);

      if (error) throw error;

      toast.success('Registro de gestão de risco excluído com sucesso');
      fetchMotoristasGR();
      setIsDeleteMotoristaGRModalOpen(false);
    } catch (error) {
      console.error('Error deleting motorista GR:', error);
      toast.error('Erro ao excluir registro de gestão de risco');
    }
  };

  const toggleExpandRow = (id: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(id)) {
      newExpandedRows.delete(id);
    } else {
      newExpandedRows.add(id);
    }
    setExpandedRows(newExpandedRows);
  };

  const filteredMotoristas = motoristasGR.filter(motorista => {
    const searchLower = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      (motorista.nome_motorista && motorista.nome_motorista.toLowerCase().includes(searchLower)) ||
      (motorista.cpf && motorista.cpf.includes(searchTerm)) ||
      (motorista.empresa_nome && motorista.empresa_nome.toLowerCase().includes(searchLower)) ||
      (motorista.status_nome && motorista.status_nome.toLowerCase().includes(searchLower))
    );
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'Reprovado':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'Pendente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return <CheckCircle2 className="w-4 h-4 mr-1" />;
      case 'Reprovado':
        return <XCircle className="w-4 h-4 mr-1" />;
      case 'Pendente':
        return <AlertTriangle className="w-4 h-4 mr-1" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Gestão de Risco
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('empresas')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'empresas'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Empresas
            </button>
            <button
              onClick={() => setActiveTab('motoristas')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'motoristas'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Motoristas
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'empresas' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Empresas de Gestão de Risco
                </h2>
                <button
                  onClick={() => setIsAddEmpresaModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                           transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Nova Empresa
                </button>
              </div>

              <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div ref={tableContainerRef} className="overflow-x-auto w-full">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Nome
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {empresas.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                            Nenhuma empresa cadastrada
                          </td>
                        </tr>
                      ) : (
                        empresas.map(empresa => (
                          <tr key={empresa.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {empresa.nome}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end space-x-3">
                                <button
                                  onClick={() => {
                                    setSelectedEmpresa(empresa);
                                    setIsEditEmpresaModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedEmpresa(empresa);
                                    setIsDeleteEmpresaModalOpen(true);
                                  }}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <ScrollableTableIndicator containerRef={tableContainerRef} />
              </div>
            </div>
          )}

          {activeTab === 'motoristas' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Gestão de Risco - Motoristas
                </h2>
                <button
                  onClick={() => setIsAddMotoristaGRModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                           transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Novo Registro
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar por nome, CPF, empresa ou status..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div ref={tableContainerRef} className="overflow-x-auto w-full">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Motorista
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Empresa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredMotoristas.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                            Nenhum registro encontrado
                          </td>
                        </tr>
                      ) : (
                        filteredMotoristas.map(motorista => (
                          <React.Fragment key={motorista.id}>
                            <tr 
                              className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                                expandedRows.has(motorista.id) ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                              }`}
                              onClick={() => toggleExpandRow(motorista.id)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                      {motorista.nome_motorista?.charAt(0) || 'M'}
                                    </span>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {motorista.nome_motorista}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {motorista.cpf ? formatCPF(motorista.cpf) : ''}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900 dark:text-white">
                                  {motorista.empresa_nome}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  getStatusBadgeColor(motorista.status_nome || '')
                                }`}>
                                  {getStatusIcon(motorista.status_nome || '')}
                                  {motorista.status_nome}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMotoristaGR(motorista);
                                      setIsEditMotoristaGRModalOpen(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 size={18} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMotoristaGR(motorista);
                                      setIsDeleteMotoristaGRModalOpen(true);
                                    }}
                                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                  {expandedRows.has(motorista.id) ? (
                                    <ChevronUp 
                                      size={18} 
                                      className="text-gray-400"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpandRow(motorista.id);
                                      }}
                                    />
                                  ) : (
                                    <ChevronDown 
                                      size={18} 
                                      className="text-gray-400"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpandRow(motorista.id);
                                      }}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                            {expandedRows.has(motorista.id) && (
                              <tr className="bg-gray-50 dark:bg-gray-700/30">
                                <td colSpan={4} className="px-6 py-4">
                                  <div className="text-sm text-gray-900 dark:text-white">
                                    <div className="font-medium mb-2">Motivo:</div>
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                      {motorista.motivo || 'Nenhum motivo informado'}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <ScrollableTableIndicator containerRef={tableContainerRef} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddEmpresaModal
        isOpen={isAddEmpresaModalOpen}
        onClose={() => setIsAddEmpresaModalOpen(false)}
        onSuccess={fetchEmpresas}
      />

      <EditEmpresaModal
        isOpen={isEditEmpresaModalOpen}
        onClose={() => setIsEditEmpresaModalOpen(false)}
        empresa={selectedEmpresa}
        onSuccess={fetchEmpresas}
      />

      <DeleteEmpresaModal
        isOpen={isDeleteEmpresaModalOpen}
        onClose={() => setIsDeleteEmpresaModalOpen(false)}
        empresa={selectedEmpresa}
        onConfirm={handleDeleteEmpresa}
      />

      <AddMotoristaGRModal
        isOpen={isAddMotoristaGRModalOpen}
        onClose={() => setIsAddMotoristaGRModalOpen(false)}
        onSuccess={fetchMotoristasGR}
        empresas={empresas}
        statuses={statuses}
      />

      <EditMotoristaGRModal
        isOpen={isEditMotoristaGRModalOpen}
        onClose={() => setIsEditMotoristaGRModalOpen(false)}
        motorista={selectedMotoristaGR}
        onSuccess={fetchMotoristasGR}
        empresas={empresas}
        statuses={statuses}
      />

      <DeleteMotoristaGRModal
        isOpen={isDeleteMotoristaGRModalOpen}
        onClose={() => setIsDeleteMotoristaGRModalOpen(false)}
        motorista={selectedMotoristaGR}
        onConfirm={handleDeleteMotoristaGR}
      />
    </div>
  );
};

export default GestaoRisco;