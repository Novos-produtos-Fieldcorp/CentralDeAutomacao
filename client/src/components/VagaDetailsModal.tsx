import React, { useState, useEffect } from 'react';
import { X, Edit2, Calendar, Users, Building, Clock, MapPin, User, Briefcase } from 'lucide-react';
import { Vaga } from '@shared/schema';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

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

const VagaDetailsModal: React.FC<VagaDetailsModalProps> = ({ vaga, isOpen, onClose, onUpdate }) => {
  const { accountId } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nome: vaga.nome || '',
    descricao: vaga.descricao || '',
    quantidade: vaga.quantidade || 0,
    dias_trabalho: Array.isArray(vaga.dias_trabalho) ? vaga.dias_trabalho : 
                   typeof vaga.dias_trabalho === 'string' ? JSON.parse(vaga.dias_trabalho || '[]') : [],
    horario: vaga.horario || '',
    dt_limite: vaga.dt_limite ? new Date(vaga.dt_limite).toISOString().slice(0, 16) : '',
    unidade_id: vaga.unidade_id || '',
    operacao_id: vaga.operacao_id || '',
    st_vaga_id: vaga.st_vaga_id || '',
    cliente_id: vaga.cliente_id || '',
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

  const fetchDropdownData = async () => {
    if (!accountId) return;

    try {
      const [clientesRes, unidadesRes, operacoesRes, statusRes] = await Promise.all([
        fetch(`/api/clientes/${accountId}`),
        fetch(`/api/unidades/${accountId}`),
        fetch(`/api/operacoes/${accountId}`),
        fetch(`/api/status-vagas/${accountId}`),
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
        ? prev.dias_trabalho.filter(d => d !== dia)
        : [...prev.dias_trabalho, dia]
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      const updateData = {
        ...formData,
        company_id: accountId,
        quantidade: Number(formData.quantidade),
        unidade_id: formData.unidade_id ? Number(formData.unidade_id) : null,
        operacao_id: formData.operacao_id ? Number(formData.operacao_id) : null,
        st_vaga_id: formData.st_vaga_id ? Number(formData.st_vaga_id) : null,
        cliente_id: formData.cliente_id ? Number(formData.cliente_id) : null,
        dt_limite: formData.dt_limite || null
      };

      const response = await fetch(`/api/vagas/${vaga.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
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
    const dias = Array.isArray(vaga.dias_trabalho) ? vaga.dias_trabalho : 
                 typeof vaga.dias_trabalho === 'string' ? JSON.parse(vaga.dias_trabalho || '[]') : [];
    
    if (dias.length === 0) return 'Não definido';
    
    return dias.map((dia: string) => {
      const diaObj = diasSemana.find((d: { value: string; label: string }) => d.value === dia);
      return diaObj ? diaObj.label : dia;
    }).join(', ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Editar Vaga' : 'Detalhes da Vaga'}
          </h2>
          <div className="flex space-x-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Editar vaga"
              >
                <Edit2 size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isEditing ? (
            // Modo Edição - Formulário
            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome da Vaga
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Quantidade e Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    value={formData.quantidade}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantidade: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Horário
                  </label>
                  <input
                    type="text"
                    value={formData.horario}
                    onChange={(e) => setFormData(prev => ({ ...prev, horario: e.target.value }))}
                    placeholder="Ex: 08:00 às 17:00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Data Limite */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data Limite (Opcional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.dt_limite}
                  onChange={(e) => setFormData(prev => ({ ...prev, dt_limite: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Dias da Semana */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dias de Trabalho
                </label>
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
              </div>

              {/* Dropdowns */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cliente
                  </label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, cliente_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Selecione um cliente</option>
                    {dropdownData.clientes.map((cliente) => (
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
                  <select
                    value={formData.unidade_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, unidade_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Selecione uma unidade</option>
                    {dropdownData.unidades.map((unidade) => (
                      <option key={unidade.id} value={unidade.id}>
                        {unidade.unidade}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Operação
                  </label>
                  <select
                    value={formData.operacao_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, operacao_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Selecione uma operação</option>
                    {dropdownData.operacoes.map((operacao) => (
                      <option key={operacao.id} value={operacao.id}>
                        {operacao.operacao}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.st_vaga_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, st_vaga_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Selecione um status</option>
                    {dropdownData.statusVagas.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.status_vaga}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg"
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            // Modo Visualização - Estilo do modal de motoristas
            <div className="space-y-6">
              {/* Informações Básicas */}
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
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                  <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Nome da Vaga
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {vaga.nome || 'Não informado'}
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Descrição
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {vaga.descricao || 'Não informado'}
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Quantidade de Vagas
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {vaga.quantidade || 'Não informado'}
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Horário de Trabalho
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {vaga.horario || 'Não informado'}
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Dias de Trabalho
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {getDiasTrabalhoFormatted()}
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Data Limite
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {formatDate(vaga.dt_limite?.toString() || null)}
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
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                  <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Cliente
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {(vaga as any).cliente_nome || (vaga.cliente_id ? `Cliente #${vaga.cliente_id}` : 'Não informado')}
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Unidade
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {(vaga as any).unidade_nome || (vaga.unidade_id ? `Unidade #${vaga.unidade_id}` : 'Não informado')}
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Operação
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {(vaga as any).operacao_nome || (vaga.operacao_id ? `Operação #${vaga.operacao_id}` : 'Não informado')}
                      </dd>
                    </div>
                    <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                        {(vaga as any).status_nome || 'Aberta'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VagaDetailsModal;