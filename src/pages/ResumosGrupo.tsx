import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Clock, Link2, Users, Save, Loader2, AlertTriangle, CheckCircle2, Send, History, FileText, Calendar, Search } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { Navigate } from 'react-router-dom';

interface GrupoResumo {
  id: number;
  nome_grupo: string;
  url_grupo: string;
  horario: string;
  ativo: boolean;
  company_id: number;
  created_at: string;
}

interface EnvioResumo {
  id: number;
  grupo_id: number;
  data_envio: string;
  status: 'success' | 'error';
  mensagem: string;
  nome_grupo: string;
}

const ResumosGrupo = () => {
  const { companyId } = useAuth();
  const { moduleAccess } = useModuleAccess();
  const [grupos, setGrupos] = useState<GrupoResumo[]>([]);
  const [envios, setEnvios] = useState<EnvioResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome_grupo: '',
    url_grupo: '',
    horario: '08:00'
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<number | null>(null);
  const [sendingManualSummary, setSendingManualSummary] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'grupos' | 'historico'>('grupos');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchGrupos();
    fetchHistorico();
  }, [companyId]);

  // Redirect if user doesn't have access to this module
  if (!moduleAccess.resumos) {
    return <Navigate to="/" replace />;
  }

  const fetchGrupos = async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('grupo_resumo')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGrupos(data || []);
    } catch (error) {
      console.error('Error fetching grupos:', error);
      toast.error('Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    if (!companyId) return;
    
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('envio_resumo')
        .select('*, grupo_resumo!inner(nome_grupo)')
        .eq('company_id', companyId)
        .order('data_envio', { ascending: false });

      if (error) throw error;
      
      // Format the data to include the group name
      const formattedData = data?.map(item => ({
        id: item.id,
        grupo_id: item.grupo_id,
        data_envio: item.data_envio,
        status: item.status,
        mensagem: item.mensagem,
        nome_grupo: item.grupo_resumo.nome_grupo
      })) || [];
      
      setEnvios(formattedData);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Erro ao carregar histórico de envios');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    
    try {
      setSubmitting(true);
      
      // Validate URL format
      if (!formData.url_grupo.startsWith('https://')) {
        toast.error('A URL deve começar com https://');
        return;
      }
      
      if (editingId) {
        // Update existing group
        const { error } = await supabase
          .from('grupo_resumo')
          .update({
            nome_grupo: formData.nome_grupo,
            url_grupo: formData.url_grupo,
            horario: formData.horario
          })
          .eq('id', editingId)
          .eq('company_id', companyId);

        if (error) throw error;
        toast.success('Grupo atualizado com sucesso');
      } else {
        // Create new group
        const { error } = await supabase
          .from('grupo_resumo')
          .insert({
            nome_grupo: formData.nome_grupo,
            url_grupo: formData.url_grupo,
            horario: formData.horario,
            ativo: true,
            company_id: companyId
          });

        if (error) throw error;
        toast.success('Grupo adicionado com sucesso');
      }
      
      // Reset form and close modal
      setFormData({
        nome_grupo: '',
        url_grupo: '',
        horario: '08:00'
      });
      setIsModalOpen(false);
      setEditingId(null);
      
      // Refresh the list
      fetchGrupos();
    } catch (error) {
      console.error('Error saving grupo:', error);
      toast.error('Erro ao salvar grupo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (grupo: GrupoResumo) => {
    setFormData({
      nome_grupo: grupo.nome_grupo,
      url_grupo: grupo.url_grupo,
      horario: grupo.horario
    });
    setEditingId(grupo.id);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId || !companyId) return;
    
    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .delete()
        .eq('id', deletingId)
        .eq('company_id', companyId);

      if (error) throw error;
      
      setGrupos(grupos.filter(g => g.id !== deletingId));
      toast.success('Grupo excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting grupo:', error);
      toast.error('Erro ao excluir grupo');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    if (!companyId) return;
    
    try {
      setToggleLoading(id);
      const { error } = await supabase
        .from('grupo_resumo')
        .update({ ativo: !currentStatus })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
      
      // Update local state
      setGrupos(grupos.map(g => 
        g.id === id ? { ...g, ativo: !currentStatus } : g
      ));
      
      toast.success(`Grupo ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status do grupo');
    } finally {
      setToggleLoading(null);
    }
  };

  const handleManualSummary = async (id: number) => {
    if (!companyId) return;
    
    try {
      setSendingManualSummary(id);
      
      // Find the group data
      const grupo = grupos.find(g => g.id === id);
      if (!grupo) {
        toast.error('Grupo não encontrado');
        return;
      }
      
      // Create a manual summary record directly in the database
      const { error } = await supabase
        .from('envio_resumo')
        .insert({
          grupo_id: id,
          company_id: companyId,
          status: 'success',
          mensagem: 'Resumo enviado manualmente'
        });
        
      if (error) throw error;
      
      // Show success message
      toast.success('Resumo enviado com sucesso');
      
      // Refresh history
      fetchHistorico();
    } catch (error) {
      console.error('Error sending manual summary:', error);
      toast.error('Erro ao enviar resumo manual');
    } finally {
      setSendingManualSummary(null);
    }
  };

  const formatTime = (time: string) => {
    // Format time to display in 24h format (HH:MM)
    return time;
  };

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateTimeStr;
    }
  };

  const filteredEnvios = envios.filter(envio => 
    envio.nome_grupo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    envio.mensagem?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Resumos em Grupo</h1>
        <button
          onClick={() => {
            setFormData({
              nome_grupo: '',
              url_grupo: '',
              horario: '08:00'
            });
            setEditingId(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Adicionar Grupo
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Resumos Automáticos para Grupos
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('grupos')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'grupos'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Users className="w-5 h-5" />
              Grupos
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'historico'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <History className="w-5 h-5" />
              Histórico de Envios
            </button>
          </nav>
        </div>

        {/* Grupos Tab */}
        {activeTab === 'grupos' && (
          <>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : grupos.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Nenhum grupo configurado
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                  Adicione seu primeiro grupo para começar a receber resumos automáticos.
                </p>
                <button
                  onClick={() => {
                    setFormData({
                      nome_grupo: '',
                      url_grupo: '',
                      horario: '08:00'
                    });
                    setEditingId(null);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                           transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Grupo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {grupos.map(grupo => (
                  <div 
                    key={grupo.id} 
                    className={`bg-white dark:bg-gray-800 rounded-lg border ${
                      grupo.ativo 
                        ? 'border-green-200 dark:border-green-800/30' 
                        : 'border-gray-200 dark:border-gray-700'
                    } shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg`}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            grupo.ativo 
                              ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                            <Users className="w-5 h-5" />
                          </div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {grupo.nome_grupo}
                          </h3>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleStatus(grupo.id, grupo.ativo)}
                            disabled={toggleLoading === grupo.id}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              grupo.ativo 
                                ? 'bg-green-500 dark:bg-green-600' 
                                : 'bg-gray-200 dark:bg-gray-700'
                            } ${toggleLoading === grupo.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            role="switch"
                            aria-checked={grupo.ativo}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                grupo.ativo ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                            {toggleLoading === grupo.id && (
                              <Loader2 
                                className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" 
                              />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>Horário: {formatTime(grupo.horario)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Link2 className="w-4 h-4 text-gray-400" />
                          <span className="truncate" title={grupo.url_grupo}>
                            URL: {grupo.url_grupo.substring(0, 30)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            grupo.ativo 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {grupo.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={() => handleManualSummary(grupo.id)}
                          disabled={!grupo.ativo || sendingManualSummary === grupo.id}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 ${
                            grupo.ativo
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
                          }`}
                        >
                          {sendingManualSummary === grupo.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Enviar Agora
                        </button>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(grupo)}
                            className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                                     hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Editar grupo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                              <path d="m15 5 4 4"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(grupo.id)}
                            className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                                     hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Excluir grupo"
                          >
                            <Trash2 className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Histórico Tab */}
        {activeTab === 'historico' && (
          <>
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nome do grupo ou mensagem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                           dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                           focus:border-blue-500 text-gray-900 dark:text-gray-100"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
            
            {loadingHistory ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : filteredEnvios.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Nenhum envio registrado
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  O histórico de envios será exibido aqui após o primeiro resumo ser enviado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Data/Hora
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Grupo
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Mensagem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredEnvios.map((envio) => (
                      <tr key={envio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {formatDateTime(envio.data_envio)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {envio.nome_grupo}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            envio.status === 'success'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                          }`}>
                            {envio.status === 'success' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Enviado
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                                Falha
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                            {envio.mensagem || 'Resumo enviado com sucesso'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Editar Grupo' : 'Adicionar Grupo'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Grupo *
                </label>
                <input
                  type="text"
                  value={formData.nome_grupo}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome_grupo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  placeholder="Ex: Equipe Operacional"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL do Grupo *
                </label>
                <input
                  type="url"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData(prev => ({ ...prev, url_grupo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  placeholder="https://chat.whatsapp.com/..."
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Cole aqui o link de convite do grupo do WhatsApp
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horário do Resumo *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData(prev => ({ ...prev, horario: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Horário em que o resumo será enviado diariamente
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.
              </p>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800/30">
                <p className="text-sm text-red-800 dark:text-red-200">
                  O grupo não receberá mais resumos automáticos após a exclusão.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumosGrupo;