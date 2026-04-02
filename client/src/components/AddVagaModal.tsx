import React, { useState, useEffect } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
registerLocale('pt-BR', ptBR);
import { X, Calendar, MapPin, Users, Building, Clock, FileText, Plus, Sparkles, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { useTheme } from '../context/ThemeContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertVagaSchema, type InsertVaga, type Cliente, type Unidade, type Operacao, type StVaga, type Logradouro } from '@shared/schema';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import {
  fetchCompanyByAccount,
  fetchClientes,
  fetchUnidades,
  fetchOperacoes,
  fetchStatusVagas,
  createVaga,
  createUnidade,
  createOperacao,
  createStatusVaga,
  createEndVaga,
  VagaWithRelations
} from '../lib/vagasService';

interface AddVagaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddVagaModal: React.FC<AddVagaModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { isDark } = useTheme();
  const { accountId: wiseappAccountId } = useWiseAppAccess();
  const { accountId: authAccountId } = useAuth();
  // Use WiseApp account ID (updated when switching accounts) as primary source
  const accountId = wiseappAccountId || authAccountId;
  const [showNewUnidadeInput, setShowNewUnidadeInput] = useState(false);
  const [showNewOperacaoInput, setShowNewOperacaoInput] = useState(false);
  const [showNewStatusInput, setShowNewStatusInput] = useState(false);
  const [newUnidadeName, setNewUnidadeName] = useState('');
  const [newOperacaoName, setNewOperacaoName] = useState('');
  const [newStatusName, setNewStatusName] = useState('');
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [distanciaKm, setDistanciaKm] = useState<number>(0);
  const [dtLimite, setDtLimite] = useState<Date | null>(null);
  const [horarioDe, setHorarioDe] = useState<Date | null>(null);
  const [horarioAte, setHorarioAte] = useState<Date | null>(null);
  const [ativo, setAtivo] = useState<boolean>(true);
  const [logradouros, setLogradouros] = useState<Logradouro[]>([]);
  const [logradouroSearchFilter, setLogradouroSearchFilter] = useState('');
  const [vagaId, setVagaId] = useState<number | null>(null);
  const [enderecoData, setEnderecoData] = useState({
    numero: '',
    ds_complemento: '',
    logradouro_id: '',
    st_end: false,
  });

  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCopied, setAiCopied] = useState(false);

  // Filter logradouros based on search
  const filteredLogradouros = logradouros.filter((log: any) =>
    log.logradouro.toLowerCase().includes(logradouroSearchFilter.toLowerCase())
  );

  // Get company data first
  const { data: companyData, isLoading: companyLoading } = useQuery({
    queryKey: ['company', accountId],
    queryFn: () => fetchCompanyByAccount(accountId || ''),
    enabled: !!accountId && isOpen,
  });

  const companyId = companyData?.company_id;

  // Fetch all dropdown data using React Query
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', companyId],
    queryFn: () => fetchClientes(companyId!),
    enabled: !!companyId && isOpen,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades', companyId],
    queryFn: () => fetchUnidades(companyId!),
    enabled: !!companyId && isOpen,
  });

  const { data: operacoes = [] } = useQuery({
    queryKey: ['operacoes', companyId],
    queryFn: () => fetchOperacoes(companyId!),
    enabled: !!companyId && isOpen,
  });

  const { data: statusVagas = [] } = useQuery({
    queryKey: ['status-vagas', companyId],
    queryFn: () => fetchStatusVagas(companyId!),
    enabled: !!companyId && isOpen,
  });

  // Fetch logradouros
  useEffect(() => {
    const fetchLogradouros = async () => {
      const { data, error } = await supabase.from('logradouro').select('*').limit(100);
      if (!error && data) setLogradouros(data as unknown as Logradouro[]);
    };
    if (isOpen) fetchLogradouros();
  }, [isOpen]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InsertVaga>({
    resolver: zodResolver(insertVagaSchema),
    defaultValues: {
      company_id: companyId || undefined,
      dias_trabalho: [],
      ativo: true,
    },
  });

  // Update company_id in form when it changes
  useEffect(() => {
    if (companyId) {
      setValue('company_id', companyId);
    }
  }, [companyId, setValue]);

  // Create mutations for CRUD operations
  const createVagaMutation = useMutation({
    mutationFn: (vagaData: InsertVaga) => createVaga(vagaData),
    onSuccess: (newVaga) => {
      toast.success('Vaga criada com sucesso!');
      if (companyId) {
        queryClient.setQueryData(
          ['vagas', companyId],
          (old: VagaWithRelations[] | undefined) => old ? [newVaga, ...old] : [newVaga]
        );
      }
      queryClient.invalidateQueries({ queryKey: ['vagas'] });
      setDiasSelecionados([]);
      setDistanciaKm(0);
      setDtLimite(null);
      setHorarioDe(null);
      setHorarioAte(null);
      setAtivo(true);
      reset();
      setValue('dias_trabalho', []);
      onSuccess();
      onClose();
      
      // Salvar endereço da vaga se logradouro foi selecionado
      if (enderecoData.logradouro_id) {
        createEndVaga({
          vaga_id: newVaga.id,
          logradouro_id: Number(enderecoData.logradouro_id),
          numero: enderecoData.numero || null,
          ds_complemento: enderecoData.ds_complemento || null,
          st_end: enderecoData.st_end,
        }).catch((err) => {
          console.error('Erro ao salvar endereço:', err);
        });
      }
    },
    onError: (error) => {
      console.error('Error creating vaga:', error);
      toast.error('Erro ao criar vaga');
    },
  });

  const createUnidadeMutation = useMutation({
    mutationFn: (nome: string) => createUnidade({ unidade: nome, company_id: companyId! }),
    onSuccess: () => {
      toast.success('Unidade criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['unidades', companyId] });
      setShowNewUnidadeInput(false);
      setNewUnidadeName('');
    },
    onError: (error) => {
      console.error('Error creating unidade:', error);
      toast.error('Erro ao criar unidade');
    },
  });

  const createOperacaoMutation = useMutation({
    mutationFn: (nome: string) => createOperacao({ operacao: nome, company_id: companyId! }),
    onSuccess: () => {
      toast.success('Operação criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['operacoes', companyId] });
      setShowNewOperacaoInput(false);
      setNewOperacaoName('');
    },
    onError: (error) => {
      console.error('Error creating operacao:', error);
      toast.error('Erro ao criar operação');
    },
  });

  const createStatusMutation = useMutation({
    mutationFn: (nome: string) => createStatusVaga({ status_vaga: nome, company_id: companyId! }),
    onSuccess: () => {
      toast.success('Status criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['status-vagas', companyId] });
      setShowNewStatusInput(false);
      setNewStatusName('');
    },
    onError: (error) => {
      console.error('Error creating status:', error);
      toast.error('Erro ao criar status');
    },
  });

  const generateAiSummary = async () => {
    const values = getValues();
    const clienteNome = clientes.find(c => c.cliente_id === Number(values.cliente_id))?.nome || '';
    const unidadeNome = (unidades as any[]).find(u => u.id === Number(values.unidade_id))?.unidade || '';
    const operacaoNome = (operacoes as any[]).find(o => o.id === Number(values.operacao_id))?.operacao || '';

    const dadosParaIA = {
      nome: values.nome || '',
      quantidade: Number(values.quantidade) || 1,
      descricao: values.descricao || '',
      cliente_id: values.cliente_id || null,
      unidade_id: values.unidade_id || null,
      operacao_id: values.operacao_id || null,
      st_vaga_id: values.st_vaga_id || null,
      dias_trabalho: diasSelecionados,
      horario: values.horario || '',
      cliente_nome: clienteNome,
      unidade_nome: unidadeNome,
      operacao_nome: operacaoNome,
    };

    setAiLoading(true);
    setAiSummary('');
    try {
      const response = await fetch('https://n8nqp.wiseapp360.com/webhook/resumir-vaga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dadosParaIA }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      const text = result?.resumo || result?.output || result?.text || result?.message
        || (typeof result === 'string' ? result : JSON.stringify(result));
      setAiSummary(text);
    } catch (err) {
      toast.error('Erro ao gerar resumo com IA');
      console.error('AI summary error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const copyAiSummary = async () => {
    if (!aiSummary) return;
    await navigator.clipboard.writeText(aiSummary);
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 2000);
  };

  const onSubmit = (data: InsertVaga) => {
    const vagaData = {
      ...data,
      company_id: companyId!,
      ativo,
    };

    createVagaMutation.mutate(vagaData);
  };

  const createNewUnidade = () => {
    if (!newUnidadeName.trim()) return;
    createUnidadeMutation.mutate(newUnidadeName);
  };

  const createNewOperacao = () => {
    if (!newOperacaoName.trim()) return;
    createOperacaoMutation.mutate(newOperacaoName);
  };

  const createNewStatus = () => {
    if (!newStatusName.trim()) return;
    createStatusMutation.mutate(newStatusName);
  };

  const handleClose = () => {
    if (!createVagaMutation.isPending) {
      reset();
      setValue('dias_trabalho', []);
      setDiasSelecionados([]);
      setDistanciaKm(0);
      setDtLimite(null);
      setHorarioDe(null);
      setHorarioAte(null);
      setAtivo(true);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Adicionar Nova Vaga
          </h2>
          <button
            onClick={handleClose}
            disabled={createVagaMutation.isPending}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Ativo Toggle */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Vaga Ativa</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A vaga estará visível e disponível para candidaturas</p>
            </div>
            <button
              type="button"
              onClick={() => setAtivo(!ativo)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                ativo ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome da Vaga *
              </label>
              <input
                {...register('nome')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ex: Motorista Categoria D"
              />
              {errors.nome && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nome.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantidade de Vagas *
              </label>
              <input
                {...register('quantidade')}
                type="number"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ex: 5"
              />
              {errors.quantidade && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.quantidade.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descrição *
            </label>
            <textarea
              {...register('descricao')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Descreva os requisitos e responsabilidades da vaga"
            />
            {errors.descricao && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.descricao.message}</p>
            )}
          </div>

          {/* Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cliente *
              </label>
              <select
                {...register('cliente_id', { setValueAs: (value) => value ? Number(value) : null })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Selecione um cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
              {errors.cliente_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.cliente_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unidade *
              </label>
              {showNewUnidadeInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUnidadeName}
                    onChange={(e) => setNewUnidadeName(e.target.value)}
                    placeholder="Nome da nova unidade"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    onKeyPress={(e) => e.key === 'Enter' && createNewUnidade()}
                  />
                  <button
                    type="button"
                    onClick={createNewUnidade}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewUnidadeInput(false);
                      setNewUnidadeName('');
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    ✗
                  </button>
                </div>
              ) : (
                <select
                  {...register('unidade_id')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewUnidadeInput(true);
                      setValue('unidade_id', null);
                    } else {
                      setValue('unidade_id', e.target.value ? Number(e.target.value) : null);
                    }
                  }}
                >
                  <option value="">Selecione uma unidade</option>
                  {unidades.map((unidade) => (
                    <option key={unidade.id} value={unidade.id}>
                      {unidade.unidade}
                    </option>
                  ))}
                  <option value="__new__">+ Adicionar nova unidade</option>
                </select>
              )}
              {errors.unidade_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.unidade_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Operação *
              </label>
              {showNewOperacaoInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOperacaoName}
                    onChange={(e) => setNewOperacaoName(e.target.value)}
                    placeholder="Nome da nova operação"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    onKeyPress={(e) => e.key === 'Enter' && createNewOperacao()}
                  />
                  <button
                    type="button"
                    onClick={createNewOperacao}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewOperacaoInput(false);
                      setNewOperacaoName('');
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    ✗
                  </button>
                </div>
              ) : (
                <select
                  {...register('operacao_id')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewOperacaoInput(true);
                      setValue('operacao_id', null);
                    } else {
                      setValue('operacao_id', e.target.value ? Number(e.target.value) : null);
                    }
                  }}
                >
                  <option value="">Selecione uma operação</option>
                  {operacoes.map((operacao) => (
                    <option key={operacao.id} value={operacao.id}>
                      {operacao.operacao}
                    </option>
                  ))}
                  <option value="__new__">+ Adicionar nova operação</option>
                </select>
              )}
              {errors.operacao_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.operacao_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status *
              </label>
              {showNewStatusInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStatusName}
                    onChange={(e) => setNewStatusName(e.target.value)}
                    placeholder="Nome do novo status"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    onKeyPress={(e) => e.key === 'Enter' && createNewStatus()}
                  />
                  <button
                    type="button"
                    onClick={createNewStatus}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewStatusInput(false);
                      setNewStatusName('');
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    ✗
                  </button>
                </div>
              ) : (
                <select
                  {...register('st_vaga_id')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewStatusInput(true);
                      setValue('st_vaga_id', null);
                    } else {
                      setValue('st_vaga_id', e.target.value ? Number(e.target.value) : null);
                    }
                  }}
                >
                  <option value="">Selecione um status</option>
                  {statusVagas.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.status_vaga}
                    </option>
                  ))}
                  <option value="__new__">+ Adicionar novo status</option>
                </select>
              )}
              {errors.st_vaga_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.st_vaga_id.message}</p>
              )}
            </div>
          </div>

          {/* Tipo de Contrato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Contrato
            </label>
            <select
              {...register('tipo_contrato')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Selecione o tipo de contrato</option>
              <option value="CLT">CLT</option>
              <option value="PJ">PJ</option>
              <option value="Temporário">Temporário</option>
              <option value="Autônomo">Autônomo</option>
            </select>
            {errors.tipo_contrato && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.tipo_contrato.message}</p>
            )}
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
              onChange={(e) => {
                const val = Number(e.target.value);
                setDistanciaKm(val);
                setValue('distancia', val === 0 ? '' : `${val} km`);
              }}
              style={{ width: '100%', accentColor: isDark ? '#4f8ef7' : '#2563eb', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: isDark ? '#4a5a72' : '#9ca3af' }}>0 km</span>
              <span style={{ fontSize: '11px', color: isDark ? '#4a5a72' : '#9ca3af' }}>50 km</span>
              <span style={{ fontSize: '11px', color: isDark ? '#4a5a72' : '#9ca3af' }}>100 km</span>
            </div>
          </div>

          {/* Work Details */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Dias de Trabalho *
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  (clique para selecionar)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'segunda', label: 'Segunda' },
                  { key: 'terca', label: 'Terça' },
                  { key: 'quarta', label: 'Quarta' },
                  { key: 'quinta', label: 'Quinta' },
                  { key: 'sexta', label: 'Sexta' },
                  { key: 'sabado', label: 'Sábado' },
                  { key: 'domingo', label: 'Domingo' },
                ].map((dia) => {
                  const selecionado = diasSelecionados.includes(dia.key);
                  return (
                    <button
                      key={dia.key}
                      type="button"
                      onClick={() => {
                        const nova = selecionado
                          ? diasSelecionados.filter((d) => d !== dia.key)
                          : [...diasSelecionados, dia.key];
                        setDiasSelecionados(nova);
                        setValue('dias_trabalho', nova, { shouldValidate: true });
                      }}
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
              {diasSelecionados.length > 0 && (
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  {diasSelecionados.length} dia{diasSelecionados.length > 1 ? 's' : ''} selecionado{diasSelecionados.length > 1 ? 's' : ''}
                </p>
              )}
              {errors.dias_trabalho && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dias_trabalho.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Horário *
              </label>
              <div className="flex items-center gap-2">
                <div className="flex flex-col flex-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">De</span>
                  <DatePicker
                    selected={horarioDe ?? undefined}
                    onChange={(date: Date | null) => {
                      setHorarioDe(date);
                      const deStr = date ? format(date, 'HH:mm') : '';
                      const ateStr = horarioAte ? format(horarioAte, 'HH:mm') : '';
                      setValue('horario', deStr && ateStr ? `${deStr} às ${ateStr}` : deStr || ateStr || '');
                    }}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeFormat="HH:mm"
                    dateFormat="HH:mm"
                    placeholderText="08:00"
                    isClearable
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    onChange={(date: Date | null) => {
                      setHorarioAte(date);
                      const deStr = horarioDe ? format(horarioDe, 'HH:mm') : '';
                      const ateStr = date ? format(date, 'HH:mm') : '';
                      setValue('horario', deStr && ateStr ? `${deStr} às ${ateStr}` : deStr || ateStr || '');
                    }}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeFormat="HH:mm"
                    dateFormat="HH:mm"
                    placeholderText="17:00"
                    isClearable
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    wrapperClassName="w-full"
                    calendarClassName={isDark ? 'dark-datepicker' : 'light-datepicker'}
                    locale="pt-BR"
                  />
                </div>
              </div>
              {errors.horario && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.horario.message}</p>
              )}
            </div>

          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Limite (Opcional)
            </label>
            <DatePicker
              selected={dtLimite}
              onChange={(date: Date | null) => {
                setDtLimite(date);
                setValue('dt_limite', date ? date.toISOString() : undefined);
              }}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="dd/MM/yyyy HH:mm"
              placeholderText="Selecione data e hora"
              isClearable
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              wrapperClassName="w-full"
              calendarClassName={isDark ? 'dark-datepicker' : 'light-datepicker'}
              locale="pt-BR"
              minDate={new Date()}
            />
            {errors.dt_limite && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dt_limite.message}</p>
            )}
          </div>

          {/* Address Information */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Endereço da Vaga (Opcional)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Logradouro
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={logradouroSearchFilter}
                    onChange={(e) => setLogradouroSearchFilter(e.target.value)}
                    placeholder="Pesquisar logradouro..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  {logradouroSearchFilter && (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 max-h-48 overflow-y-auto">
                      {filteredLogradouros.length > 0 ? (
                        filteredLogradouros.map((log: any) => (
                          <button
                            key={log.id_logradouro}
                            type="button"
                            onClick={() => {
                              setEnderecoData({...enderecoData, logradouro_id: log.id_logradouro.toString()});
                              setLogradouroSearchFilter('');
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 border-b border-gray-200 dark:border-gray-600 last:border-b-0 text-gray-800 dark:text-gray-200"
                          >
                            {log.logradouro}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">
                          Nenhum logradouro encontrado
                        </div>
                      )}
                    </div>
                  )}
                  {enderecoData.logradouro_id && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      ✓ {logradouros.find((l: any) => l.id_logradouro.toString() === enderecoData.logradouro_id)?.logradouro || 'Logradouro selecionado'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Número
                </label>
                <input
                  type="text"
                  value={enderecoData.numero}
                  onChange={(e) => setEnderecoData({...enderecoData, numero: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: 123"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Complemento
                </label>
                <input
                  type="text"
                  value={enderecoData.ds_complemento}
                  onChange={(e) => setEnderecoData({...enderecoData, ds_complemento: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Apto 12, Fundos"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enderecoData.st_end}
                    onChange={(e) => setEnderecoData({...enderecoData, st_end: e.target.checked})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Ativo</span>
                </label>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Resumo com IA
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Gera um anúncio formatado com base nos dados preenchidos
                </p>
              </div>
              <button
                type="button"
                onClick={generateAiSummary}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {aiLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar Resumo
                  </>
                )}
              </button>
            </div>

            {aiSummary && (
              <div className="relative rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4">
                <button
                  type="button"
                  onClick={copyAiSummary}
                  title="Copiar resumo"
                  className="absolute top-3 right-3 p-1.5 rounded text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800/50 transition-colors"
                >
                  {aiCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans pr-8 leading-relaxed">
                  {aiSummary}
                </pre>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={createVagaMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createVagaMutation.isPending}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createVagaMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Criando...
                </>
              ) : (
                'Criar Vaga'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVagaModal;