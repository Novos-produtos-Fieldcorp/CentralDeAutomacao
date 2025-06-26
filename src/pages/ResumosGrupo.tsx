import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Clock, CheckCircle2, XCircle, MessagesSquare, Users, Truck, FileText, Calendar, BarChart2, Settings, Bell, Mail, Phone, Home, User, Briefcase, Coffee, Heart, Star, Music, Film, Book, Camera, Compass, Map, Gift, Award, Bookmark, Clipboard, Database, Folder, Globe, Image, Key, Link, Lock, Monitor, Moon, Sun, Paperclip, Percent, Printer, Radio, Save, Server, Share2, ShoppingBag, ShoppingCart, Smartphone, Speaker, Tag, Terminal, ThumbsUp, PenTool as Tool, Trash, Tv, Umbrella, Video, Wifi, Zap, AlertCircle, AlertTriangle, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, AtSign, Battery, BellOff, Bluetooth, Bold, Box, Calendar as CalendarIcon, Cast, Circle, Cloud, Code, Command, Copy, CreditCard, Crop, Download, Droplet, ExternalLink, Eye, EyeOff, Facebook, FastForward, Feather, File, Flag, Frown, Gitlab, Grid, Hash, Headphones, HelpCircle, Inbox, Instagram, Italic, Layers, Layout, LifeBuoy, Loader, MapPin, Maximize, Meh, Menu, MessageCircle, Mic, Minimize, MoreHorizontal, MoreVertical, Move, Navigation, Octagon, Package, Pause, Play, Power, RefreshCw, RotateCw, Scissors, Search as SearchIcon, Send, Settings as SettingsIcon, Shield, Shuffle, Sidebar, Slash, Sliders, Smile, Square, Twitter, Type, Underline, Upload, UserCheck, UserMinus, UserPlus, UserX, Watch, Wind, X, Youtube, Zap as ZapIcon, Loader2, History } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

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
  company_id: number;
  data_envio: string;
  status: boolean;
  mensagem: string;
  created_at: string;
  grupo?: {
    nome_grupo: string;
    icon_name?: string;
    color_name?: string;
  };
}

// Map of icon names to components
const iconMap: Record<string, React.ElementType> = {
  MessagesSquare,
  Users,
  Truck,
  FileText,
  Calendar,
  BarChart2,
  Settings,
  Bell,
  Mail,
  Phone,
  Home,
  User,
  Briefcase,
  Coffee,
  Heart,
  Star,
  Music,
  Film,
  Book,
  Camera,
  Compass,
  Map,
  Gift,
  Award,
  Bookmark,
  Clipboard,
  Database,
  Folder,
  Globe,
  Image,
  Key,
  Link,
  Lock,
  Monitor,
  Moon,
  Sun,
  Paperclip,
  Percent,
  Printer,
  Radio,
  Save,
  Server,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Speaker,
  Tag,
  Terminal,
  ThumbsUp,
  Tool,
  Trash,
  Tv,
  Umbrella,
  Video,
  Wifi,
  Zap
};

