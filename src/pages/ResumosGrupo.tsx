import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Clock, MessageSquare, Check, X, Loader2, AlertTriangle, Send, MessagesSquare, Users, Truck, Building, Briefcase, ShoppingBag, Package, Map, Calendar } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import TimeDebugModal from '../components/TimeDebugModal';

interface GrupoResumo {
  id: number;
  nome_grupo: string;
  url_grupo: string;
  horario: string;
  ativo: boolean;
  icon_name?: string;
  color_name?: string;
}

interface EnvioResumo {
  id: number;
  grupo_id: number;
  data_envio: string;
  status: boolean;
  mensagem: string;
}

const iconOptions = [
  { value: 'MessagesSquare', label: 'Mensagens' },
  { value: 'Users', label: 'Usuários' },
  { value: 'Truck', label: 'Caminhão' },
  { value: 'Building', label: 'Prédio' },
  { value: 'Briefcase', label: 'Maleta' },
  { value: 'ShoppingBag', label: 'Sacola' },
  { value: 'Package', label: 'Pacote' },
  { value: 'Map', label: 'Mapa' },
  { value: 'Calendar', label: 'Calendário' }
];

const colorOptions = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'green', label: 'Verde', class: 'bg-green-500' },
  { value: 'red', label: 'Vermelho', class: 'bg-red-500' },
  { value: 'yellow', label: 'Amarelo', class: 'bg-yellow-500' },
  { value: 'purple', label: 'Roxo', class: 'bg-purple-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500' },
  { value: 'indigo', label: 'Índigo', class: 'bg-indigo-500' },
  { value: 'orange', label: 'Laranja', class: 'bg-orange-500' },
  { value: 'teal', label: 'Turquesa', class: 'bg-teal-500' }
];

// Icon mapping object
const iconMap = {
  MessagesSquare,
  Users,
  Truck,
  Building,
  Briefcase,
  ShoppingBag,
  Package,
  Map,
  Calendar,
  MessageSquare // fallback icon
};

