import React, { useState, useEffect } from 'react';
import { X, Edit2, Calendar, Users, Building, Clock, MapPin, User, Briefcase } from 'lucide-react';
import { Vaga } from '@shared/schema';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../hooks/useCurrentAccount';

interface VagaDetailsModalProps {
  vaga: Vaga;
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

const VagaDetailsModal: React.FC<VagaDetailsModalProps> = ({ vaga: initialVaga, isOpen, onClose, onUpdate }) => {
  const { accountId } = useCurrentAccount();
  const [isEditing, setIsEditing] = useState(false);
  const [currentVaga, setCurrentVaga] = useState(initialVaga);
  const [formData, setFormData] = useState({
    nome: initialVaga.nome || '',
    descricao: initialVaga.descricao || '',
    quantidade: initialVaga.quantidade || 0,
    dias_trabalho: Array.isArray(initialVaga.dias_trabalho) ? initialVaga.dias_trabalho : 
                   typeof initialVaga.dias_trabalho === 'string' ? JSON.parse(initialVaga.dias_trabalho || '[]') : [],
    horario: initialVaga.horario || '',
    tipo_contrato: initialVaga.tipo_contrato || '',
    dt_limite: initialVaga.dt_limite ? new Date(initialVaga.dt_limite).toISOString().slice(0, 16) : '',
    unidade_id: initialVaga.unidade_id || '',
    operacao_id: initialVaga.operacao_id || '',
    st_vaga_id: initialVaga.st_vaga_id || '',
    cliente_id: initialVaga.cliente_id || '',
  });
  const [dropdownData, setDropdownData] = useState<DropdownData>({
    clientes: [],
    unidades: [],
    operacoes: [],
    statusVagas: []
  });
  const [loading, setLoading] = useState(false);

  const diasSemana = [
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

  // Atualizar dados quando a vaga inicial mudar
  useEffect(() => {
    setCurrentVaga(initialVaga);
    setFormData({
      nome: initialVaga.nome || '',
      descricao: initialVaga.descricao || '',
      quantidade: initialVaga.quantidade || 0,
      dias_trabalho: Array.isArray(initialVaga.dias_trabalho) ? initialVaga.dias_trabalho : 
                     typeof initialVaga.dias_trabalho === 'string' ? JSON.parse(initialVaga.dias_trabalho || '[]') : [],
      horario: initialVaga.horario || '',
      tipo_contrato: initialVaga.tipo_contrato || '',
      dt_limite: initialVaga.dt_limite ? new Date(initialVaga.dt_limite).toISOString().slice(0, 16) : '',
      unidade_id: initialVaga.unidade_id || '',
      operacao_id: initialVaga.operacao_id || '',
      st_vaga_id: initialVaga.st_vaga_id || '',
      cliente_id: initialVaga.cliente_id || '',
    });
  }, [initialVaga]);

  const fetchDropdownData = async () => {
    if (!accountId) return;

    try {
      // First get company_id from account_id
      const companyRes = await fetch(`/api/company/by-account/${accountId}`);
      if (!companyRes.ok) {
        console.error('Failed to fetch company data');
        return;
      }
      
      const companyData = await companyRes.json();
      const companyId = companyData.company_id;

      const [clientesRes, unidadesRes, operacoesRes, statusRes] = await Promise.all([
        fetch(`/api/clientes/${companyId}`),
        fetch(`/api/unidades/${companyId}`),
        fetch(`/api/operacoes/${companyId}`),
        fetch(`/api/status-vagas/${companyId}`),
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
    if (!formData.horario.trim()) errors.push('Horário é obrigatório');
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
      // First get company_id from account_id
      const companyRes = await fetch(`/api/company/by-account/${accountId}`);
      if (!companyRes.ok) {
        toast.error('Erro ao obter dados da empresa');
        return;
      }
      
      const companyData = await companyRes.json();
      const companyId = companyData.company_id;

      const updateData = {
        ...formData,
        company_id: companyId,
        quantidade: Number(formData.quantidade),
        unidade_id: formData.unidade_id ? Number(formData.unidade_id) : null,
        operacao_id: formData.operacao_id ? Number(formData.operacao_id) : null,
        st_vaga_id: formData.st_vaga_id ? Number(formData.st_vaga_id) : null,
        cliente_id: formData.cliente_id ? Number(formData.cliente_id) : null,
        dt_limite: formData.dt_limite || null
      };

      const response = await fetch(`/api/vagas/${currentVaga.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedVaga = await response.json();
        // Atualizar a vaga local com os dados mais recentes
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

  const formatDate = (date: string | null) => {
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
      const diaObj = diasSemana.find((d: { value: string; label: string }) => d.value === dia);
      return diaObj ? diaObj.label : dia;
    }).join(', ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
              {/* Formulário de Edição */}
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-gray-400" />
                    Informações da Vaga
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                    Edite os detalhes da vaga de trabalho.
                  </p>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                  <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        Nome da Vaga *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <input
                          type="text"
                          value={formData.nome}
                          onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Descrição *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <textarea
                          value={formData.descricao}
                          onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Quantidade de Vagas *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <input
                          type="number"
                          value={formData.quantidade}
                          onChange={(e) => setFormData(prev => ({ ...prev, quantidade: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Horário de Trabalho *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <input
                          type="text"
                          value={formData.horario}
                          onChange={(e) => setFormData(prev => ({ ...prev, horario: e.target.value }))}
                          placeholder="Ex: 08:00 às 17:00"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Tipo de Contrato
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <input
                          type="text"
                          value={formData.tipo_contrato}
                          onChange={(e) => setFormData(prev => ({ ...prev, tipo_contrato: e.target.value }))}
                          placeholder="Ex: CLT, PJ, Temporário"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Dias de Trabalho *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <div className="flex flex-wrap gap-2">
                          {diasSemana.map((dia: { value: string; label: string }) => (
                            <label key={dia.value} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.dias_trabalho.includes(dia.value)}
                                onChange={() => handleDiaToggle(dia.value)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{dia.label}</span>
                            </label>
                          ))}
                        </div>
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Data Limite
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <input
                          type="datetime-local"
                          value={formData.dt_limite}
                          onChange={(e) => setFormData(prev => ({ ...prev, dt_limite: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Informações de Relacionamento - Card Editável */}
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Building className="w-5 h-5 text-gray-400" />
                    Cliente e Unidade
                  </h3>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                  <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Cliente *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <select
                          value={formData.cliente_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, cliente_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="">Selecione um cliente</option>
                          {dropdownData.clientes.map((cliente) => (
                            <option key={cliente.cliente_id} value={cliente.cliente_id}>
                              {cliente.nome}
                            </option>
                          ))}
                        </select>
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Unidade *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <select
                          value={formData.unidade_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, unidade_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="">Selecione uma unidade</option>
                          {dropdownData.unidades.map((unidade) => (
                            <option key={unidade.id} value={unidade.id}>
                              {unidade.unidade}
                            </option>
                          ))}
                        </select>
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Operação *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <select
                          value={formData.operacao_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, operacao_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="">Selecione uma operação</option>
                          {dropdownData.operacoes.map((operacao) => (
                            <option key={operacao.id} value={operacao.id}>
                              {operacao.operacao}
                            </option>
                          ))}
                        </select>
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Status *
                      </dt>
                      <dd className="mt-1 sm:mt-0 sm:col-span-2">
                        <select
                          value={formData.st_vaga_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, st_vaga_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="">Selecione um status</option>
                          {dropdownData.statusVagas.map((status) => (
                            <option key={status.id} value={status.id}>
                              {status.status_vaga}
                            </option>
                          ))}
                        </select>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsEditing(false)}
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
              {/* Visualização das Informações */}
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-gray-400" />
                    Informações da Vaga
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                    Detalhes completos da vaga de trabalho.
                  </p>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <dl>
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Nome da Vaga
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {currentVaga.nome}
                      </dd>
                    </div>
                    <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Descrição
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {currentVaga.descricao}
                      </dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Quantidade de Vagas
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {currentVaga.quantidade}
                      </dd>
                    </div>
                    <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Horário de Trabalho
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {currentVaga.horario}
                      </dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        <Briefcase className="w-4 h-4 mr-2" />
                        Tipo de Contrato
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {currentVaga.tipo_contrato || 'Não informado'}
                      </dd>
                    </div>
                    <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        Dias de Trabalho
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {getDiasTrabalhoFormatted()}
                      </dd>
                    </div>
                    <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        Data Limite
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {formatDate(currentVaga.dt_limite)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Informações de Relacionamento */}
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Building className="w-5 h-5 text-gray-400" />
                    Cliente e Unidade
                  </h3>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <dl>
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        <Building className="w-4 h-4 mr-2" />
                        Cliente
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {(currentVaga as any).cliente_nome || 'Não informado'}
                      </dd>
                    </div>
                    <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        Unidade
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {(currentVaga as any).unidade_nome || 'Não informado'}
                      </dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Operação
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        {(currentVaga as any).operacao_nome || 'Não informado'}
                      </dd>
                    </div>
                    <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (currentVaga as any).status_nome === 'Ativa' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                          (currentVaga as any).status_nome === 'Em Andamento' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                        }`}>
                          {(currentVaga as any).status_nome || 'Não informado'}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VagaDetailsModal;