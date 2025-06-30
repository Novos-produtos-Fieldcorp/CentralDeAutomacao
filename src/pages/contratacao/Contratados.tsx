import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, X, Check, Download, Loader2, CheckSquare, Square } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';

const Contratados = () => {
  const { query, companyId } = useCompanyData();
  const { accountId } = useAuth();
  const [contratados, setContratados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredContratados, setFilteredContratados] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    funcao: 'todos',
    cliente: 'todos',
    cidade: 'todos',
    integracao: 'todos',
    treinamento: 'todos'
  });
  const [filterOptions, setFilterOptions] = useState({
    clientes: [] as { cliente_id: number; nome: string }[],
    cidades: [] as string[],
  });
  const [updatingIntegracao, setUpdatingIntegracao] = useState<number | null>(null);
  const [updatingTreinamento, setUpdatingTreinamento] = useState<number | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchContratados();
    fetchFilterOptions();
  }, [companyId]);

  useEffect(() => {
    applyFilters();
  }, [contratados, searchTerm, filters]);

  const fetchContratados = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('vw_contratados_completo')
        .select('*')
        .eq('company_id', companyId);
      
      if (error) throw error;
      
      setContratados(data || []);
    } catch (error) {
      console.error('Error fetching contratados:', error);
      toast.error('Erro ao carregar contratados');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      // Fetch clients
      const { data: clientesData, error: clientesError } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId)
        .eq('st_cliente', true)
        .order('nome');
      
      if (clientesError) throw clientesError;
      
      // Get unique cities from contratados
      const uniqueCidades = [...new Set(contratados
        .filter(c => c.nome_cidade)
        .map(c => c.nome_cidade))]
        .sort();
      
      setFilterOptions({
        clientes: clientesData || [],
        cidades: uniqueCidades,
      });
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...contratados];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        (c.nome_motorista && c.nome_motorista.toLowerCase().includes(searchLower)) ||
        (c.cpf && c.cpf.includes(searchLower)) ||
        (c.placa && c.placa.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply function filter
    if (filters.funcao !== 'todos') {
      filtered = filtered.filter(c => c.funcao === filters.funcao);
    }
    
    // Apply client filter
    if (filters.cliente !== 'todos') {
      if (filters.cliente === 'sem_cliente') {
        filtered = filtered.filter(c => !c.cliente_id);
      } else {
        filtered = filtered.filter(c => c.cliente_id === parseInt(filters.cliente));
      }
    }
    
    // Apply city filter
    if (filters.cidade !== 'todos') {
      filtered = filtered.filter(c => c.nome_cidade === filters.cidade);
    }
    
    // Apply integration filter
    if (filters.integracao !== 'todos') {
      filtered = filtered.filter(c => {
        if (filters.integracao === 'sim') {
          return c.integracao === true;
        } else {
          return c.integracao !== true;
        }
      });
    }
    
    // Apply training filter
    if (filters.treinamento !== 'todos') {
      filtered = filtered.filter(c => {
        if (filters.treinamento === 'sim') {
          return c.treinamento === true;
        } else {
          return c.treinamento !== true;
        }
      });
    }
    
    setFilteredContratados(filtered);
  };

  const handleToggleIntegracao = async (motorista_id: number, currentValue: boolean) => {
    try {
      setUpdatingIntegracao(motorista_id);
      
      const newValue = !currentValue;
      const now = new Date().toISOString();
      
      // Update the motorista record
      const { error } = await supabase
        .from('motorista')
        .update({
          integracao: newValue,
          integracao_data: newValue ? now : null
        })
        .eq('motorista_id', motorista_id);
      
      if (error) throw error;
      
      // Update local state
      setContratados(prev => prev.map(c => 
        c.motorista_id === motorista_id 
          ? { ...c, integracao: newValue, integracao_data: newValue ? now : null } 
          : c
      ));
      
      toast.success(`Integração ${newValue ? 'realizada' : 'removida'} com sucesso`);
    } catch (error) {
      console.error('Error updating integracao:', error);
      toast.error('Erro ao atualizar integração');
    } finally {
      setUpdatingIntegracao(null);
    }
  };

  const handleToggleTreinamento = async (motorista_id: number, currentValue: boolean) => {
    try {
      setUpdatingTreinamento(motorista_id);
      
      const newValue = !currentValue;
      const now = new Date().toISOString();
      
      // Update the motorista record
      const { error } = await supabase
        .from('motorista')
        .update({
          treinamento: newValue,
          treinamento_data: newValue ? now : null
        })
        .eq('motorista_id', motorista_id);
      
      if (error) throw error;
      
      // Update local state
      setContratados(prev => prev.map(c => 
        c.motorista_id === motorista_id 
          ? { ...c, treinamento: newValue, treinamento_data: newValue ? now : null } 
          : c
      ));
      
      toast.success(`Treinamento ${newValue ? 'realizado' : 'removido'} com sucesso`);
    } catch (error) {
      console.error('Error updating treinamento:', error);
      toast.error('Erro ao atualizar treinamento');
    } finally {
      setUpdatingTreinamento(null);
    }
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredContratados.map(c => ({
        'Nome': c.nome_motorista,
        'CPF': formatCPF(c.cpf),
        'Telefone': c.telefone ? formatPhone(c.telefone.toString()) : 'Não informado',
        'Função': c.funcao,
        'Placa': c.placa ? c.placa.toUpperCase() : 'Não informado',
        'Veículo': `${c.marca || ''} ${c.tipo || ''}`.trim() || 'Não informado',
        'Cliente': c.cliente?.nome || 'Não informado',
        'Cidade': c.nome_cidade || 'Não informada',
        'Estado': c.sigla_estado || 'Não informado',
        'Integração': c.integracao ? 'Sim' : 'Não',
        'Data Integração': c.integracao_data ? formatDate(c.integracao_data) : 'Não realizada',
        'Treinamento': c.treinamento ? 'Sim' : 'Não',
        'Data Treinamento': c.treinamento_data ? formatDate(c.treinamento_data) : 'Não realizado'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contratados');
      XLSX.writeFile(wb, `contratados_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Dados exportados com sucesso');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Erro ao exportar dados');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-auto flex-1">
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou placa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <Filter className="w-5 h-5" />
            Filtros
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exportar
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Função
              </label>
              <select
                value={filters.funcao}
                onChange={(e) => setFilters(prev => ({ ...prev, funcao: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="todos">Todos</option>
                <option value="Motorista">Motoristas</option>
                <option value="Agregado">Agregados</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cliente
              </label>
              <select
                value={filters.cliente}
                onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="todos">Todos</option>
                <option value="sem_cliente">Sem Cliente</option>
                {filterOptions.clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cidade
              </label>
              <select
                value={filters.cidade}
                onChange={(e) => setFilters(prev => ({ ...prev, cidade: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="todos">Todas</option>
                {filterOptions.cidades.map(cidade => (
                  <option key={cidade} value={cidade}>
                    {cidade}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Integração
              </label>
              <select
                value={filters.integracao}
                onChange={(e) => setFilters(prev => ({ ...prev, integracao: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="todos">Todos</option>
                <option value="sim">Realizada</option>
                <option value="nao">Não Realizada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Treinamento
              </label>
              <select
                value={filters.treinamento}
                onChange={(e) => setFilters(prev => ({ ...prev, treinamento: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="todos">Todos</option>
                <option value="sim">Realizado</option>
                <option value="nao">Não Realizado</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={() => {
                setFilters({
                  funcao: 'todos',
                  cliente: 'todos',
                  cidade: 'todos',
                  integracao: 'todos',
                  treinamento: 'todos'
                });
              }}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="relative">
          <div ref={tableContainerRef} className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Motorista
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Veículo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Integração
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Treinamento
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredContratados.length > 0 ? (
                  filteredContratados.map((contratado) => (
                    <tr key={contratado.motorista_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <span className="text-lg font-medium text-blue-600 dark:text-blue-400">
                              {contratado.nome_motorista?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {contratado.nome_motorista}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCPF(contratado.cpf)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {contratado.placa ? contratado.placa.toUpperCase() : 'Não informado'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {contratado.marca} {contratado.tipo}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {contratado.cliente?.nome || 'Não informado'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => handleToggleIntegracao(contratado.motorista_id, contratado.integracao)}
                            disabled={updatingIntegracao === contratado.motorista_id}
                            className="mr-2 focus:outline-none"
                          >
                            {updatingIntegracao === contratado.motorista_id ? (
                              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            ) : contratado.integracao ? (
                              <CheckSquare className="w-5 h-5 text-green-500" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {contratado.integracao_data ? formatDate(contratado.integracao_data) : 'Não realizada'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => handleToggleTreinamento(contratado.motorista_id, contratado.treinamento)}
                            disabled={updatingTreinamento === contratado.motorista_id}
                            className="mr-2 focus:outline-none"
                          >
                            {updatingTreinamento === contratado.motorista_id ? (
                              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            ) : contratado.treinamento ? (
                              <CheckSquare className="w-5 h-5 text-green-500" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {contratado.treinamento_data ? formatDate(contratado.treinamento_data) : 'Não realizado'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      Nenhum contratado encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <ScrollableTableIndicator 
            containerRef={tableContainerRef} 
            className="mr-2 ml-2"
          />
        </div>
      </div>
    </div>
  );
};

export default Contratados;