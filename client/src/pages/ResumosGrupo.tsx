import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Calendar, MessagesSquare, Trash2, BarChart2, Clock, Link2, Send, Edit2, AlertTriangle, CheckCircle2, XCircle, Settings, Smartphone, LayoutList, History, Users, Bell, FileText, Home, Truck, Gauge, ClipboardCheck, Store, Mail, Phone, Map, Star, Heart, Bookmark, Flag, Award, Zap, Briefcase, Coffee, Compass, Database, Headphones, Image, Key, Layers, Music, Package, Printer, Radio, Shield, ShoppingBag, Smile, Sun, Terminal, Umbrella, Video, Wifi, Activity, Anchor, Archive, AtSign, Battery, Book, Box, Camera, Cast, Cloud, Code, Command, Copy, CreditCard, Disc, Download, Droplet, Eye, Facebook, Film, Filter, Folder, Gift, GitBranch, Globe, Grid, HardDrive, Hash, Instagram, Laptop, Leaf, LifeBuoy, Link, Linkedin, List, Lock, Maximize, Menu, MessageCircle, Mic, Monitor, Moon, Move, Navigation, Octagon, Paperclip, Pause, Percent, Play, Power, RefreshCw as Refresh, RotateCcw, Save, Search, Server, Share, ShoppingCart, Slash, Sliders, Speaker, Square, Tag, Target, ThumbsUp, Trash, Twitter, Upload, User, Voicemail, Volume, Watch, Wind, Youtube, Info } from 'lucide-react';
import webhookImage from '@assets/WhatsApp Image 2025-08-27 at 09.23.59_1756297551444.jpeg';
import { useCompanyData } from '../hooks/useCompanyData';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TimeDebugModal from '../components/TimeDebugModal';
import { convertBrasiliaToUTC, convertUTCToBrasilia } from '../utils/time';

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
  resumo_grupo?: string;
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
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
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
  const [selectedEnvio, setSelectedEnvio] = useState<EnvioResumo | null>(null);
  const [isEnvioModalOpen, setIsEnvioModalOpen] = useState(false);

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
      
      // Convert UTC times from database to Brasilia time for display
      const gruposWithLocalTime = (data || []).map(grupo => ({
        ...grupo,
        horario: convertUTCToBrasilia(grupo.horario)
      }));
      
      setGrupos(gruposWithLocalTime);
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
      
      // Try different approach: use raw SQL query to bypass RLS
      const { data, error } = await supabase.rpc('get_envio_resumo_all', {
        p_company_id: companyId
      });

      if (error) {
        // Fallback to regular query if function doesn't exist
        console.log('Using fallback query');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('envio_resumo')
          .select(`
            *,
            grupo:grupo_id (
              nome_grupo
            )
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (fallbackError) throw fallbackError;
        setAllEnvios(fallbackData || []);
      } else {
        // Process the raw data from the SQL function
        const processedData = (data || []).map((item: any) => ({
          ...item,
          grupo: item.grupo_nome ? { nome_grupo: item.grupo_nome } : null
        }));
        setAllEnvios(processedData);
      }
    } catch (error) {
      console.error('Error fetching all envios:', error);
      toast.error('Erro ao carregar histórico de envios');
    } finally {
      setLoadingAllEnvios(false);
    }
  };

  const handleAddGrupo = async () => {
    // Validar campos obrigatórios
    if (!formData.nome_grupo.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }
    
    if (!formData.url_grupo.trim()) {
      toast.error('URL do grupo é obrigatória');
      return;
    }
    
    if (!formData.horario) {
      toast.error('Horário é obrigatório');
      return;
    }

    try {
      // Convert Brasilia time to UTC for storage in the database
      const utcHorario = convertBrasiliaToUTC(formData.horario);
      
      const { data, error } = await supabase
        .from('grupo_resumo')
        .insert({
          ...formData,
          horario: utcHorario, // Store UTC time in the database
          company_id: companyId
        })
        .select()
        .single();

      if (error) throw error;
      
      // Convert the UTC time back to Brasilia time for display
      const newGrupo = {
        ...data,
        horario: convertUTCToBrasilia(data.horario)
      };
      
      setGrupos([...grupos, newGrupo]);
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

    // Validar campos obrigatórios
    if (!formData.nome_grupo.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }
    
    if (!formData.url_grupo.trim()) {
      toast.error('URL do grupo é obrigatória');
      return;
    }
    
    if (!formData.horario) {
      toast.error('Horário é obrigatório');
      return;
    }

    try {
      // Convert Brasilia time to UTC for storage in the database
      const utcHorario = convertBrasiliaToUTC(formData.horario);
      
      const { error } = await supabase
        .from('grupo_resumo')
        .update({
          nome_grupo: formData.nome_grupo,
          url_grupo: formData.url_grupo,
          horario: utcHorario, // Store UTC time in the database
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
              horario: formData.horario, // Keep Brasilia time for display
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
      
      // Use the hardcoded token for authorization
      const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';
      
      // Use the correct Supabase URL for edge functions
      const supabaseUrl = 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
      const requestUrl = `${supabaseUrl}/functions/v1/manual-summary-trigger`;
      
      console.log('Making request to:', requestUrl);
      console.log('Request payload:', { group_id: grupo.id, company_id: companyId });
      
      // Call the manual-summary-trigger edge function
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          group_id: grupo.id,
          company_id: companyId
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Always read the response as text first to debug
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      if (!response.ok) {
        console.error('Error response:', responseText);
        throw new Error(`Failed to trigger manual summary: ${response.status} - ${responseText}`);
      }
      
      // Try to parse as JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.error('Response text:', responseText);
        throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 100)}...`);
      }
      
      console.log('Manual summary result:', result);
      
      if (result.success) {
        toast.success('Automação iniciada com sucesso');
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
      
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
      Award: <Award />,
      Zap: <Zap />,
      Briefcase: <Briefcase />,
      Coffee: <Coffee />,
      Compass: <Compass />,
      Database: <Database />,
      Headphones: <Headphones />,
      Image: <Image />,
      Key: <Key />,
      Layers: <Layers />,
      Music: <Music />,
      Package: <Package />,
      Printer: <Printer />,
      Radio: <Radio />,
      Shield: <Shield />,
      ShoppingBag: <ShoppingBag />,
      Smile: <Smile />,
      Sun: <Sun />,
      Terminal: <Terminal />,
      Umbrella: <Umbrella />,
      Video: <Video />,
      Wifi: <Wifi />,
      Activity: <Activity />,
      Anchor: <Anchor />,
      Archive: <Archive />,
      AtSign: <AtSign />,
      Battery: <Battery />,
      Book: <Book />,
      Box: <Box />,
      Camera: <Camera />,
      Cast: <Cast />,
      Cloud: <Cloud />,
      Code: <Code />,
      Command: <Command />,
      Copy: <Copy />,
      CreditCard: <CreditCard />,
      Disc: <Disc />,
      Download: <Download />,
      Droplet: <Droplet />,
      Eye: <Eye />,
      Facebook: <Facebook />,
      Film: <Film />,
      Filter: <Filter />,
      Folder: <Folder />,
      Gift: <Gift />,
      GitBranch: <GitBranch />,
      Globe: <Globe />,
      Grid: <Grid />,
      HardDrive: <HardDrive />,
      Hash: <Hash />,
      Instagram: <Instagram />,
      Laptop: <Laptop />,
      Leaf: <Leaf />,
      LifeBuoy: <LifeBuoy />,
      Link: <Link />,
      Linkedin: <Linkedin />,
      List: <List />,
      Lock: <Lock />,
      Maximize: <Maximize />,
      Menu: <Menu />,
      MessageCircle: <MessageCircle />,
      Mic: <Mic />,
      Monitor: <Monitor />,
      Moon: <Moon />,
      Move: <Move />,
      Navigation: <Navigation />,
      Octagon: <Octagon />,
      Paperclip: <Paperclip />,
      Pause: <Pause />,
      Percent: <Percent />,
      Play: <Play />,
      Power: <Power />,
      Refresh: <Refresh />,
      RotateCcw: <RotateCcw />,
      Save: <Save />,
      Search: <Search />,
      Server: <Server />,
      Share: <Share />,
      ShoppingCart: <ShoppingCart />,
      Slash: <Slash />,
      Sliders: <Sliders />,
      Speaker: <Speaker />,
      Square: <Square />,
      Tag: <Tag />,
      Target: <Target />,
      ThumbsUp: <ThumbsUp />,
      Trash: <Trash />,
      Twitter: <Twitter />,
      Upload: <Upload />,
      User: <User />,
      Voicemail: <Voicemail />,
      Volume: <Volume />,
      Watch: <Watch />,
      Wind: <Wind />,
      Youtube: <Youtube />
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
    { value: 'Award', component: <Award /> },
    { value: 'Zap', component: <Zap /> },
    { value: 'Briefcase', component: <Briefcase /> },
    { value: 'Coffee', component: <Coffee /> },
    { value: 'Compass', component: <Compass /> },
    { value: 'Database', component: <Database /> },
    { value: 'Headphones', component: <Headphones /> },
    { value: 'Image', component: <Image /> },
    { value: 'Key', component: <Key /> },
    { value: 'Layers', component: <Layers /> },
    { value: 'Music', component: <Music /> },
    { value: 'Package', component: <Package /> },
    { value: 'Printer', component: <Printer /> },
    { value: 'Radio', component: <Radio /> },
    { value: 'Shield', component: <Shield /> },
    { value: 'ShoppingBag', component: <ShoppingBag /> },
    { value: 'Smile', component: <Smile /> },
    { value: 'Sun', component: <Sun /> },
    { value: 'Terminal', component: <Terminal /> },
    { value: 'Umbrella', component: <Umbrella /> },
    { value: 'Video', component: <Video /> },
    { value: 'Wifi', component: <Wifi /> },
    { value: 'Activity', component: <Activity /> },
    { value: 'Anchor', component: <Anchor /> },
    { value: 'Archive', component: <Archive /> },
    { value: 'AtSign', component: <AtSign /> },
    { value: 'Battery', component: <Battery /> },
    { value: 'Book', component: <Book /> },
    { value: 'Box', component: <Box /> },
    { value: 'Camera', component: <Camera /> },
    { value: 'Cast', component: <Cast /> },
    { value: 'Cloud', component: <Cloud /> },
    { value: 'Code', component: <Code /> },
    { value: 'Command', component: <Command /> },
    { value: 'Copy', component: <Copy /> },
    { value: 'CreditCard', component: <CreditCard /> },
    { value: 'Disc', component: <Disc /> },
    { value: 'Download', component: <Download /> },
    { value: 'Droplet', component: <Droplet /> },
    { value: 'Eye', component: <Eye /> },
    { value: 'Facebook', component: <Facebook /> },
    { value: 'Film', component: <Film /> },
    { value: 'Filter', component: <Filter /> },
    { value: 'Folder', component: <Folder /> },
    { value: 'Gift', component: <Gift /> },
    { value: 'GitBranch', component: <GitBranch /> },
    { value: 'Globe', component: <Globe /> },
    { value: 'Grid', component: <Grid /> },
    { value: 'HardDrive', component: <HardDrive /> },
    { value: 'Hash', component: <Hash /> },
    { value: 'Instagram', component: <Instagram /> },
    { value: 'Laptop', component: <Laptop /> },
    { value: 'Leaf', component: <Leaf /> },
    { value: 'LifeBuoy', component: <LifeBuoy /> },
    { value: 'Link', component: <Link /> },
    { value: 'Linkedin', component: <Linkedin /> },
    { value: 'List', component: <List /> },
    { value: 'Lock', component: <Lock /> },
    { value: 'Maximize', component: <Maximize /> },
    { value: 'Menu', component: <Menu /> },
    { value: 'MessageCircle', component: <MessageCircle /> },
    { value: 'Mic', component: <Mic /> },
    { value: 'Monitor', component: <Monitor /> },
    { value: 'Moon', component: <Moon /> },
    { value: 'Move', component: <Move /> },
    { value: 'Navigation', component: <Navigation /> },
    { value: 'Octagon', component: <Octagon /> },
    { value: 'Paperclip', component: <Paperclip /> },
    { value: 'Pause', component: <Pause /> },
    { value: 'Percent', component: <Percent /> },
    { value: 'Play', component: <Play /> },
    { value: 'Power', component: <Power /> },
    { value: 'Refresh', component: <Refresh /> },
    { value: 'RotateCcw', component: <RotateCcw /> },
    { value: 'Save', component: <Save /> },
    { value: 'Search', component: <Search /> },
    { value: 'Server', component: <Server /> },
    { value: 'Share', component: <Share /> },
    { value: 'ShoppingCart', component: <ShoppingCart /> },
    { value: 'Slash', component: <Slash /> },
    { value: 'Sliders', component: <Sliders /> },
    { value: 'Speaker', component: <Speaker /> },
    { value: 'Square', component: <Square /> },
    { value: 'Tag', component: <Tag /> },
    { value: 'Target', component: <Target /> },
    { value: 'ThumbsUp', component: <ThumbsUp /> },
    { value: 'Trash', component: <Trash /> },
    { value: 'Twitter', component: <Twitter /> },
    { value: 'Upload', component: <Upload /> },
    { value: 'User', component: <User /> },
    { value: 'Voicemail', component: <Voicemail /> },
    { value: 'Volume', component: <Volume /> },
    { value: 'Watch', component: <Watch /> },
    { value: 'Wind', component: <Wind /> },
    { value: 'Youtube', component: <Youtube /> }
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
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
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
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Data/Hora
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Grupo
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Mensagem
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Resumo
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {allEnvios.map((envio) => (
                          <tr key={envio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white">
                              {(() => {
                                const timestampField = envio.created_at || envio.data_envio;
                                const utcDate = parseISO(timestampField);
                                
                                // Extrair diretamente os valores de data/hora em UTC e ajustar manualmente
                                const day = String(utcDate.getUTCDate()).padStart(2, '0');
                                const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
                                let hours = utcDate.getUTCHours() - 3; // Converter para BRT
                                
                                // Tratar casos de mudança de dia
                                if (hours < 0) {
                                  hours += 24;
                                }
                                
                                const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
                                const hoursStr = String(hours).padStart(2, '0');
                                
                                return `${day}/${month} ${hoursStr}:${minutes}`;
                              })()}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white max-w-[120px]">
                              <div className="truncate" title={envio.grupo?.nome_grupo || 'Grupo desconhecido'}>
                                {envio.grupo?.nome_grupo || 'Desconhecido'}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {envio.status ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-[150px]">
                              <div className="truncate" title={envio.mensagem}>
                                {envio.mensagem}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-[150px]">
                              {envio.resumo_grupo ? (
                                <div className="truncate" title={envio.resumo_grupo}>
                                  {envio.resumo_grupo.length > 50 
                                    ? `${envio.resumo_grupo.substring(0, 50)}...` 
                                    : envio.resumo_grupo
                                  }
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setSelectedEnvio(envio);
                                  setIsEnvioModalOpen(true);
                                }}
                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium"
                                title="Ver detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
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
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Grupo *
                  <div className="relative group">
                    <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                      <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded py-1.5 px-2 shadow-lg whitespace-nowrap">
                        Nome deve ser igual ao WhatsApp
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                      </div>
                    </div>
                  </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    URL da Caixa de Entrada *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsHelpModalOpen(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                  >
                    Onde encontro a URL?
                  </button>
                </div>
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
                  Horário de Envio (Brasília) *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Horário no fuso de Brasília (UTC-3)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="flex flex-wrap gap-1 mt-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                  {iconOptions.map(icon => (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon_name: icon.value })}
                      className={`p-2 rounded-lg transition-colors ${
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
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Grupo *
                  <div className="relative group">
                    <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                      <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded py-1.5 px-2 shadow-lg whitespace-nowrap">
                        Nome deve ser igual ao WhatsApp
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                      </div>
                    </div>
                  </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    URL da Caixa de Entrada *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsHelpModalOpen(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                  >
                    Onde encontro a URL?
                  </button>
                </div>
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
                  Horário de Envio (Brasília) *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Horário no fuso de Brasília (UTC-3)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="flex flex-wrap gap-1 mt-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                  {iconOptions.map(icon => (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon_name: icon.value })}
                      className={`p-2 rounded-lg transition-colors ${
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

      {/* Envio Details Modal */}
      {isEnvioModalOpen && selectedEnvio && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="text-blue-500" size={24} />
                Detalhes do Envio
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Data e Hora */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Data e Hora do Envio
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {(() => {
                    const timestampField = selectedEnvio.created_at || selectedEnvio.data_envio;
                    const utcDate = parseISO(timestampField);
                    
                    // Extrair valores UTC e converter manualmente para BRT
                    const day = String(utcDate.getUTCDate()).padStart(2, '0');
                    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
                    const year = utcDate.getUTCFullYear();
                    let hours = utcDate.getUTCHours() - 3; // Converter para BRT
                    
                    if (hours < 0) {
                      hours += 24;
                    }
                    
                    const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
                    const seconds = String(utcDate.getUTCSeconds()).padStart(2, '0');
                    const hoursStr = String(hours).padStart(2, '0');
                    
                    return `${day}/${month}/${year} ${hoursStr}:${minutes}:${seconds}`;
                  })()}
                </p>
              </div>

              {/* Grupo */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  Grupo
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {selectedEnvio.grupo?.nome_grupo || 'Grupo desconhecido'}
                </p>
              </div>

              {/* Status */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  {selectedEnvio.status ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  Status do Envio
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    selectedEnvio.status 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                  }`}>
                    {selectedEnvio.status ? 'Sucesso' : 'Falha'}
                  </span>
                </div>
              </div>

              {/* Mensagem */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-orange-500" />
                  Mensagem de Resposta
                </h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedEnvio.mensagem}
                </p>
              </div>

              {/* Resumo Enviado */}
              {selectedEnvio.resumo_grupo && (
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-500" />
                    Resumo Enviado
                  </h3>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-4 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedEnvio.resumo_grupo}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsEnvioModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Como consigo a URL da caixa de entrada?
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <p>
                  Certifique-se de que o número de telefone conectado ao WiseApp está no grupo que será resumido.
                </p>
                <div>
                  <p className="mb-2">Acesse as configurações da caixa de entrada:</p>
                  <ol className="list-decimal list-inside ml-4 space-y-1">
                    <li>Vá para Configurações</li>
                    <li>Caixa de entrada</li>
                    <li>Configurações da caixa de entrada</li>
                  </ol>
                </div>
                <div>
                  <p className="mb-3">
                    Localize o campo <strong>URL do webhook</strong>:
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-3">
                    <img 
                      src={webhookImage}
                      alt="Tela mostrando o campo URL do webhook"
                      className="max-w-full h-auto rounded border"
                    />
                  </div>
                </div>
                <p>
                  Copie o link do webhook e cole no campo <strong>URL da caixa de entrada</strong>.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500"
              >
                Entendido
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