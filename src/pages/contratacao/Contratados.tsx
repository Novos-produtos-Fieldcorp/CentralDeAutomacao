import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, X, CheckSquare, Square, Calendar, Loader2, Download, FileText } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';

interface Contratado {
  motorista_id: number;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  funcao: string;
  cliente_id: number;
  cliente_nome: string;
  integracao: boolean;
  integracao_data: string | null;
  treinamento: boolean;
  treinamento_data: string | null;
}

const Contratados = () => {
  const { companyId } = useAuth();
  const [contratados, setContratados] = useState<Contratado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [funcaoFilter, setFuncaoFilter] = useState<'todos' | 'Motorista' | 'Agregado'>('todos');
  const [clienteFilter, setClienteFilter] = useState<number | null>(null);
  const [clientes, setClientes] = useState<{ cliente_id: number; nome: string }[]>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [updating, setUpdating] = useState<{id: number, field: 'integracao' | 'treinamento'} | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    fetchContratados();
    fetchClientes();
  }, [companyId]);

  const fetchContratados = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('motorista')
        .select(`
          motorista_id,
          nome,
          cpf,
          telefone,
          email,
          funcao,
          cliente_id,
          cliente:cliente_id (
            cliente_id,
            nome
          ),
          motorista_eventos_cliente (
            integracao,
            integracao_data,
            treinamento,
            treinamento_data
          )
        `)
        .eq('st_cadastro', 'contratado')
        .eq('company_id', companyId)
        .order('nome');

      if (error) throw error;

      // Transform the data to include cliente_nome and eventos data
      const transformedData = (data || []).map(item => {
        const eventos = item.motorista_eventos_cliente?.[0] || {};
        return {
          ...item,
          cliente_nome: item.cliente?.nome || 'Sem cliente',
          integracao: eventos.integracao || false,
          integracao_data: eventos.integracao_data || null,
          treinamento: eventos.treinamento || false,
          treinamento_data: eventos.treinamento_data || null
        };
      });

      setContratados(transformedData);
    } catch (error) {
      console.error('Error fetching contratados:', error);
      toast.error('Erro ao carregar contratados');
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

  const handleToggleIntegracao = async (motorista_id: number) => {
    try {
      setUpdating({id: motorista_id, field: 'integracao'});
      
      // Find the current contratado
      const contratado = contratados.find(c => c.motorista_id === motorista_id);
      if (!contratado) return;
      
      // Toggle the integracao status
      const newStatus = !contratado.integracao;
      const newDate = newStatus ? new Date().toISOString().split('T')[0] : null;
      
      // Check if record exists in motorista_eventos_cliente
      const { data: existingRecord } = await supabase
        .from('motorista_eventos_cliente')
        .select('id')
        .eq('motorista_id', motorista_id)
        .single();

      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .update({ 
            integracao: newStatus,
            integracao_data: newDate
          })
          .eq('motorista_id', motorista_id);
          
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .insert({ 
            motorista_id,
            integracao: newStatus,
            integracao_data: newDate,
            treinamento: false,
            treinamento_data: null
          });
          
        if (error) throw error;
      }
      
      // Update local state
      setContratados(prev => 
        prev.map(c => 
          c.motorista_id === motorista_id 
            ? { ...c, integracao: newStatus, integracao_data: newDate } 
            : c
        )
      );
      
      toast.success(`Integração ${newStatus ? 'realizada' : 'removida'} com sucesso`);
    } catch (error) {
      console.error('Error updating integracao:', error);
      toast.error('Erro ao atualizar integração');
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleTreinamento = async (motorista_id: number) => {
    try {
      setUpdating({id: motorista_id, field: 'treinamento'});
      
      // Find the current contratado
      const contratado = contratados.find(c => c.motorista_id === motorista_id);
      if (!contratado) return;
      
      // Toggle the treinamento status
      const newStatus = !contratado.treinamento;
      const newDate = newStatus ? new Date().toISOString().split('T')[0] : null;
      
      // Check if record exists in motorista_eventos_cliente
      const { data: existingRecord } = await supabase
        .from('motorista_eventos_cliente')
        .select('id')
        .eq('motorista_id', motorista_id)
        .single();

      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .update({ 
            treinamento: newStatus,
            treinamento_data: newDate
          })
          .eq('motorista_id', motorista_id);
          
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .insert({ 
            motorista_id,
            integracao: false,
            integracao_data: null,
            treinamento: newStatus,
            treinamento_data: newDate
          });
          
        if (error) throw error;
      }
      
      // Update local state
      setContratados(prev => 
        prev.map(c => 
          c.motorista_id === motorista_id 
            ? { ...c, treinamento: newStatus, treinamento_data: newDate } 
            : c
        )
      );
      
      toast.success(`Treinamento ${newStatus ? 'realizado' : 'removido'} com sucesso`);
    } catch (error) {
      console.error('Error updating treinamento:', error);
      toast.error('Erro ao atualizar treinamento');
    } finally {
      setUpdating(null);
    }
  };

  const exportToExcel = () => {
    try {
      const filteredData = filteredContratados.map(contratado => ({
        'Nome': contratado.nome,
        'CPF': formatCPF(contratado.cpf),
        'Telefone': formatPhone(contratado.telefone),
        'Email': contratado.email || 'Não informado',
        'Função': contratado.funcao,
        'Cliente': contratado.cliente_nome,
        'Integração': contratado.integracao ? 'Sim' : 'Não',
        'Data da Integração': contratado.integracao_data ? formatDate(contratado.integracao_data) : 'N/A',
        'Treinamento': contratado.treinamento ? 'Sim' : 'Não',
        'Data do Treinamento': contratado.treinamento_data ? formatDate(contratado.treinamento_data) : 'N/A'
      }));

      const ws = XLSX.utils.json_to_sheet(filteredData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contratados');
      XLSX.writeFile(wb, `contratados_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const filteredContratados = contratados.filter(contratado => {
    // Apply search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      contratado.nome.toLowerCase().includes(searchLower) ||
      contratado.cpf.includes(searchTerm) ||
      (contratado.email && contratado.email.toLowerCase().includes(searchLower)) ||
      (contratado.telefone && contratado.telefone.includes(searchTerm));
    
    // Apply function filter
    const matchesFuncao = funcaoFilter === 'todos' || contratado.funcao === funcaoFilter;
    
    // Apply client filter
    const matchesCliente = !clienteFilter || contratado.cliente_id === clienteFilter;
    
    return matchesSearch && matchesFuncao && matchesCliente;
  });

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    handlePageChange,
    handlePageSizeChange
  } = usePagination({
    data: filteredContratados,
    initialPageSize: 10
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="relative w-full md:w-96 flex-1">
          <input
            type="text"
            placeholder="Buscar por nome, CPF, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 p-2 space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Função
                  </label>
                  <select
                    value={funcaoFilter}
                    onChange={(e) => setFuncaoFilter(e.target.value as 'todos' | 'Motorista' | 'Agregado')}
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
                    value={clienteFilter || ''}
                    onChange={(e) => setClienteFilter(e.target.value ? parseInt(e.target.value) : null)}
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
            )}
          </div>

          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative">
        <div className="overflow-hidden">
          <div className="relative">
            <div ref={tableContainerRef} className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Telefone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Função</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Integração</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Treinamento</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((contratado) => (
                    <tr key={contratado.motorista_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {contratado.nome}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatCPF(contratado.cpf)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {contratado.telefone ? formatPhone(contratado.telefone) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          contratado.funcao === 'Motorista'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                        }`}>
                          {contratado.funcao}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {contratado.cliente_nome}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center">
                          <button
                            onClick={() => handleToggleIntegracao(contratado.motorista_id)}
                            disabled={updating !== null}
                            className="focus:outline-none"
                          >
                            {updating?.id === contratado.motorista_id && updating?.field === 'integracao' ? (
                              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            ) : contratado.integracao ? (
                              <CheckSquare className="w-5 h-5 text-green-500" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          {contratado.integracao_data && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formatDate(contratado.integracao_data)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center">
                          <button
                            onClick={() => handleToggleTreinamento(contratado.motorista_id)}
                            disabled={updating !== null}
                            className="focus:outline-none"
                          >
                            {updating?.id === contratado.motorista_id && updating?.field === 'treinamento' ? (
                              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            ) : contratado.treinamento ? (
                              <CheckSquare className="w-5 h-5 text-green-500" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          {contratado.treinamento_data && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formatDate(contratado.treinamento_data)}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
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
        
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
  );
};

export default Contratados;