const ResumosGrupo = () => {
  const { companyId } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GrupoResumo[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTimeDebugModalOpen, setIsTimeDebugModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GrupoResumo | null>(null);
  const [groupHistory, setGroupHistory] = useState<EnvioResumo[]>([]);
  const [formData, setFormData] = useState({
    nome_grupo: '',
    url_grupo: '',
    horario: '08:00',
    ativo: true,
    icon_name: 'MessagesSquare',
    color_name: 'blue'
  });
  const [submitting, setSubmitting] = useState(false);
  const [sendingManual, setSendingManual] = useState<number | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [companyId]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      
      if (!companyId) {
        setGroups([]);
        return;
      }
      
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

  const fetchGroupHistory = async (groupId: number) => {
    try {
      const { data, error } = await supabase
        .from('envio_resumo')
        .select('*')
        .eq('grupo_id', groupId)
        .order('data_envio', { ascending: false })
        .limit(10);
        
      if (error) throw error;
      
      setGroupHistory(data || []);
    } catch (error) {
      console.error('Error fetching group history:', error);
      toast.error('Erro ao carregar histórico do grupo');
    }
  };

  const handleAddGroup = async () => {
    try {
      setSubmitting(true);
      
      if (!companyId) {
        toast.error('ID da empresa não encontrado');
        return;
      }
      
      // Validate form data
      if (!formData.nome_grupo.trim()) {
        toast.error('Nome do grupo é obrigatório');
        return;
      }
      
      if (!formData.url_grupo.trim()) {
        toast.error('URL do webhook da Caixa de Entrada é obrigatória');
        return;
      }
      
      // Insert new group
      const { data, error } = await supabase
        .from('grupo_resumo')
        .insert({
          nome_grupo: formData.nome_grupo.trim(),
          url_grupo: formData.url_grupo.trim(),
          horario: formData.horario,
          ativo: formData.ativo,
          company_id: companyId,
          icon_name: formData.icon_name,
          color_name: formData.color_name
        })
        .select();
        
      if (error) throw error;
      
      toast.success('Grupo adicionado com sucesso');
      setIsAddModalOpen(false);
      fetchGroups();
      
      // Reset form data
      setFormData({
        nome_grupo: '',
        url_grupo: '',
        horario: '08:00',
        ativo: true,
        icon_name: 'MessagesSquare',
        color_name: 'blue'
      });
    } catch (error) {
      console.error('Error adding group:', error);
      toast.error('Erro ao adicionar grupo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditGroup = async () => {
    try {
      setSubmitting(true);
      
      if (!selectedGroup) {
        toast.error('Nenhum grupo selecionado');
        return;
      }
      
      // Validate form data
      if (!formData.nome_grupo.trim()) {
        toast.error('Nome do grupo é obrigatório');
        return;
      }
      
      if (!formData.url_grupo.trim()) {
        toast.error('URL do webhook da Caixa de Entrada é obrigatória');
        return;
      }
      
      // Update group
      const { error } = await supabase
        .from('grupo_resumo')
        .update({
          nome_grupo: formData.nome_grupo.trim(),
          url_grupo: formData.url_grupo.trim(),
          horario: formData.horario,
          ativo: formData.ativo,
          icon_name: formData.icon_name,
          color_name: formData.color_name
        })
        .eq('id', selectedGroup.id);
        
      if (error) throw error;
      
      toast.success('Grupo atualizado com sucesso');
      setIsEditModalOpen(false);
      fetchGroups();
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Erro ao atualizar grupo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      if (!confirm('Tem certeza que deseja excluir este grupo?')) {
        return;
      }
      
      const { error } = await supabase
        .from('grupo_resumo')
        .delete()
        .eq('id', groupId);
        
      if (error) throw error;
      
      toast.success('Grupo excluído com sucesso');
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Erro ao excluir grupo');
    }
  };

  const handleToggleActive = async (group: GrupoResumo) => {
    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .update({ ativo: !group.ativo })
        .eq('id', group.id);
        
      if (error) throw error;
      
      toast.success(`Grupo ${!group.ativo ? 'ativado' : 'desativado'} com sucesso`);
      fetchGroups();
    } catch (error) {
      console.error('Error toggling group status:', error);
      toast.error('Erro ao alterar status do grupo');
    }
  };

  const handleViewHistory = (group: GrupoResumo) => {
    setSelectedGroup(group);
    fetchGroupHistory(group.id);
    setIsHistoryModalOpen(true);
  };

  const handleEditClick = (group: GrupoResumo) => {
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

  const handleManualSend = async (groupId: number) => {
    try {
      setSendingManual(groupId);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-summary-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          group_id: groupId,
          company_id: companyId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar resumo manual');
      }
      
      toast.success('Resumo enviado manualmente com sucesso');
      
      // Refresh group history if history modal is open
      if (isHistoryModalOpen && selectedGroup?.id === groupId) {
        fetchGroupHistory(groupId);
      }
    } catch (error) {
      console.error('Error sending manual summary:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar resumo manual');
    } finally {
      setSendingManual(null);
    }
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

  const getIconComponent = (iconName: string) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || MessageSquare;
    return <IconComponent className="w-5 h-5" />;
  };

  const getColorClass = (colorName: string) => {
    const color = colorOptions.find(c => c.value === colorName);
    return color ? color.class : 'bg-blue-500';
  };

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
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Debug de Horário"
          >
            <Clock className="w-4 h-4" />
          </button>
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
      </div>

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            Nenhum grupo configurado
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
            Configure grupos para enviar resumos automáticos para seus grupos de WhatsApp.
            Os resumos serão enviados diariamente no horário configurado.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
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
          {groups.map(group => (
            <div 
              key={group.id} 
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border-t-4 ${
                group.color_name ? `border-${group.color_name}-500` : 'border-blue-500'
              }`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      group.color_name ? `bg-${group.color_name}-100 dark:bg-${group.color_name}-900/30` : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {group.icon_name ? getIconComponent(group.icon_name) : <MessageSquare className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {group.nome_grupo}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {group.horario}
                      </p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                    group.ativo 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                  }`}>
                    {group.ativo ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => handleViewHistory(group)}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Ver histórico
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleManualSend(group.id)}
                        disabled={sendingManual === group.id}
                        className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 
                                 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Enviar resumo agora"
                      >
                        {sendingManual === group.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEditClick(group)}
                        className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 
                                 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Editar grupo"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(group)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          group.ativo 
                            ? 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20' 
                            : 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                        title={group.ativo ? 'Desativar grupo' : 'Ativar grupo'}
                      >
                        {group.ativo ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                                 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Excluir grupo"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Group Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Novo Grupo
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3">
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
                  URL do webhook da Caixa de Entrada *
                </label>
                <input
                  type="text"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData(prev => ({ ...prev, url_grupo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  placeholder="https://chat.wiseapp360.com/api/v1/..."
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
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Horário de Brasília (GMT-3)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="ativo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ativo
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <select
                  value={formData.icon_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {iconOptions.map(icon => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <select
                  value={formData.color_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, color_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {colorOptions.map(color => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex gap-2">
                  {colorOptions.map(color => (
                    <div 
                      key={color.value} 
                      className={`w-6 h-6 rounded-full ${color.class} cursor-pointer ${
                        formData.color_name === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, color_name: color.value }))}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddGroup}
                disabled={submitting || !formData.nome_grupo.trim() || !formData.url_grupo.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {isEditModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Editar Grupo
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3">
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
                  URL do webhook da Caixa de Entrada *
                </label>
                <input
                  type="text"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData(prev => ({ ...prev, url_grupo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  placeholder="https://chat.wiseapp360.com/api/v1/..."
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
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Horário de Brasília (GMT-3)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ativo-edit"
                  checked={formData.ativo}
                  onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="ativo-edit" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ativo
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <select
                  value={formData.icon_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {iconOptions.map(icon => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <select
                  value={formData.color_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, color_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {colorOptions.map(color => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex gap-2">
                  {colorOptions.map(color => (
                    <div 
                      key={color.value} 
                      className={`w-6 h-6 rounded-full ${color.class} cursor-pointer ${
                        formData.color_name === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, color_name: color.value }))}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleEditGroup}
                disabled={submitting || !formData.nome_grupo.trim() || !formData.url_grupo.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Histórico de Envios - {selectedGroup.nome_grupo}
              </h2>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              {groupHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Nenhum envio registrado para este grupo
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Data/Hora
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
                      {groupHistory.map((history) => (
                        <tr key={history.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDateTime(history.data_envio)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              history.status 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                            }`}>
                              {history.status ? 'Sucesso' : 'Falha'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {history.mensagem || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
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

      {/* Time Debug Modal */}
      <TimeDebugModal 
        isOpen={isTimeDebugModalOpen}
        onClose={() => setIsTimeDebugModalOpen(false)}
      />

      {/* Help Information */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-300">Informações Importantes</h3>
            <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-400 list-disc list-inside">
              <li>Os resumos são enviados automaticamente no horário configurado (Horário de Brasília).</li>
              <li>O horário de envio é baseado no fuso horário de Brasília (GMT-3).</li>
              <li>Você pode enviar um resumo manualmente a qualquer momento clicando no botão de envio.</li>
              <li>Para que os resumos sejam enviados, o grupo deve estar ativo.</li>
              <li>A URL do grupo deve ser um webhook válido da WiseApp.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumosGrupo;