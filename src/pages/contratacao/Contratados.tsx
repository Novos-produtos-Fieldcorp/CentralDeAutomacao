import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, X, Download } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import IntegracaoTreinamento from '../../components/IntegracaoTreinamento';

interface Motorista {
  motorista_id: number;
  nome_motorista: string;
  cpf: string;
  telefone: string | null;
  email: string | null;
  funcao: string;
  cliente_nome: string | null;
  cliente_id: number | null;
  integracao: boolean | null;
  integracao_data: string | null;
  treinamento: boolean | null;
  treinamento_data: string | null;
}

const Contratados = () => {
  const { companyId } = useCompanyData();
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Motorista;
    direction: 'asc' | 'desc';
  }>({ key: 'nome_motorista', direction: 'asc' });
  const [filterFuncao, setFilterFuncao] = useState<'todos' | 'Motorista' | 'Agregado'>('todos');
  const [filterCliente, setFilterCliente] = useState<number | null>(null);
  const [clientes, setClientes] = useState<{ cliente_id: number; nome: string }[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMotoristas();
    fetchClientes();
  }, [companyId]);

  const fetchMotoristas = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('vw_contratados_completo')
        .select('*')
        .eq('company_id', companyId)
        .order('nome_motorista', { ascending: true });
      
      if (error) throw error;
      
      setMotoristas(data || []);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId)
        .eq('st_cliente', true)
        .order('nome');
      
      if (error) throw error;
      
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const toggleRowExpanded = (motorista_id: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(motorista_id)) {
      newExpandedRows.delete(motorista_id);
    } else {
      newExpandedRows.add(motorista_id);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleSort = (key: keyof Motorista) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredMotoristas.map(m => ({
        'Nome': m.nome_motorista,
        'CPF': formatCPF(m.cpf),
        'Função': m.funcao,
        'Telefone': m.telefone ? formatPhone(m.telefone.toString()) : '',
        'Email': m.email || '',
        'Cliente': m.cliente_nome || 'Sem cliente',
        'Integração': m.integracao ? 'Sim' : 'Não',
        'Data Integração': m.integracao_data ? new Date(m.integracao_data).toLocaleDateString('pt-BR') : '',
        'Treinamento': m.treinamento ? 'Sim' : 'Não',
        'Data Treinamento': m.treinamento_data ? new Date(m.treinamento_data).toLocaleDateString('pt-BR') : ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contratados');
      XLSX.writeFile(wb, `contratados_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Dados exportados com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar dados');
    }
  };

  const filteredMotoristas = motoristas.filter(motorista => {
    const searchString = searchTerm.toLowerCase();
    const matchesSearch = 
      motorista.nome_motorista.toLowerCase().includes(searchString) ||
      motorista.cpf.includes(searchString) ||
      (motorista.telefone && motorista.telefone.toString().includes(searchString)) ||
      (motorista.email && motorista.email.toLowerCase().includes(searchString));
    
    const matchesFuncao = filterFuncao === 'todos' || motorista.funcao === filterFuncao;
    
    const matchesCliente = !filterCliente || motorista.cliente_id === filterCliente;
    
    return matchesSearch && matchesFuncao && matchesCliente;
  }).sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;

    const aStr = String(aValue);
    const bStr = String(bValue);

    const comparison = aStr.localeCompare(bStr);
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-auto md:flex-1">
          <input
            type="text"
            placeholder="Buscar por nome, CPF, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                     dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                     focus:border-blue-500 text-gray-900 dark:text-gray-100"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                     rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 
                     focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
          >
            <Filter size={16} />
            Filtros
            {(filterFuncao !== 'todos' || filterCliente !== null) && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                {(filterFuncao !== 'todos' ? 1 : 0) + (filterCliente !== null ? 1 : 0)}
              </span>
            )}
          </button>
          
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Exportar
          </button>
        </div>
      </div>
      
      {isFilterOpen && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filtros</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Função
              </label>
              <select
                value={filterFuncao}
                onChange={(e) => setFilterFuncao(e.target.value as 'todos' | 'Motorista' | 'Agregado')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="todos">Todos</option>
                <option value="Motorista">Motorista</option>
                <option value="Agregado">Agregado</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cliente
              </label>
              <select
                value={filterCliente || ''}
                onChange={(e) => setFilterCliente(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todos</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => {
                setFilterFuncao('todos');
                setFilterCliente(null);
              }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div ref={tableContainerRef} className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('nome_motorista')}
                >
                  <div className="flex items-center">
                    <span>Nome</span>
                    {sortConfig.key === 'nome_motorista' && (
                      sortConfig.direction === 'asc' ? 
                        <ChevronUp className="w-4 h-4 ml-1" /> : 
                        <ChevronDown className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  CPF
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('funcao')}
                >
                  <div className="flex items-center">
                    <span>Função</span>
                    {sortConfig.key === 'funcao' && (
                      sortConfig.direction === 'asc' ? 
                        <ChevronUp className="w-4 h-4 ml-1" /> : 
                        <ChevronDown className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Integração
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Treinamento
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMotoristas.map((motorista) => (
                <React.Fragment key={motorista.motorista_id}>
                  <tr 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => toggleRowExpanded(motorista.motorista_id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {motorista.nome_motorista}
                        </div>
                        <button className="ml-2 text-gray-400">
                          {expandedRows.has(motorista.motorista_id) ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatCPF(motorista.cpf)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        motorista.funcao === 'Agregado' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                      }`}>
                        {motorista.funcao}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {motorista.cliente_nome || 'Sem cliente'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-center">
                        <IntegracaoTreinamento
                          motorista_id={motorista.motorista_id}
                          integracao={motorista.integracao}
                          integracao_data={motorista.integracao_data}
                          treinamento={motorista.treinamento}
                          treinamento_data={motorista.treinamento_data}
                          onUpdate={fetchMotoristas}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {/* This cell is intentionally left empty as the IntegracaoTreinamento component handles both columns */}
                    </td>
                  </tr>
                  {expandedRows.has(motorista.motorista_id) && (
                    <tr className="bg-gray-50 dark:bg-gray-700/30">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Informações de Contato
                            </h4>
                            <div className="space-y-2">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Telefone:</span> {motorista.telefone ? formatPhone(motorista.telefone.toString()) : 'Não informado'}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Email:</span> {motorista.email || 'Não informado'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Eventos do Cliente
                            </h4>
                            <div className="space-y-2">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Integração:</span> {motorista.integracao ? 'Realizada' : 'Não realizada'}
                                {motorista.integracao_data && ` em ${new Date(motorista.integracao_data).toLocaleDateString('pt-BR')}`}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Treinamento:</span> {motorista.treinamento ? 'Realizado' : 'Não realizado'}
                                {motorista.treinamento_data && ` em ${new Date(motorista.treinamento_data).toLocaleDateString('pt-BR')}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredMotoristas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhum motorista contratado encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Contratados;