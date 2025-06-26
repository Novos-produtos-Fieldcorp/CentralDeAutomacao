import React, { useState, useEffect } from 'react';
import { 
  Plus, Loader2, Calendar, MessagesSquare, Trash2, 
  BarChart2, Clock, Link2, Send, Edit2, AlertTriangle,
  CheckCircle2, XCircle, Settings, Smartphone,
  LayoutList, History, Users, Bell, FileText, Home,
  Truck, Gauge, ClipboardCheck, Store, Mail, Phone,
  Map, Star, Heart, Bookmark, Flag, Award, Bug
} from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TimeDebugModal from '../components/TimeDebugModal';

interface GrupoResumo {
  id: number;
  nome_grupo: string;
  url_grupo: string;
  horario: string;
  ativo: boolean;
  company_id: number;
  icon_name?: string;
  color_name?: string;
}

interface EnvioResumo {
  id: number;
  grupo_id: number;
  data_envio: string;
  status: boolean;
  mensagem: string;
  grupo?: {
    nome_grupo: string;
  };
}

const WEBHOOK_URL = 'https://n8nqp.wiseapp360.com/webhook/resumo-grupo';

const ResumosGrupo = () => {
  const { query, companyId } = useCompanyData();
  const { accountId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<GrupoResumo[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTimeDebugModalOpen, setIsTimeDebugModalOpen] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoResumo | null>(null);
  const [formData, setFormData] = useState({
    nome_grupo: '',
    url_grupo: '',
    horario: '08:00',
    ativo: true,
    icon_name: 'MessagesSquare',
    color_name: 'blue'
  });
  const [envios, setEnvios] = useState<Record<number, EnvioResumo[]>>({});
  const [allEnvios, setAllEnvios] = useState<EnvioResumo[]>([]);
  const [loadingEnvios, setLoadingEnvios] = useState<Record<number, boolean>>({});
  const [loadingAllEnvios, setLoadingAllEnvios] = useState(false);
  const [sendingManualSummary, setSendingManualSummary] = useState<Record<number, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'groups' | 'history'>('groups');

  useEffect(() => {
    fetchGrupos();
  }, [companyId]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAllEnvios();
    }
  }, [activeTab]);

  const fetchGrupos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('grupo_resumo')
        .select('*')
        .eq('company_id', companyId)
        .order('nome_grupo');

      if (error) throw error;
      setGrupos(data || []);
    } catch (error) {
      console.error('Error fetching grupos:', error);
      toast.error('Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvios = async (grupoId: number) => {
    try {
      setLoadingEnvios(prev => ({ ...prev, [grupoId]: true }));
      const { data, error } = await supabase
        .from('envio_resumo')
        .select('*')
        .eq('grupo_id', grupoId)
        .order('data_envio', { ascending: false })
        .limit(10);

      if (error) throw error;
      setEnvios(prev => ({ ...prev, [grupoId]: data || [] }));
    } catch (error) {
      console.error('Error fetching envios:', error);
      toast.error('Erro ao carregar histórico de envios');
    } finally {
      setLoadingEnvios(prev => ({ ...prev, [grupoId]: false }));
    }
  };

  const fetchAllEnvios = async () => {
    try {
      setLoadingAllEnvios(true);
      const { data, error } = await supabase
        .from('envio_resumo')
        .select(`
          *,
          grupo:grupo_id (
            nome_grupo
          )
        `)
        .eq('company_id', companyId)
        .order('data_envio', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAllEnvios(data || []);
    } catch (error) {
      console.error('Error fetching all envios:', error);
      toast.error('Erro ao carregar histórico de envios');
    } finally {
      setLoadingAllEnvios(false);
    }
  };

  const handleAddGrupo = async () => {
    try {
      const { data, error } = await supabase
        .from('grupo_resumo')
        .insert({
          ...formData,
          company_id: companyId
        })
        .select()
        .single();

      if (error) throw error;
      setGrupos([...grupos, data]);
      setIsAddModalOpen(false);
      resetForm();
      toast.success('Grupo adicionado com sucesso');
    } catch (error) {
      console.error('Error adding grupo:', error);
      toast.error('Erro ao adicionar grupo');
    }
  };

  const handleEditGrupo = async () => {
    if (!selectedGrupo) return;

    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .update({
          nome_grupo: formData.nome_grupo,
          url_grupo: formData.url_grupo,
          horario: formData.horario,
          icon_name: formData.icon_name,
          color_name: formData.color_name
        })
        .eq('id', selectedGrupo.id);

      if (error) throw error;
      
      setGrupos(grupos.map(grupo => 
        grupo.id === selectedGrupo.id 
          ? { 
              ...grupo, 
              nome_grupo: formData.nome_grupo,
              url_grupo: formData.url_grupo,
              horario: formData.horario,
              icon_name: formData.icon_name,
              color_name: formData.color_name
            } 
          : grupo
      ));
      
      setIsEditModalOpen(false);
      resetForm();
      toast.success('Grupo atualizado com sucesso');
    } catch (error) {
      console.error('Error updating grupo:', error);
      toast.error('Erro ao atualizar grupo');
    }
  };

  const handleDeleteGrupo = async () => {
    if (!selectedGrupo) return;

    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .delete()
        .eq('id', selectedGrupo.id);

      if (error) throw error;
      setGrupos(grupos.filter(grupo => grupo.id !== selectedGrupo.id));
      setIsDeleteModalOpen(false);
      toast.success('Grupo excluído com sucesso');
    } catch (error) {
      console.error('Error deleting grupo:', error);
      toast.error('Erro ao excluir grupo');
    }
  };

  const handleToggleActive = async (grupo: GrupoResumo) => {
    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .update({ ativo: !grupo.ativo })
        .eq('id', grupo.id);

      if (error) throw error;
      
      setGrupos(grupos.map(g => 
        g.id === grupo.id 
          ? { ...g, ativo: !g.ativo } 
          : g
      ));
      
      toast.success(`Grupo ${!grupo.ativo ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling grupo status:', error);
      toast.error('Erro ao alterar status do grupo');
    }
  };

  const handleSendManualSummary = async (grupo: GrupoResumo) => {
    try {
      setSendingManualSummary(prev => ({ ...prev, [grupo.id]: true }));
      
      // Call the manual-summary-trigger edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-summary-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group_id: grupo.id,
          company_id: companyId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to trigger manual summary: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Manual summary result:', result);
      
      toast.success('Resumo enviado com sucesso');
      
      // Refresh the delivery history
      fetchEnvios(grupo.id);
      if (activeTab === 'history') {
        fetchAllEnvios();
      }
    } catch (error) {
      console.error('Error sending manual summary:', error);
      toast.error(`Erro ao enviar resumo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSendingManualSummary(prev => ({ ...prev, [grupo.id]: false }));
    }
  };

  const resetForm = () => {
    setFormData({
      nome_grupo: '',
      url_grupo: '',
      horario: '08:00',
      ativo: true,
      icon_name: 'MessagesSquare',
      color_name: 'blue'
    });
    setSelectedGrupo(null);
  };

  const toggleGroupExpansion = (grupoId: number) => {
    const newExpandedGroups = new Set(expandedGroups);
    if (expandedGroups.has(grupoId)) {
      newExpandedGroups.delete(grupoId);
    } else {
      newExpandedGroups.add(grupoId);
      fetchEnvios(grupoId);
    }
    setExpandedGroups(newExpandedGroups);
  };

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = parseISO(dateTimeStr);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return dateTimeStr;
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      MessagesSquare: <MessagesSquare />,
      BarChart2: <BarChart2 />,
      Calendar: <Calendar />,
      Smartphone: <Smartphone />,
      Settings: <Settings />,
      Users: <Users />,
      Bell: <Bell />,
      FileText: <FileText />,
      Home: <Home />,
      Truck: <Truck />,
      Gauge: <Gauge />,
      ClipboardCheck: <ClipboardCheck />,
      Store: <Store />,
      Mail: <Mail />,
      Phone: <Phone />,
      Map: <Map />,
      Star: <Star />,
      Heart: <Heart />,
      Bookmark: <Bookmark />,
      Flag: <Flag />,
      Award: <Award />
    };
    
    return iconMap[iconName] || <MessagesSquare />;
  };

  const getColorClass = (colorName: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
    };
    
    return colorMap[colorName] || colorMap.blue;
  };

  const iconOptions = [
    { value: 'MessagesSquare', component: <MessagesSquare /> },
    { value: 'BarChart2', component: <BarChart2 /> },
    { value: 'Calendar', component: <Calendar /> },
    { value: 'Smartphone', component: <Smartphone /> },
    { value: 'Settings', component: <Settings /> },
    { value: 'Users', component: <Users /> },
    { value: 'Bell', component: <Bell /> },
    { value: 'FileText', component: <FileText /> },
    { value: 'Home', component: <Home /> },
    { value: 'Truck', component: <Truck /> },
    { value: 'Gauge', component: <Gauge /> },
    { value: 'ClipboardCheck', component: <ClipboardCheck /> },
    { value: 'Store', component: <Store /> },
    { value: 'Mail', component: <Mail /> },
    { value: 'Phone', component: <Phone /> },
    { value: 'Map', component: <Map /> },
    { value: 'Star', component: <Star /> },
    { value: 'Heart', component: <Heart /> },
    { value: 'Bookmark', component: <Bookmark /> },
    { value: 'Flag', component: <Flag /> },
    { value: 'Award', component: <Award /> }
  ];

  const colorOptions = [
    { value: 'blue', class: 'bg-blue-500 dark:bg-blue-400' },
    { value: 'green', class: 'bg-green-500 dark:bg-green-400' },
    { value: 'purple', class: 'bg-purple-500 dark:bg-purple-400' },
    { value: 'amber', class: 'bg-amber-500 dark:bg-amber-400' },
    { value: 'red', class: 'bg-red-500 dark:bg-red-400' }
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Resumos em Grupo</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsTimeDebugModalOpen(true)}
            className="p-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 
                     focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 
                     transition-colors"
            title="Diagnóstico de Fuso Horário"
          >
            <Bug className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setIsAddModalOpen(true);
              resetForm();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Novo Grupo
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'groups'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <MessagesSquare className="w-5 h-5 mr-2" />
              Grupos
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <History className="w-5 h-5 mr-2" />
              Histórico de Envios
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'groups' && (
            <>
              {grupos.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
                  <MessagesSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Nenhum grupo configurado
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Configure grupos para enviar resumos automáticos diários com informações sobre motoristas, agregados, hodômetros e checklists.
                  </p>
                  <button
                    onClick={() => {
                      setIsAddModalOpen(true);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                             transition-colors flex items-center gap-2 mx-auto"
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
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden ${
                        !grupo.ativo ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full ${getColorClass(grupo.color_name || 'blue')}`}>
                              {getIconComponent(grupo.icon_name || 'MessagesSquare')}
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {grupo.nome_grupo}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {grupo.horario}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <button
                              onClick={() => handleToggleActive(grupo)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                grupo.ativo 
                                  ? 'bg-green-500 dark:bg-green-600' 
                                  : 'bg-gray-200 dark:bg-gray-700'
                              }`}
                              role="switch"
                              aria-checked={grupo.ativo}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  grupo.ativo ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <Link2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <span 
                            className="text-sm text-gray-600 dark:text-gray-400 truncate"
                          >
                            {grupo.url_grupo}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center mt-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedGrupo(grupo);
                                setFormData({
                                  nome_grupo: grupo.nome_grupo,
                                  url_grupo: grupo.url_grupo,
                                  horario: grupo.horario,
                                  ativo: grupo.ativo,
                                  icon_name: grupo.icon_name || 'MessagesSquare',
                                  color_name: grupo.color_name || 'blue'
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Editar grupo"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedGrupo(grupo);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Excluir grupo"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleGroupExpansion(grupo.id)}
                              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title={expandedGroups.has(grupo.id) ? "Ocultar histórico" : "Ver histórico"}
                            >
                              <LayoutList className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleSendManualSummary(grupo)}
                              disabled={sendingManualSummary[grupo.id] || !grupo.ativo}
                              className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Enviar resumo agora"
                            >
                              {sendingManualSummary[grupo.id] ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Send className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Delivery History */}
                      {expandedGroups.has(grupo.id) && (
                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Histórico de Envios
                          </h4>
                          
                          {loadingEnvios[grupo.id] ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            </div>
                          ) : envios[grupo.id]?.length ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {envios[grupo.id].map(envio => (
                                <div 
                                  key={envio.id} 
                                  className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                                >
                                  <div>
                                    <div className="text-sm text-gray-900 dark:text-white">
                                      {formatDateTime(envio.data_envio)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {envio.mensagem}
                                    </div>
                                  </div>
                                  <div>
                                    {envio.status ? (
                                      <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                              Nenhum envio registrado
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  Histórico de Envios
                </h2>
                
                {loadingAllEnvios ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : allEnvios.length > 0 ? (
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
                        {allEnvios.map((envio) => (
                          <tr key={envio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {formatDateTime(envio.data_envio)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {envio.grupo?.nome_grupo || 'Grupo desconhecido'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                envio.status 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                              }`}>
                                {envio.status ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    Sucesso
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    Falha
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {envio.mensagem}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Nenhum histórico de envio encontrado
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Group Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Novo Grupo
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Grupo *
                </label>
                <input
                  type="text"
                  value={formData.nome_grupo}
                  onChange={(e) => setFormData({ ...formData, nome_grupo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL do Grupo *
                </label>
                <input
                  type="url"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData({ ...formData, url_grupo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="https://chat.whatsapp.com/..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horário de Envio *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="grid grid-cols-6 gap-1 mt-2">
                  {iconOptions.map(icon => (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon_name: icon.value })}
                      className={`p-1 rounded-lg transition-colors ${
                        formData.icon_name === icon.value
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {icon.component}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="flex gap-3 mt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color_name: color.value })}
                      className={`w-8 h-8 rounded-full ${color.class} ${
                        formData.color_name === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddGrupo}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Editar Grupo
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Grupo *
                </label>
                <input
                  type="text"
                  value={formData.nome_grupo}
                  onChange={(e) => setFormData({ ...formData, nome_grupo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL do Grupo *
                </label>
                <input
                  type="url"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData({ ...formData, url_grupo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="https://chat.whatsapp.com/..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horário de Envio *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="grid grid-cols-6 gap-1 mt-2">
                  {iconOptions.map(icon => (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon_name: icon.value })}
                      className={`p-1 rounded-lg transition-colors ${
                        formData.icon_name === icon.value
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {icon.component}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="flex gap-3 mt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color_name: color.value })}
                      className={`w-8 h-8 rounded-full ${color.class} ${
                        formData.color_name === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditGrupo}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} />
                Confirmar Exclusão
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir o grupo "{selectedGrupo?.nome_grupo}"? Esta ação não pode ser desfeita.
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800/30">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Todos os dados relacionados a este grupo, incluindo histórico de envios, serão permanentemente excluídos.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteGrupo}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Debug Modal */}
      <TimeDebugModal 
        isOpen={isTimeDebugModalOpen}
        onClose={() => setIsTimeDebugModalOpen(false)}
      />
    </div>
  );
};

export default ResumosGrupo;