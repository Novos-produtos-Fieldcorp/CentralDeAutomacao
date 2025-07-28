import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, Check, X, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface GestaoRisco {
  id: number;
  motorista_id: number;
  empresa_id: number;
  status_id: number;
  motivo: string | null;
  empresa?: {
    id: number;
    nome: string;
  };
  status?: {
    id: number;
    status: string;
  };
  created_at: string;
  updated_at: string;
}

interface GestaoRiscoTabProps {
  motorista_id: number;
  gr_motorista_id?: number | null;
  gr_motorista_motivo?: string | null;
  empresa_motorista?: string | null;
  status_motorista?: string | null;
  onUpdateSuccess?: () => void;
}

interface Empresa {
  id: number;
  nome: string;
}

interface Status {
  id: number;
  status: string;
}

const GestaoRiscoTab: React.FC<GestaoRiscoTabProps> = ({
  motorista_id,
  onUpdateSuccess
}) => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newEmpresaModalOpen, setNewEmpresaModalOpen] = useState(false);
  const [newEmpresaNome, setNewEmpresaNome] = useState('');
  const [creatingEmpresa, setCreatingEmpresa] = useState(false);
  const [newStatusModalOpen, setNewStatusModalOpen] = useState(false);
  const [newStatusNome, setNewStatusNome] = useState('');
  const [creatingStatus, setCreatingStatus] = useState(false);
  const [gestoesRisco, setGestoesRisco] = useState<GestaoRisco[]>([]);
  const [currentGestao, setCurrentGestao] = useState<GestaoRisco | null>(null);

  const [formData, setFormData] = useState<{
    empresa_id: string;
    status_id: string;
    motivo: string;
  }>({
    empresa_id: '',
    status_id: '',
    motivo: ''
  });

  const openAddModal = () => {
    setCurrentGestao(null);
    setFormData({
      empresa_id: '',
      status_id: '',
      motivo: ''
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (gestao: GestaoRisco) => {
    setCurrentGestao(gestao);
    setFormData({
      empresa_id: gestao.empresa_id.toString(),
      status_id: gestao.status_id.toString(),
      motivo: gestao.motivo || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (gestao: GestaoRisco) => {
    setCurrentGestao(gestao);
    setIsDeleteModalOpen(true);
  };

  useEffect(() => {
    fetchGestoesRisco();
  }, [motorista_id]);

  useEffect(() => {
    fetchGestoesRisco();
  }, [motorista_id]);

  const fetchGestoesRisco = async () => {
    try {
      setLoading(true);
      
      // Fetch empresas
      const { data: empresasData, error: empresasError } = await supabase
        .from('gr_empresa')
        .select('*')
        .order('nome');
      
      if (empresasError) throw empresasError;
      setEmpresas(empresasData || []);
      
      // Fetch statuses
      const { data: statusesData, error: statusesError } = await supabase
        .from('gr_status')
        .select('*')
        .order('status');
      
      if (statusesError) throw statusesError;
      setStatuses(statusesData || []);
      
      // Fetch gestões de risco do motorista
      const { data: gestoesData, error: gestoesError } = await supabase
        .from('gr_motorista')
        .select(`
          *,
          empresa:empresa_id(id, nome),
          status:status_id(id, status)
        `)
        .eq('motorista_id', motorista_id)
        .order('created_at', { ascending: false });
        
      if (gestoesError) throw gestoesError;
      
      setGestoesRisco(gestoesData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmpresa = async () => {
    if (!newEmpresaNome.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }
    
    try {
      setCreatingEmpresa(true);
      
      const { data, error } = await supabase
        .from('gr_empresa')
        .insert({ nome: newEmpresaNome.trim() })
        .select()
        .single();
      
      if (error) throw error;
      
      setEmpresas([...empresas, data]);
      setNewEmpresaNome('');
      setNewEmpresaModalOpen(false);
      toast.success('Empresa adicionada com sucesso');
    } catch (error) {
      console.error('Error adding empresa:', error);
      toast.error('Erro ao adicionar empresa');
    } finally {
      setCreatingEmpresa(false);
    }
  };

  const handleAddStatus = async () => {
    if (!newStatusNome.trim()) {
      toast.error('Nome do status é obrigatório');
      return;
    }
    
    try {
      setCreatingStatus(true);
      
      const { data, error } = await supabase
        .from('gr_status')
        .insert({ status: newStatusNome.trim() })
        .select()
        .single();
      
      if (error) throw error;
      
      setStatuses([...statuses, data]);
      setNewStatusNome('');
      setNewStatusModalOpen(false);
      toast.success('Status adicionado com sucesso');
    } catch (error) {
      console.error('Error adding status:', error);
      toast.error('Erro ao adicionar status');
    } finally {
      setCreatingStatus(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.empresa_id || !formData.status_id) {
      toast.error('Empresa e status são obrigatórios');
      return;
    }
    
    try {
      setSubmitting(true);
      
      if (currentGestao?.id) {
        // Update existing record
        const { error } = await supabase
          .from('gr_motorista')
          .update({
            empresa_id: parseInt(formData.empresa_id),
            status_id: parseInt(formData.status_id),
            motivo: formData.motivo || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentGestao.id);
        
        if (error) throw error;
        
        toast.success('Gestão de risco atualizada com sucesso');
      } else {
        // Create new record
        const { error } = await supabase
          .from('gr_motorista')
          .insert({
            motorista_id,
            empresa_id: parseInt(formData.empresa_id),
            status_id: parseInt(formData.status_id),
            motivo: formData.motivo || null
          });
        
        if (error) throw error;
        
        toast.success('Gestão de risco adicionada com sucesso');
      }
      
      // Close modals and refresh data
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      fetchGestoesRisco();
      
      // Call the onUpdateSuccess callback if provided
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Erro ao salvar dados');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentGestao?.id) return;
    
    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('gr_motorista')
        .delete()
        .eq('id', currentGestao.id);
      
      if (error) throw error;
      
      toast.success('Gestão de risco removida com sucesso');
      setIsDeleteModalOpen(false);
      
      // Refresh the list
      fetchGestoesRisco();
      
      // Call the onUpdateSuccess callback if provided
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Erro ao remover gestão de risco');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Gestões de Risco
        </h3>
        <button
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Adicionar Gestão de Risco
        </button>
      </div>

      {gestoesRisco.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {gestoesRisco.map((gestao) => (
              <li key={gestao.id} className="px-4 py-4 sm:px-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Empresa</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {gestao.empresa?.nome || 'Não informado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                      <dd className={`mt-1 text-sm font-medium ${
                        gestao.status?.status === 'Reprovado' 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {gestao.status?.status || 'Não informado'}
                      </dd>
                    </div>
                    {gestao.motivo && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Motivo</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                          {gestao.motivo}
                        </dd>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(gestao)}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Edit2 className="-ml-1 mr-2 h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(gestao)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="-ml-1 mr-2 h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <ShieldAlert className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Sem gestões de risco
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Adicione gestões de risco para este motorista.
          </p>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Adicionar Gestão de Risco
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Empresa *
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.empresa_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, empresa_id: e.target.value }))}
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
                  <button
                    type="button"
                    onClick={() => setNewEmpresaModalOpen(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status *
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.status_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, status_id: e.target.value }))}
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
                  <button
                    type="button"
                    onClick={() => setNewStatusModalOpen(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo
                </label>
                <textarea
                  value={formData.motivo}
                  onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Descreva o motivo..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Editar Gestão de Risco
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Empresa *
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.empresa_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, empresa_id: e.target.value }))}
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
                  <button
                    type="button"
                    onClick={() => setNewEmpresaModalOpen(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status *
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.status_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, status_id: e.target.value }))}
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
                  <button
                    type="button"
                    onClick={() => setNewStatusModalOpen(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo
                </label>
                <textarea
                  value={formData.motivo}
                  onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Descreva o motivo..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} />
                Confirmar Exclusão
              </h2>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir esta informação de gestão de risco? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
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
      )}

      {/* New Empresa Modal */}
      {newEmpresaModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Nova Empresa
              </h2>
              <button
                onClick={() => setNewEmpresaModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  value={newEmpresaNome}
                  onChange={(e) => setNewEmpresaNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setNewEmpresaModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                  disabled={creatingEmpresa}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddEmpresa}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={creatingEmpresa || !newEmpresaNome.trim()}
                >
                  {creatingEmpresa ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Status Modal */}
      {newStatusModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Novo Status
              </h2>
              <button
                onClick={() => setNewStatusModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Status *
                </label>
                <input
                  type="text"
                  value={newStatusNome}
                  onChange={(e) => setNewStatusNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setNewStatusModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                  disabled={creatingStatus}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddStatus}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={creatingStatus || !newStatusNome.trim()}
                >
                  {creatingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoRiscoTab;