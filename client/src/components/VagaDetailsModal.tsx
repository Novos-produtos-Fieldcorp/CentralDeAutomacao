import React, { useState, useEffect, useRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';
import { format, parse } from 'date-fns';
registerLocale('pt-BR', ptBR);
import { X, Edit2, Calendar, Users, Building, Clock, MapPin, User, Briefcase, Search, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useTheme } from '../context/ThemeContext';
import { VagaWithRelations } from '../lib/vagasService';
import { API_BASE_URL } from '../lib/api-config-supabase';

interface VagaDetailsModalProps {
  vaga: VagaWithRelations;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

interface DropdownData {
  clientes: Array<{ cliente_id: number; nome: string }>;
  unidades: Array<{ id: number; unidade: string }>;
  operacoes: Array<{ id: number; operacao: string }>;
  statusVagas: Array<{ id: number; status_vaga: string }>;
}

const parseHorario = (horario: string | null | undefined): { de: Date | null; ate: Date | null } => {
  if (!horario) return { de: null, ate: null };
  const match = horario.match(/^(\d{2}:\d{2})\s+às\s+(\d{2}:\d{2})$/);
  if (match) {
    try {
      return {
        de: parse(match[1], 'HH:mm', new Date()),
        ate: parse(match[2], 'HH:mm', new Date()),
      };
    } catch {
      return { de: null, ate: null };
    }
  }
  return { de: null, ate: null };
};

const parseDistancia = (distancia: string | null | undefined): number => {
  if (!distancia) return 0;
  const match = distancia.match(/^(\d+)\s*km$/);
  return match ? parseInt(match[1]) : 0;
};

const VagaDetailsModal: React.FC<VagaDetailsModalProps> = ({ vaga: initialVaga, isOpen, onClose, onUpdate }) => {
  const { accountId } = useCurrentAccount();
  const { isDark } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [currentVaga, setCurrentVaga] = useState(initialVaga);
  const [loading, setLoading] = useState(false);

  const [dropdownData, setDropdownData] = useState<DropdownData>({
    clientes: [],
    unidades: [],
    operacoes: [],
    statusVagas: []
  });

  const initFormData = (vaga: VagaWithRelations) => ({
    nome: vaga.nome || '',
    descricao: vaga.descricao || '',
    quantidade: vaga.quantidade || 0,
    dias_trabalho: Array.isArray(vaga.dias_trabalho) ? vaga.dias_trabalho :
      typeof vaga.dias_trabalho === 'string' ? (JSON.parse(vaga.dias_trabalho || '[]') as string[]) : [] as string[],
    tipo_contrato: vaga.tipo_contrato || '',
    unidade_id: vaga.unidade_id ?? '',
    operacao_id: vaga.operacao_id ?? '',
    st_vaga_id: vaga.st_vaga_id ?? '',
    cliente_id: vaga.cliente_id ?? '',
  });

  const [formData, setFormData] = useState(initFormData(initialVaga));
  const [ativoEdit, setAtivoEdit] = useState<boolean>(initialVaga.ativo !== false);
  const [distanciaKm, setDistanciaKm] = useState<number>(parseDistancia(initialVaga.distancia));
  const [horarioDe, setHorarioDe] = useState<Date | null>(parseHorario(initialVaga.horario).de);
  const [horarioAte, setHorarioAte] = useState<Date | null>(parseHorario(initialVaga.horario).ate);
  const [dtLimitePicker, setDtLimitePicker] = useState<Date | null>(
    initialVaga.dt_limite ? new Date(initialVaga.dt_limite) : null
  );

  // Dropdown state for 5 custom dropdowns
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showUnidadeDropdown, setShowUnidadeDropdown] = useState(false);
  const [showOperacaoDropdown, setShowOperacaoDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTipoContratoDropdown, setShowTipoContratoDropdown] = useState(false);

  // Search state for dropdowns
  const [clienteSearch, setClienteSearch] = useState('');
  const [unidadeSearch, setUnidadeSearch] = useState('');
  const [operacaoSearch, setOperacaoSearch] = useState('');
  const [statusSearch, setStatusSearch] = useState('');
  const [tipoContratoSearch, setTipoContratoSearch] = useState('');

  // Refs for click-outside detection
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  const unidadeDropdownRef = useRef<HTMLDivElement>(null);
  const operacaoDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const tipoContratoDropdownRef = useRef<HTMLDivElement>(null);

  const resetEditState = (vaga: VagaWithRelations) => {
    setFormData(initFormData(vaga));
    setAtivoEdit(vaga.ativo !== false);
    setDistanciaKm(parseDistancia(vaga.distancia));
    const parsedHorario = parseHorario(vaga.horario);
    setHorarioDe(parsedHorario.de);
    setHorarioAte(parsedHorario.ate);
    setDtLimitePicker(vaga.dt_limite ? new Date(vaga.dt_limite) : null);
  };

  const diasSemana = [
    { value: 'segunda', label: 'Segunda' },
    { value: 'terca', label: 'Terça' },
    { value: 'quarta', label: 'Quarta' },
    { value: 'quinta', label: 'Quinta' },
    { value: 'sexta', label: 'Sexta' },
    { value: 'sabado', label: 'Sábado' },
    { value: 'domingo', label: 'Domingo' },
  ];

  const diasSemanaFull = [
    { value: 'segunda', label: 'Segunda-feira' },
    { value: 'terca', label: 'Terça-feira' },
    { value: 'quarta', label: 'Quarta-feira' },
    { value: 'quinta', label: 'Quinta-feira' },
    { value: 'sexta', label: 'Sexta-feira' },
    { value: 'sabado', label: 'Sábado' },
    { value: 'domingo', label: 'Domingo' },
  ];

  useEffect(() => {
    if (isOpen && isEditing) {
      fetchDropdownData();
    }
  }, [isOpen, isEditing, accountId]);

  useEffect(() => {
    setCurrentVaga(initialVaga);
    setFormData(initFormData(initialVaga));
    setAtivoEdit(initialVaga.ativo !== false);
    setDistanciaKm(parseDistancia(initialVaga.distancia));
    const parsedHorario = parseHorario(initialVaga.horario);
    setHorarioDe(parsedHorario.de);
    setHorarioAte(parsedHorario.ate);
    setDtLimitePicker(initialVaga.dt_limite ? new Date(initialVaga.dt_limite) : null);
  }, [initialVaga]);

  // Click-outside handler for all 5 dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(e.target as Node)) setShowClienteDropdown(false);
      if (unidadeDropdownRef.current && !unidadeDropdownRef.current.contains(e.target as Node)) setShowUnidadeDropdown(false);
      if (operacaoDropdownRef.current && !operacaoDropdownRef.current.contains(e.target as Node)) setShowOperacaoDropdown(false);
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setShowStatusDropdown(false);
      if (tipoContratoDropdownRef.current && !tipoContratoDropdownRef.current.contains(e.target as Node)) setShowTipoContratoDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDropdownData = async () => {
    if (!accountId) return;
    try {
      const companyRes = await fetch(`${API_BASE_URL}/company/by-account/${accountId}`);
      if (!companyRes.ok) return;
      const companyData = await companyRes.json();
      const companyId = companyData.company_id;

      const [clientesRes, unidadesRes, operacoesRes, statusRes] = await Promise.all([
        fetch(`${API_BASE_URL}/clientes/${companyId}`),
        fetch(`${API_BASE_URL}/unidades/${companyId}`),
        fetch(`${API_BASE_URL}/operacoes/${companyId}`),
        fetch(`${API_BASE_URL}/status-vagas/${companyId}`),
      ]);

      const [clientes, unidades, operacoes, statusVagas] = await Promise.all([
        clientesRes.json(),
        unidadesRes.json(),
        operacoesRes.json(),
        statusRes.json(),
      ]);

      setDropdownData({ clientes, unidades, operacoes, statusVagas });
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const handleDiaToggle = (dia: string) => {
    setFormData(prev => ({
      ...prev,
      dias_trabalho: prev.dias_trabalho.includes(dia)
        ? prev.dias_trabalho.filter((d: string) => d !== dia)
        : [...prev.dias_trabalho, dia]
    }));
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.nome.trim()) errors.push('Nome da vaga é obrigatório');
    if (!formData.descricao.trim()) errors.push('Descrição é obrigatória');
    if (!formData.quantidade || formData.quantidade <= 0) errors.push('Quantidade deve ser maior que 0');
    if (!horarioDe && !horarioAte) errors.push('Horário é obrigatório');
    if (formData.dias_trabalho.length === 0) errors.push('Selecione pelo menos um dia de trabalho');
    if (!formData.cliente_id) errors.push('Cliente é obrigatório');
    if (!formData.unidade_id) errors.push('Unidade é obrigatória');
    if (!formData.operacao_id) errors.push('Operação é obrigatória');
    if (!formData.st_vaga_id) errors.push('Status é obrigatório');
    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast.error(error));
      return;
    }

    setLoading(true);

    try {
      const companyRes = await fetch(`${API_BASE_URL}/company/by-account/${accountId}`);
      if (!companyRes.ok) {
        toast.error('Erro ao obter dados da empresa');
        return;
      }
      const companyData = await companyRes.json();
      const companyId = companyData.company_id;

      const deStr = horarioDe ? format(horarioDe, 'HH:mm') : '';
      const ateStr = horarioAte ? format(horarioAte, 'HH:mm') : '';
      const horarioStr = deStr && ateStr ? `${deStr} às ${ateStr}` : deStr || ateStr || '';

      const updateData = {
        ...formData,
        company_id: companyId,
        quantidade: Number(formData.quantidade),
        unidade_id: formData.unidade_id ? Number(formData.unidade_id) : null,
        operacao_id: formData.operacao_id ? Number(formData.operacao_id) : null,
        st_vaga_id: formData.st_vaga_id ? Number(formData.st_vaga_id) : null,
        cliente_id: formData.cliente_id ? Number(formData.cliente_id) : null,
        horario: horarioStr,
        distancia: distanciaKm > 0 ? `${distanciaKm} km` : null,
        dt_limite: dtLimitePicker ? dtLimitePicker.toISOString() : null,
        tipo_contrato: formData.tipo_contrato || null,
        ativo: ativoEdit,
      };

      const response = await fetch(`${API_BASE_URL}/vagas/${currentVaga.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedVaga = await response.json();
        setCurrentVaga(updatedVaga.vaga || { ...currentVaga, ...updateData });
        toast.success('Vaga atualizada com sucesso!');
        setIsEditing(false);
        onUpdate();
      } else {
        const errorData = await response.json();
        toast.error(`Erro ao atualizar: ${errorData.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Error updating vaga:', error);
      toast.error('Erro ao atualizar vaga');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Não definida';
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const getDiasTrabalhoFormatted = () => {
    const dias = Array.isArray(currentVaga.dias_trabalho) ? currentVaga.dias_trabalho :
      typeof currentVaga.dias_trabalho === 'string' ? JSON.parse(currentVaga.dias_trabalho || '[]') : [];
    if (dias.length === 0) return 'Não definido';
    return dias.map((dia: string) => {
      const diaObj = diasSemanaFull.find(d => d.value === dia);
      return diaObj ? diaObj.label : dia;
    }).join(', ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto relative z-50 shadow-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Editar Vaga' : 'Detalhes da Vaga'}
          </h2>
          <div className="flex items-center space-x-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {isEditing ? (
            <>
              {/* Ativo Toggle */}
              <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Vaga Ativa</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A vaga estará visível e disponível para candidaturas</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAtivoEdit(!ativoEdit)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    ativoEdit ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${ativoEdit ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Nome + Quantidade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome da Vaga *
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Ex: Motorista Categoria D"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quantidade de Vagas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantidade}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantidade: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Ex: 5"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição *
                </label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="Descreva os requisitos e responsabilidades da vaga"
                />
              </div>

              {/* Cliente + Unidade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cliente *
                  </label>
                  <div className="relative" ref={clienteDropdownRef}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-10"
                      onClick={() => { setShowClienteDropdown(p => !p); setShowUnidadeDropdown(false); setShowOperacaoDropdown(false); setShowStatusDropdown(false); setShowTipoContratoDropdown(false); }}
                    >
                      <Building className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="flex-1 text-left truncate">
                        {dropdownData.clientes.find(c => c.cliente_id == formData.cliente_id)?.nome || 'Selecione um cliente'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </button>
                    {showClienteDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-lg border border-gray-200 dark:border-gray-600 z-[999]">
                        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                          <div className="relative">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar cliente..."
                              value={clienteSearch}
                              onChange={(e) => setClienteSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto py-1">
                          <div
                            className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                            onClick={() => { setFormData(prev => ({ ...prev, cliente_id: '' })); setShowClienteDropdown(false); setClienteSearch(''); }}
                          >
                            Nenhum
                          </div>
                          {dropdownData.clientes.filter(c => c.nome.toLowerCase().includes(clienteSearch.toLowerCase())).map(c => (
                            <div
                              key={c.cliente_id}
                              className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm ${formData.cliente_id == c.cliente_id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => { setFormData(prev => ({ ...prev, cliente_id: c.cliente_id })); setShowClienteDropdown(false); setClienteSearch(''); }}
                            >
                              {c.nome}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Unidade Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unidade *
                  </label>
                  <div className="relative" ref={unidadeDropdownRef}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-10"
                      onClick={() => { setShowUnidadeDropdown(p => !p); setShowClienteDropdown(false); setShowOperacaoDropdown(false); setShowStatusDropdown(false); setShowTipoContratoDropdown(false); }}
                    >
                      <Building className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="flex-1 text-left truncate">
                        {dropdownData.unidades.find(u => u.id == formData.unidade_id)?.unidade || 'Selecione uma unidade'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </button>
                    {showUnidadeDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-lg border border-gray-200 dark:border-gray-600 z-[999]">
                        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                          <div className="relative">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar unidade..."
                              value={unidadeSearch}
                              onChange={(e) => setUnidadeSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto py-1">
                          <div
                            className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                            onClick={() => { setFormData(prev => ({ ...prev, unidade_id: '' })); setShowUnidadeDropdown(false); setUnidadeSearch(''); }}
                          >
                            Nenhum
                          </div>
                          {dropdownData.unidades.filter(u => u.unidade.toLowerCase().includes(unidadeSearch.toLowerCase())).map(u => (
                            <div
                              key={u.id}
                              className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm ${formData.unidade_id == u.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => { setFormData(prev => ({ ...prev, unidade_id: u.id })); setShowUnidadeDropdown(false); setUnidadeSearch(''); }}
                            >
                              {u.unidade}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Operação + Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Operação Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Operação *
                  </label>
                  <div className="relative" ref={operacaoDropdownRef}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-10"
                      onClick={() => { setShowOperacaoDropdown(p => !p); setShowClienteDropdown(false); setShowUnidadeDropdown(false); setShowStatusDropdown(false); setShowTipoContratoDropdown(false); }}
                    >
                      <Briefcase className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="flex-1 text-left truncate">
                        {dropdownData.operacoes.find(o => o.id == formData.operacao_id)?.operacao || 'Selecione uma operação'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </button>
                    {showOperacaoDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-lg border border-gray-200 dark:border-gray-600 z-[999]">
                        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                          <div className="relative">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar operação..."
                              value={operacaoSearch}
                              onChange={(e) => setOperacaoSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto py-1">
                          <div
                            className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                            onClick={() => { setFormData(prev => ({ ...prev, operacao_id: '' })); setShowOperacaoDropdown(false); setOperacaoSearch(''); }}
                          >
                            Nenhum
                          </div>
                          {dropdownData.operacoes.filter(o => o.operacao.toLowerCase().includes(operacaoSearch.toLowerCase())).map(o => (
                            <div
                              key={o.id}
                              className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm ${formData.operacao_id == o.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => { setFormData(prev => ({ ...prev, operacao_id: o.id })); setShowOperacaoDropdown(false); setOperacaoSearch(''); }}
                            >
                              {o.operacao}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status *
                  </label>
                  <div className="relative" ref={statusDropdownRef}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-10"
                      onClick={() => { setShowStatusDropdown(p => !p); setShowClienteDropdown(false); setShowUnidadeDropdown(false); setShowOperacaoDropdown(false); setShowTipoContratoDropdown(false); }}
                    >
                      <Users className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="flex-1 text-left truncate">
                        {dropdownData.statusVagas.find(s => s.id == formData.st_vaga_id)?.status_vaga || 'Selecione um status'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </button>
                    {showStatusDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-lg border border-gray-200 dark:border-gray-600 z-[999]">
                        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                          <div className="relative">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar status..."
                              value={statusSearch}
                              onChange={(e) => setStatusSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto py-1">
                          <div
                            className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                            onClick={() => { setFormData(prev => ({ ...prev, st_vaga_id: '' })); setShowStatusDropdown(false); setStatusSearch(''); }}
                          >
                            Nenhum
                          </div>
                          {dropdownData.statusVagas.filter(s => s.status_vaga.toLowerCase().includes(statusSearch.toLowerCase())).map(s => (
                            <div
                              key={s.id}
                              className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm ${formData.st_vaga_id == s.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => { setFormData(prev => ({ ...prev, st_vaga_id: s.id })); setShowStatusDropdown(false); setStatusSearch(''); }}
                            >
                              {s.status_vaga}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tipo de Contrato Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Contrato
                </label>
                <div className="relative" ref={tipoContratoDropdownRef}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-10"
                    onClick={() => { setShowTipoContratoDropdown(p => !p); setShowClienteDropdown(false); setShowUnidadeDropdown(false); setShowOperacaoDropdown(false); setShowStatusDropdown(false); }}
                  >
                    <Briefcase className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="flex-1 text-left truncate">
                      {formData.tipo_contrato || 'Selecione o tipo de contrato'}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </button>
                  {showTipoContratoDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-lg border border-gray-200 dark:border-gray-600 z-[999]">
                      <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="relative">
                          <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar tipo de contrato..."
                            value={tipoContratoSearch}
                            onChange={(e) => setTipoContratoSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-44 overflow-y-auto py-1">
                        <div
                          className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                          onClick={() => { setFormData(prev => ({ ...prev, tipo_contrato: '' })); setShowTipoContratoDropdown(false); setTipoContratoSearch(''); }}
                        >
                          Nenhum
                        </div>
                        {['CLT', 'PJ', 'Temporário', 'Autônomo'].filter(t => t.toLowerCase().includes(tipoContratoSearch.toLowerCase())).map(t => (
                          <div
                            key={t}
                            className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm ${formData.tipo_contrato === t ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                            onClick={() => { setFormData(prev => ({ ...prev, tipo_contrato: t })); setShowTipoContratoDropdown(false); setTipoContratoSearch(''); }}
                          >
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Distância Limite — Slider */}
              <div
                style={{
                  background: isDark ? '#243044' : '#f1f5f9',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: isDark ? '#cbd5e1' : '#374151' }}>
                    Distância Limite
                  </span>
                  {distanciaKm === 0 ? (
                    <span style={{
                      background: isDark ? 'rgba(138,155,181,0.1)' : 'rgba(0,0,0,0.06)',
                      color: isDark ? '#8a9bb5' : '#6b7280',
                      padding: '2px 10px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}>
                      Sem limite
                    </span>
                  ) : (
                    <span style={{
                      background: isDark ? 'rgba(79,142,247,0.12)' : 'rgba(59,130,246,0.1)',
                      color: isDark ? '#4f8ef7' : '#2563eb',
                      padding: '2px 10px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}>
                      {distanciaKm} km
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={distanciaKm}
                  onChange={(e) => setDistanciaKm(Number(e.target.value))}
                  style={{ width: '100%', accentColor: isDark ? '#4f8ef7' : '#2563eb', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: isDark ? '#4a5a72' : '#9ca3af' }}>0 km</span>
                  <span style={{ fontSize: '11px', color: isDark ? '#4a5a72' : '#9ca3af' }}>50 km</span>
                  <span style={{ fontSize: '11px', color: isDark ? '#4a5a72' : '#9ca3af' }}>100 km</span>
                </div>
              </div>

              {/* Dias de Trabalho */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Dias de Trabalho *
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">(clique para selecionar)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {diasSemana.map((dia) => {
                    const selecionado = formData.dias_trabalho.includes(dia.value);
                    return (
                      <button
                        key={dia.value}
                        type="button"
                        onClick={() => handleDiaToggle(dia.value)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors select-none ${
                          selecionado
                            ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-400'
                        }`}
                      >
                        {dia.label}
                      </button>
                    );
                  })}
                </div>
                {formData.dias_trabalho.length > 0 && (
                  <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    {formData.dias_trabalho.length} dia{formData.dias_trabalho.length > 1 ? 's' : ''} selecionado{formData.dias_trabalho.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Horário */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Horário *
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col flex-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">De</span>
                    <DatePicker
                      selected={horarioDe ?? undefined}
                      onChange={(date: Date | null) => setHorarioDe(date)}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={15}
                      timeFormat="HH:mm"
                      dateFormat="HH:mm"
                      placeholderText="08:00"
                      isClearable
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      wrapperClassName="w-full"
                      calendarClassName={isDark ? 'dark-datepicker' : 'light-datepicker'}
                      locale="pt-BR"
                    />
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 mt-4 select-none">—</span>
                  <div className="flex flex-col flex-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Até</span>
                    <DatePicker
                      selected={horarioAte ?? undefined}
                      onChange={(date: Date | null) => setHorarioAte(date)}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={15}
                      timeFormat="HH:mm"
                      dateFormat="HH:mm"
                      placeholderText="17:00"
                      isClearable
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      wrapperClassName="w-full"
                      calendarClassName={isDark ? 'dark-datepicker' : 'light-datepicker'}
                      locale="pt-BR"
                    />
                  </div>
                </div>
              </div>

              {/* Data Limite */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data Limite (Opcional)
                </label>
                <DatePicker
                  selected={dtLimitePicker}
                  onChange={(date: Date | null) => setDtLimitePicker(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="dd/MM/yyyy HH:mm"
                  placeholderText="Selecione data e hora"
                  isClearable
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  wrapperClassName="w-full"
                  calendarClassName={isDark ? 'dark-datepicker' : 'light-datepicker'}
                  locale="pt-BR"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => { resetEditState(currentVaga); setIsEditing(false); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Ativo Badge */}
              <div className="flex items-center gap-2 py-2 px-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status da Vaga:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  currentVaga.ativo !== false
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {currentVaga.ativo !== false ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              {/* Visualização das Informações */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-6">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Informações da Vaga
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Detalhes completos da vaga de trabalho.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                        <User className="w-4 h-4 mr-2" />
                        Nome da Vaga
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {currentVaga.nome}
                      </dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Descrição
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {currentVaga.descricao}
                      </dd>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                        <Users className="w-4 h-4 mr-2" />
                        Quantidade
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {currentVaga.quantidade}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                        <Clock className="w-4 h-4 mr-2" />
                        Horário
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {currentVaga.horario || 'Não informado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                        <Briefcase className="w-4 h-4 mr-2" />
                        Tipo Contrato
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {currentVaga.tipo_contrato || 'Não informado'}
                      </dd>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                        <MapPin className="w-4 h-4 mr-2" />
                        Distância
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {currentVaga.distancia || 'Sem limite'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                        <Calendar className="w-4 h-4 mr-2" />
                        Dias Trabalho
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {getDiasTrabalhoFormatted()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                        <Calendar className="w-4 h-4 mr-2" />
                        Data Limite
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {formatDate(currentVaga.dt_limite?.toString())}
                      </dd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações de Relacionamento */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-4">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Cliente e Unidade
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                      <Building className="w-4 h-4 mr-2" />
                      Cliente
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {currentVaga.cliente_nome || 'Não informado'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center mb-1">
                      <MapPin className="w-4 h-4 mr-2" />
                      Unidade
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {currentVaga.unidade_nome || 'Não informado'}
                    </dd>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Operação
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {currentVaga.operacao_nome || 'Não informado'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Status
                    </dt>
                    <dd className="text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        currentVaga.status_nome === 'Ativa' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        currentVaga.status_nome === 'Em Andamento' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                      }`}>
                        {currentVaga.status_nome || 'Não informado'}
                      </span>
                    </dd>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default VagaDetailsModal;
