import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Clock, 
  MessagesSquare, 
  Send, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  BarChart2,
  Calendar,
  Users,
  Truck,
  ClipboardCheck,
  Gauge
} from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { Navigate } from 'react-router-dom';

// Define the color options
const colorOptions = [
  { value: 'blue', bgClass: 'bg-blue-500' },
  { value: 'green', bgClass: 'bg-green-500' },
  { value: 'purple', bgClass: 'bg-purple-500' },
  { value: 'red', bgClass: 'bg-red-500' },
  { value: 'yellow', bgClass: 'bg-yellow-500' },
  { value: 'indigo', bgClass: 'bg-indigo-500' },
  { value: 'pink', bgClass: 'bg-pink-500' },
  { value: 'orange', bgClass: 'bg-orange-500' }
];

// Define the icon options
const iconOptions = [
  { value: 'MessagesSquare', icon: MessagesSquare },
  { value: 'BarChart2', icon: BarChart2 },
  { value: 'Calendar', icon: Calendar },
  { value: 'Users', icon: Users },
  { value: 'Truck', icon: Truck },
  { value: 'ClipboardCheck', icon: ClipboardCheck },
  { value: 'Gauge', icon: Gauge }
];

interface Group {
  id: number;
  nome_grupo: string;
  url_grupo: string;
  horario: string;
  ativo: boolean;
  company_id: number;
  icon_name?: string;
  color_name?: string;
}

interface DeliveryHistory {
  id: number;
  grupo_id: number;
  data_envio: string;
  status: boolean;
  mensagem: string;
}

