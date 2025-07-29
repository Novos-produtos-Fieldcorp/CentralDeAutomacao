import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Users, Building, Clock, FileText, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertVagaSchema, type InsertVaga, type Cliente, type Unidade, type Operacao, type StVaga } from '@shared/schema';
import toast from 'react-hot-toast';

interface AddVagaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddVagaModal: React.FC<AddVagaModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { accountId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [statusVagas, setStatusVagas] = useState<StVaga[]>([]);
  const [showNewUnidadeInput, setShowNewUnidadeInput] = useState(false);
  const [showNewOperacaoInput, setShowNewOperacaoInput] = useState(false);
  const [showNewStatusInput, setShowNewStatusInput] = useState(false);
  const [newUnidadeName, setNewUnidadeName] = useState('');
  const [newOperacaoName, setNewOperacaoName] = useState('');
  const [newStatusName, setNewStatusName] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InsertVaga>({
    resolver: zodResolver(insertVagaSchema),
    defaultValues: {
      company_id: Number(accountId),
    },
  });

  // Fetch dropdown data
  useEffect(() => {
    if (isOpen && accountId) {
      fetchDropdownData();
    }
  }, [isOpen, accountId]);

  const fetchDropdownData = async () => {
    try {
      const [clientesRes, unidadesRes, operacoesRes, statusRes] = await Promise.all([
        fetch(`/api/clientes/${accountId}`),
        fetch(`/api/unidades/${accountId}`),
        fetch(`/api/operacoes/${accountId}`),
        fetch(`/api/status-vagas/${accountId}`)
      ]);

      if (clientesRes.ok) {
        const clientesData = await clientesRes.json();
        setClientes(clientesData);
      }
      
      if (unidadesRes.ok) {
        const unidadesData = await unidadesRes.json();
        setUnidades(unidadesData);
      }
      
      if (operacoesRes.ok) {
        const operacoesData = await operacoesRes.json();
        setOperacoes(operacoesData);
      }
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatusVagas(statusData);
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
    }
  };

  const onSubmit = async (data: InsertVaga) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/vagas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          company_id: Number(accountId),
        }),
      });

      if (response.ok) {
        toast.success('Vaga criada com sucesso!');
        reset();
        onSuccess();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Erro ao criar vaga');
      }
    } catch (error) {
      console.error('Error creating vaga:', error);
      toast.error('Erro ao criar vaga');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewUnidade = async () => {
    if (!newUnidadeName.trim()) return;
    
    try {
      const response = await fetch('/api/unidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unidade: newUnidadeName.trim(),
          company_id: Number(accountId)
        })
      });

      if (response.ok) {
        const newUnidade = await response.json();
        setUnidades(prev => [...prev, newUnidade]);
        setValue('unidade_id', newUnidade.id);
        setShowNewUnidadeInput(false);
        setNewUnidadeName('');
        toast.success('Unidade criada com sucesso!');
      } else {
        toast.error('Erro ao criar unidade');
      }
    } catch (error) {
      console.error('Error creating unidade:', error);
      toast.error('Erro ao criar unidade');
    }
  };

  const createNewOperacao = async () => {
    if (!newOperacaoName.trim()) return;
    
    try {
      const response = await fetch('/api/operacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operacao: newOperacaoName.trim(),
          company_id: Number(accountId)
        })
      });

      if (response.ok) {
        const newOperacao = await response.json();
        setOperacoes(prev => [...prev, newOperacao]);
        setValue('operacao_id', newOperacao.id);
        setShowNewOperacaoInput(false);
        setNewOperacaoName('');
        toast.success('Operação criada com sucesso!');
      } else {
        toast.error('Erro ao criar operação');
      }
    } catch (error) {
      console.error('Error creating operacao:', error);
      toast.error('Erro ao criar operação');
    }
  };

  const createNewStatus = async () => {
    if (!newStatusName.trim()) return;
    
    try {
      const response = await fetch('/api/status-vagas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_vaga: newStatusName.trim(),
          company_id: Number(accountId)
        })
      });

      if (response.ok) {
        const newStatus = await response.json();
        setStatusVagas(prev => [...prev, newStatus]);
        setValue('st_vaga_id', newStatus.id);
        setShowNewStatusInput(false);
        setNewStatusName('');
        toast.success('Status criado com sucesso!');
      } else {
        toast.error('Erro ao criar status');
      }
    } catch (error) {
      console.error('Error creating status:', error);
      toast.error('Erro ao criar status');
    }
  };

  const handleClose = () => {
    if (!isLoading) {
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
            disabled={isLoading}
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
              Descrição
            </label>
            <textarea
              {...register('descricao')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Descreva os requisitos e responsabilidades da vaga"
            />
          </div>

          {/* Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cliente
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unidade
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
                  {...register('unidade_id', { setValueAs: (value) => value ? Number(value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewUnidadeInput(true);
                      e.target.value = '';
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Operação
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
                  {...register('operacao_id', { setValueAs: (value) => value ? Number(value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewOperacaoInput(true);
                      e.target.value = '';
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
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
                  {...register('st_vaga_id', { setValueAs: (value) => value ? Number(value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewStatusInput(true);
                      e.target.value = '';
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
            </div>
          </div>

          {/* Work Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dias de Trabalho
              </label>
              <input
                {...register('dias_trabalho')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ex: Segunda a Sexta"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Horário
              </label>
              <input
                {...register('horario')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ex: 08:00 às 17:00"
              />
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Limite
            </label>
            <input
              {...register('dt_limite')}
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
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