// Map of color names to Tailwind classes
const colorMap: Record<string, { bg: string; text: string; border: string; hoverBg: string; darkBg: string; darkText: string; darkBorder: string; darkHoverBg: string }> = {
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    hoverBg: 'hover:bg-blue-200',
    darkBg: 'dark:bg-blue-900/20',
    darkText: 'dark:text-blue-200',
    darkBorder: 'dark:border-blue-800/30',
    darkHoverBg: 'dark:hover:bg-blue-900/30'
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    hoverBg: 'hover:bg-green-200',
    darkBg: 'dark:bg-green-900/20',
    darkText: 'dark:text-green-200',
    darkBorder: 'dark:border-green-800/30',
    darkHoverBg: 'dark:hover:bg-green-900/30'
  },
  red: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    hoverBg: 'hover:bg-red-200',
    darkBg: 'dark:bg-red-900/20',
    darkText: 'dark:text-red-200',
    darkBorder: 'dark:border-red-800/30',
    darkHoverBg: 'dark:hover:bg-red-900/30'
  },
  yellow: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    hoverBg: 'hover:bg-yellow-200',
    darkBg: 'dark:bg-yellow-900/20',
    darkText: 'dark:text-yellow-200',
    darkBorder: 'dark:border-yellow-800/30',
    darkHoverBg: 'dark:hover:bg-yellow-900/30'
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    hoverBg: 'hover:bg-purple-200',
    darkBg: 'dark:bg-purple-900/20',
    darkText: 'dark:text-purple-200',
    darkBorder: 'dark:border-purple-800/30',
    darkHoverBg: 'dark:hover:bg-purple-900/30'
  },
  pink: {
    bg: 'bg-pink-100',
    text: 'text-pink-800',
    border: 'border-pink-200',
    hoverBg: 'hover:bg-pink-200',
    darkBg: 'dark:bg-pink-900/20',
    darkText: 'dark:text-pink-200',
    darkBorder: 'dark:border-pink-800/30',
    darkHoverBg: 'dark:hover:bg-pink-900/30'
  },
  indigo: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    hoverBg: 'hover:bg-indigo-200',
    darkBg: 'dark:bg-indigo-900/20',
    darkText: 'dark:text-indigo-200',
    darkBorder: 'dark:border-indigo-800/30',
    darkHoverBg: 'dark:hover:bg-indigo-900/30'
  },
  gray: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
    hoverBg: 'hover:bg-gray-200',
    darkBg: 'dark:bg-gray-700/50',
    darkText: 'dark:text-gray-200',
    darkBorder: 'dark:border-gray-600/30',
    darkHoverBg: 'dark:hover:bg-gray-700/70'
  }
};

const ResumosGrupo = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<GrupoResumo[]>([]);
  const [envios, setEnvios] = useState<EnvioResumo[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoResumo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingManualSummary, setSendingManualSummary] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [timeDetails, setTimeDetails] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'grupos' | 'historico'>('grupos');

  // Form state for add/edit modal
  const [formData, setFormData] = useState<{
    nome_grupo: string;
    url_grupo: string;
    horario: string;
    ativo: boolean;
    icon_name: string;
    color_name: string;
  }>({
    nome_grupo: '',
    url_grupo: '',
    horario: '08:00',
    ativo: true,
    icon_name: 'MessagesSquare',
    color_name: 'blue'
  });

  useEffect(() => {
    if (companyId) {
      fetchGrupos();
      fetchEnvios();
      fetchCurrentTime();
    }
  }, [companyId]);

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

  const fetchEnvios = async () => {
    try {
      const { data, error } = await supabase
        .from('envio_resumo')
        .select(`
          *,
          grupo:grupo_id (
            nome_grupo,
            icon_name,
            color_name
          )
        `)
        .eq('company_id', companyId)
        .order('data_envio', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEnvios(data || []);
    } catch (error) {
      console.error('Error fetching envios:', error);
      toast.error('Erro ao carregar histórico de envios');
    }
  };

  const fetchCurrentTime = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_brasilia_time');
      if (error) throw error;
      setCurrentTime(data || '');

      // Fetch detailed time information for debugging
      const { data: details, error: detailsError } = await supabase.rpc('get_current_brasilia_time_details');
      if (detailsError) throw detailsError;
      setTimeDetails(details);
    } catch (error) {
      console.error('Error fetching current time:', error);
    }
  };

  const handleOpenAddModal = () => {
    setFormData({
      nome_grupo: '',
      url_grupo: '',
      horario: '08:00',
      ativo: true,
      icon_name: 'MessagesSquare',
      color_name: 'blue'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (grupo: GrupoResumo) => {
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
  };

  const handleOpenDeleteModal = (grupo: GrupoResumo) => {
    setSelectedGrupo(grupo);
    setIsDeleteModalOpen(true);
  };

  const handleAddGrupo = async () => {
    try {
      if (!formData.nome_grupo || !formData.url_grupo) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      const { data, error } = await supabase
        .from('grupo_resumo')
        .insert({
          nome_grupo: formData.nome_grupo,
          url_grupo: formData.url_grupo,
          horario: formData.horario,
          ativo: formData.ativo,
          company_id: companyId,
          icon_name: formData.icon_name,
          color_name: formData.color_name
        })
        .select();

      if (error) throw error;
      
      setGrupos([...(data || []), ...grupos]);
      setIsAddModalOpen(false);
      toast.success('Grupo adicionado com sucesso');
    } catch (error) {
      console.error('Error adding grupo:', error);
      toast.error('Erro ao adicionar grupo');
    }
  };

  const handleEditGrupo = async () => {
    if (!selectedGrupo) return;
    
    try {
      if (!formData.nome_grupo || !formData.url_grupo) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      const { error } = await supabase
        .from('grupo_resumo')
        .update({
          nome_grupo: formData.nome_grupo,
          url_grupo: formData.url_grupo,
          horario: formData.horario,
          ativo: formData.ativo,
          icon_name: formData.icon_name,
          color_name: formData.color_name
        })
        .eq('id', selectedGrupo.id)
        .eq('company_id', companyId);

      if (error) throw error;
      
      // Update the grupos state
      setGrupos(grupos.map(g => 
        g.id === selectedGrupo.id 
          ? { ...g, 
              nome_grupo: formData.nome_grupo, 
              url_grupo: formData.url_grupo, 
              horario: formData.horario, 
              ativo: formData.ativo,
              icon_name: formData.icon_name,
              color_name: formData.color_name
            } 
          : g
      ));
      
      // Update the envios state to reflect the changes in grupo name and icon
      setEnvios(envios.map(e => 
        e.grupo_id === selectedGrupo.id 
          ? { 
              ...e, 
              grupo: { 
                ...e.grupo, 
                nome_grupo: formData.nome_grupo,
                icon_name: formData.icon_name,
                color_name: formData.color_name
              } 
            } 
          : e
      ));
      
      setIsEditModalOpen(false);
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
        .eq('id', selectedGrupo.id)
        .eq('company_id', companyId);

      if (error) throw error;
      
      setGrupos(grupos.filter(g => g.id !== selectedGrupo.id));
      setIsDeleteModalOpen(false);
      toast.success('Grupo excluído com sucesso');
    } catch (error) {
      console.error('Error deleting grupo:', error);
      toast.error('Erro ao excluir grupo');
    }
  };

  const handleSendManualSummary = async (grupoId: number) => {
    try {
      setSendingManualSummary(grupoId);
      
      // Call the edge function to trigger a manual summary
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-summary-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group_id: grupoId,
          company_id: companyId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send summary: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Resumo enviado com sucesso');
        // Refresh the envios list
        fetchEnvios();
      } else {
        throw new Error(result.error || 'Erro desconhecido ao enviar resumo');
      }
    } catch (error) {
      console.error('Error sending manual summary:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar resumo');
    } finally {
      setSendingManualSummary(null);
    }
  };

  const filteredGrupos = grupos.filter(grupo => 
    grupo.nome_grupo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    grupo.url_grupo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEnvios = envios.filter(envio => 
    envio.grupo?.nome_grupo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to render the appropriate icon component
  const renderIcon = (iconName: string | undefined) => {
    const IconComponent = iconName && iconMap[iconName] ? iconMap[iconName] : MessagesSquare;
    return <IconComponent />;
  };

  // Function to get color classes based on color name
  const getColorClasses = (colorName: string | undefined) => {
    return colorName && colorMap[colorName] ? colorMap[colorName] : colorMap.blue;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Resumos em Grupo</h1>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Grupo
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('grupos')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'grupos'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <MessagesSquare className="w-5 h-5 mr-2" />
              Grupos
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'historico'
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
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder={activeTab === 'grupos' ? "Buscar por nome do grupo..." : "Buscar no histórico..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                         dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                         focus:border-blue-500 text-gray-900 dark:text-gray-100"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {activeTab === 'grupos' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGrupos.map(grupo => {
                  const colorClasses = getColorClasses(grupo.color_name);
                  const IconComponent = grupo.icon_name && iconMap[grupo.icon_name] ? iconMap[grupo.icon_name] : MessagesSquare;
                  
                  return (
                    <div 
                      key={grupo.id} 
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 ${colorClasses.bg} ${colorClasses.darkBg} rounded-full`}>
                            <IconComponent className={`w-6 h-6 ${colorClasses.text} ${colorClasses.darkText}`} />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {grupo.nome_grupo}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Envio diário às {grupo.horario}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenEditModal(grupo)}
                            className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors"
                            title="Editar grupo"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(grupo)}
                            className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors"
                            title="Excluir grupo"
                          >
                            <Trash2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <a 
                            href={grupo.url_grupo} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                          >
                            {grupo.url_grupo}
                          </a>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Horário: {grupo.horario}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          grupo.ativo 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                        }`}>
                          {grupo.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        
                        <button
                          onClick={() => handleSendManualSummary(grupo.id)}
                          disabled={sendingManualSummary === grupo.id}
                          className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingManualSummary === grupo.id ? (
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
                  );
                })}
              </div>

              {filteredGrupos.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                  <MessagesSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Nenhum grupo encontrado
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {searchTerm ? 'Nenhum grupo corresponde à sua busca.' : 'Você ainda não tem nenhum grupo configurado.'}
                  </p>
                  <button
                    onClick={handleOpenAddModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                             transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Grupo
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'historico' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Grupo
                      </th>
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
                    {filteredEnvios.length > 0 ? (
                      filteredEnvios.map((envio) => {
                        const colorClasses = getColorClasses(envio.grupo?.color_name);
                        const IconComponent = envio.grupo?.icon_name && iconMap[envio.grupo.icon_name] 
                          ? iconMap[envio.grupo.icon_name] 
                          : MessagesSquare;
                        
                        return (
                          <tr key={envio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`flex-shrink-0 h-10 w-10 ${colorClasses.bg} ${colorClasses.darkBg} rounded-full flex items-center justify-center`}>
                                  <IconComponent className={`h-5 w-5 ${colorClasses.text} ${colorClasses.darkText}`} />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {envio.grupo?.nome_grupo || 'Grupo desconhecido'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-white">
                                {new Date(envio.data_envio).toLocaleDateString('pt-BR')}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(envio.data_envio).toLocaleTimeString('pt-BR')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                envio.status 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                              }`}>
                                {envio.status ? (
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                ) : (
                                  <XCircle className="w-4 h-4 mr-1" />
                                )}
                                {envio.status ? 'Sucesso' : 'Falha'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-white">
                                {envio.mensagem || (envio.status ? 'Resumo enviado com sucesso' : 'Falha no envio do resumo')}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          Nenhum envio encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

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
                  type="text"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData({ ...formData, url_grupo: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                  {Object.keys(iconMap).map((iconName) => {
                    const IconComponent = iconMap[iconName];
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon_name: iconName })}
                        className={`p-2 rounded-lg ${
                          formData.icon_name === iconName
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.keys(colorMap).map((colorName) => {
                    const colorClasses = colorMap[colorName];
                    return (
                      <button
                        key={colorName}
                        type="button"
                        onClick={() => setFormData({ ...formData, color_name: colorName })}
                        className={`p-2 rounded-lg ${colorClasses.bg} ${colorClasses.darkBg} ${
                          formData.color_name === colorName
                            ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          <span className={`capitalize ${colorClasses.text} ${colorClasses.darkText}`}>
                            {colorName}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="ativo" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Ativo
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddGrupo}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {isEditModalOpen && (
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
                  type="text"
                  value={formData.url_grupo}
                  onChange={(e) => setFormData({ ...formData, url_grupo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                  {Object.keys(iconMap).map((iconName) => {
                    const IconComponent = iconMap[iconName];
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon_name: iconName })}
                        className={`p-2 rounded-lg ${
                          formData.icon_name === iconName
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.keys(colorMap).map((colorName) => {
                    const colorClasses = colorMap[colorName];
                    return (
                      <button
                        key={colorName}
                        type="button"
                        onClick={() => setFormData({ ...formData, color_name: colorName })}
                        className={`p-2 rounded-lg ${colorClasses.bg} ${colorClasses.darkBg} ${
                          formData.color_name === colorName
                            ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          <span className={`capitalize ${colorClasses.text} ${colorClasses.darkText}`}>
                            {colorName}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativo-edit"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="ativo-edit" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Ativo
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditGrupo}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                Tem certeza que deseja excluir o grupo "{selectedGrupo?.nome_grupo}"? Esta ação não pode ser desfeita.
              </p>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Nome:</span> {selectedGrupo?.nome_grupo}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">URL:</span> {selectedGrupo?.url_grupo}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Horário:</span> {selectedGrupo?.horario}
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
                onClick={handleDeleteGrupo}
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