const ResumosGrupo = () => {
  const { companyId } = useCompanyData();
  const { accountId } = useAuth();
  const { moduleAccess } = useModuleAccess();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryHistory[]>([]);
  const [sendingManualSummary, setSendingManualSummary] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nome_grupo: '',
    url_grupo: '',
    horario: '08:00',
    ativo: true,
    icon_name: 'MessagesSquare',
    color_name: 'blue'
  });

  useEffect(() => {
    if (!moduleAccess.resumos) return;
    fetchGroups();
  }, [companyId, moduleAccess.resumos]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('grupo_resumo')
        .select('*')
        .eq('company_id', companyId)
        .order('nome_grupo');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryHistory = async (groupId: number) => {
    try {
      const { data, error } = await supabase
        .from('envio_resumo')
        .select('*')
        .eq('grupo_id', groupId)
        .order('data_envio', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDeliveryHistory(data || []);
    } catch (error) {
      console.error('Error fetching delivery history:', error);
      toast.error('Erro ao carregar histórico de envios');
    }
  };

  const handleAddGroup = async () => {
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
      
      setGroups([...groups, data]);
      setIsAddModalOpen(false);
      resetForm();
      toast.success('Grupo adicionado com sucesso');
    } catch (error) {
      console.error('Error adding group:', error);
      toast.error('Erro ao adicionar grupo');
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    
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
        .eq('id', selectedGroup.id);

      if (error) throw error;
      
      setGroups(groups.map(group => 
        group.id === selectedGroup.id 
          ? { 
              ...group, 
              nome_grupo: formData.nome_grupo,
              url_grupo: formData.url_grupo,
              horario: formData.horario,
              icon_name: formData.icon_name,
              color_name: formData.color_name
            } 
          : group
      ));
      
      setIsEditModalOpen(false);
      resetForm();
      toast.success('Grupo atualizado com sucesso');
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Erro ao atualizar grupo');
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .delete()
        .eq('id', selectedGroup.id);

      if (error) throw error;
      
      setGroups(groups.filter(group => group.id !== selectedGroup.id));
      setIsDeleteModalOpen(false);
      toast.success('Grupo excluído com sucesso');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Erro ao excluir grupo');
    }
  };

  const handleToggleActive = async (group: Group) => {
    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .update({ ativo: !group.ativo })
        .eq('id', group.id);

      if (error) throw error;
      
      setGroups(groups.map(g => 
        g.id === group.id 
          ? { ...g, ativo: !g.ativo } 
          : g
      ));
      
      toast.success(`Grupo ${!group.ativo ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling group status:', error);
      toast.error('Erro ao alterar status do grupo');
    }
  };

  const handleSendManualSummary = async (group: Group) => {
    try {
      setSendingManualSummary(group.id);
      
      // Get current date in Brasilia timezone (UTC-3)
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      
      const formattedDate = brasiliaTime.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Get company data
      const { data: company, error: companyError } = await supabase
        .from('company')
        .select('nome_company')
        .eq('company_id', companyId)
        .single();
        
      if (companyError) throw companyError;
      
      // Get today's date in YYYY-MM-DD format for Brasilia timezone
      const todayStr = brasiliaTime.toISOString().split('T')[0];
      
      // Get motoristas count
      const { count: motoristasCount, error: motoristasError } = await supabase
        .from('motorista')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('funcao', 'Motorista');
        
      if (motoristasError) throw motoristasError;
      
      // Get agregados count
      const { count: agregadosCount, error: agregadosError } = await supabase
        .from('motorista')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('funcao', 'Agregado');
        
      if (agregadosError) throw agregadosError;
      
      // Get today's hodometros count
      const { count: hodometrosCount, error: hodometrosError } = await supabase
        .from('hodometro')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('data', todayStr);
        
      if (hodometrosError) throw hodometrosError;
      
      // Get today's checklists count
      const { count: checklistsCount, error: checklistsError } = await supabase
        .from('checklist')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('data', todayStr);
        
      if (checklistsError) throw checklistsError;
      
      // Prepare the summary data
      const summaryData = {
        company_name: company?.nome_company || 'Empresa',
        date: formattedDate,
        group_name: group.nome_grupo,
        stats: {
          motoristas: motoristasCount || 0,
          agregados: agregadosCount || 0,
          hodometros_today: hodometrosCount || 0,
          checklists_today: checklistsCount || 0
        }
      };
      
      // Prepare the webhook payload
      const webhookData = {
        "nome do grupo": group.nome_grupo,
        "URL do grupo": group.url_grupo,
        "summary": summaryData
      };
      
      // Send the webhook directly
      const response = await fetch('https://n8nqp.wiseapp360.com/webhook/resumo-grupo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send webhook: ${response.status} - ${errorText}`);
      }
      
      // Record the delivery in the database
      const { error: recordError } = await supabase
        .from('envio_resumo')
        .insert({
          grupo_id: group.id,
          company_id: companyId,
          data_envio: new Date().toISOString(),
          status: true,
          mensagem: 'Resumo enviado manualmente'
        });
        
      if (recordError) throw recordError;
      
      toast.success('Resumo enviado com sucesso');
    } catch (error) {
      console.error('Error sending manual summary:', error);
      toast.error(`Erro ao enviar resumo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      
      // Record the failed delivery
      try {
        await supabase
          .from('envio_resumo')
          .insert({
            grupo_id: group.id,
            company_id: companyId,
            data_envio: new Date().toISOString(),
            status: false,
            mensagem: error instanceof Error ? error.message : 'Erro desconhecido'
          });
      } catch (recordError) {
        console.error('Error recording failed delivery:', recordError);
      }
    } finally {
      setSendingManualSummary(null);
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
  };

  const openEditModal = (group: Group) => {
    setSelectedGroup(group);
    setFormData({
      nome_grupo: group.nome_grupo,
      url_grupo: group.url_grupo,
      horario: group.horario,
      ativo: group.ativo,
      icon_name: group.icon_name || 'MessagesSquare',
      color_name: group.color_name || 'blue'
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (group: Group) => {
    setSelectedGroup(group);
    setIsDeleteModalOpen(true);
  };

  const openHistoryModal = async (group: Group) => {
    setSelectedGroup(group);
    await fetchDeliveryHistory(group.id);
    setIsHistoryModalOpen(true);
  };

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render the icon based on the icon name
  const renderIcon = (iconName: string) => {
    const IconComponent = iconOptions.find(option => option.value === iconName)?.icon || MessagesSquare;
    return <IconComponent />;
  };

  // Get color class based on color name
  const getColorClass = (colorName: string, type: 'bg' | 'text' | 'border') => {
    const color = colorOptions.find(option => option.value === colorName)?.value || 'blue';
    
    if (type === 'bg') {
      return `bg-${color}-500 dark:bg-${color}-600`;
    } else if (type === 'text') {
      return `text-${color}-600 dark:text-${color}-400`;
    } else {
      return `border-${color}-200 dark:border-${color}-800/50`;
    }
  };

  if (!moduleAccess.resumos) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Resumos em Grupo</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Grupo
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <MessagesSquare className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Nenhum grupo configurado
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
            Configure grupos para receber resumos automáticos das atividades da sua empresa.
            Os resumos são enviados diretamente para os grupos de WhatsApp nos horários programados.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
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
          {groups.map(group => (
            <div 
              key={group.id} 
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-md border ${
                group.color_name ? `border-${group.color_name}-200 dark:border-${group.color_name}-800/50` : 'border-gray-200 dark:border-gray-700'
              } overflow-hidden transition-all duration-300 hover:shadow-lg ${
                !group.ativo ? 'opacity-60' : ''
              }`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${getColorClass(group.color_name || 'blue', 'bg')}`}>
                      <div className="w-6 h-6 text-white">
                        {renderIcon(group.icon_name || 'MessagesSquare')}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {group.nome_grupo}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Envio às {group.horario}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={group.ativo}
                        onChange={() => handleToggleActive(group)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      <span className="sr-only">Ativo</span>
                    </label>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-300 break-all mb-4">
                  {group.url_grupo}
                </div>
                
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(group)}
                      className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Editar grupo"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(group)}
                      className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Excluir grupo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openHistoryModal(group)}
                      className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Histórico de envios"
                    >
                      <Clock className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleSendManualSummary(group)}
                    disabled={sendingManualSummary === group.id || !group.ativo}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                             transition-colors flex items-center gap-1 text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                    title={group.ativo ? "Enviar resumo agora" : "Ative o grupo para enviar resumos"}
                  >
                    {sendingManualSummary === group.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar Agora
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Group Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Novo Grupo
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
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
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL do Grupo *
                </label>
                <input
                  type="text"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData(prev => ({ ...prev, url_grupo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  placeholder="https://chat.whatsapp.com/..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horário de Envio *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData(prev => ({ ...prev, horario: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {iconOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon_name: option.value }))}
                      className={`p-2 rounded-lg flex items-center justify-center ${
                        formData.icon_name === option.value
                          ? `${getColorClass(formData.color_name, 'bg')} text-white`
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <option.icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color_name: option.value }))}
                      className={`w-8 h-8 rounded-full ${option.bgClass} ${
                        formData.color_name === option.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600'
                          : ''
                      }`}
                      aria-label={`Cor ${option.value}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <label htmlFor="ativo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ativo
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddGroup}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={!formData.nome_grupo || !formData.url_grupo}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {isEditModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Editar Grupo
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
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
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL do Grupo *
                </label>
                <input
                  type="text"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData(prev => ({ ...prev, url_grupo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  placeholder="https://chat.whatsapp.com/..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horário de Envio *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData(prev => ({ ...prev, horario: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {iconOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon_name: option.value }))}
                      className={`p-2 rounded-lg flex items-center justify-center ${
                        formData.icon_name === option.value
                          ? `${getColorClass(formData.color_name, 'bg')} text-white`
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <option.icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color_name: option.value }))}
                      className={`w-8 h-8 rounded-full ${option.bgClass} ${
                        formData.color_name === option.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600'
                          : ''
                      }`}
                      aria-label={`Cor ${option.value}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateGroup}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={!formData.nome_grupo || !formData.url_grupo}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {isDeleteModalOpen && selectedGroup && (
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
                Tem certeza que deseja excluir o grupo <span className="font-semibold">{selectedGroup.nome_grupo}</span>? Esta ação não pode ser desfeita.
              </p>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800/30">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Ao excluir este grupo, você perderá todo o histórico de envios e configurações associadas.
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
                onClick={handleDeleteGroup}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery History Modal */}
      {isHistoryModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="text-blue-500" size={24} />
                Histórico de Envios - {selectedGroup.nome_grupo}
              </h2>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {deliveryHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Nenhum envio registrado para este grupo.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deliveryHistory.map(delivery => (
                    <div 
                      key={delivery.id} 
                      className={`p-4 rounded-lg border ${
                        delivery.status 
                          ? 'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-800/30' 
                          : 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-800/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {delivery.status ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <p className={`text-sm font-medium ${
                              delivery.status 
                                ? 'text-green-800 dark:text-green-200' 
                                : 'text-red-800 dark:text-red-200'
                            }`}>
                              {delivery.status ? 'Enviado com sucesso' : 'Falha no envio'}
                            </p>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDateTime(delivery.data_envio)}
                            </span>
                          </div>
                          {delivery.mensagem && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {delivery.mensagem}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumosGrupo;