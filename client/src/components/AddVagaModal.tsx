import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Users, Building, Clock, FileText, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWiseAppAccess } from '../context/WiseAppAccessContext';
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
  createEndVaga
} from '../lib/vagasService';

interface AddVagaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddVagaModal: React.FC<AddVagaModalProps> = ({ isOpen, onClose, onSuccess }) => {
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
  const [logradouros, setLogradouros] = useState<Logradouro[]>([]);
  const [logradouroSearchFilter, setLogradouroSearchFilter] = useState('');
  const [vagaId, setVagaId] = useState<number | null>(null);
  const [enderecoData, setEnderecoData] = useState({
    numero: '',
    ds_complemento: '',
    logradouro_id: '',
    st_end: false,
  });

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
    formState: { errors },
  } = useForm<InsertVaga>({
    resolver: zodResolver(insertVagaSchema),
    defaultValues: {
      company_id: companyId || undefined,
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
      queryClient.invalidateQueries({ queryKey: ['vagas', companyId] });
      reset();
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

  const onSubmit = (data: InsertVaga) => {
    // Get selected weekdays from checkboxes
    const checkboxes = document.querySelectorAll('input[name="dias_trabalho"]:checked') as NodeListOf<HTMLInputElement>;
    const diasSelecionados: string[] = Array.from(checkboxes).map(checkbox => checkbox.value);
    
    const vagaData = {
      ...data,
      dias_trabalho: diasSelecionados,
      company_id: companyId!,
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

          {/* Work Details */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Dias de Trabalho *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'segunda', label: 'Segunda' },
                  { key: 'terca', label: 'Terça' },
                  { key: 'quarta', label: 'Quarta' },
                  { key: 'quinta', label: 'Quinta' },
                  { key: 'sexta', label: 'Sexta' },
                  { key: 'sabado', label: 'Sábado' },
                  { key: 'domingo', label: 'Domingo' }
                ].map((dia) => (
                  <label key={dia.key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      value={dia.key}
                      {...register('dias_trabalho')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{dia.label}</span>
                  </label>
                ))}
              </div>
              {errors.dias_trabalho && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dias_trabalho.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Horário *
              </label>
              <input
                {...register('horario')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ex: 08:00 às 17:00"
              />
              {errors.horario && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.horario.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Contrato
              </label>
              <input
                {...register('tipo_contrato')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ex: CLT, PJ, Temporário"
              />
              {errors.tipo_contrato && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.tipo_contrato.message}</p>
              )}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Limite (Opcional)
            </label>
            <input
              {...register('dt_limite')}
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
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