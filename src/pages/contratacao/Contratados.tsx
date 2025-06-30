import React, { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Plus, FilePen, Phone, MessageSquare, CheckCircle2, XCircle, Calendar, Filter, X, Download, CheckSquare, Square } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, Cliente } from '../../types/database';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import * as XLSX from 'xlsx';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import { useAuth } from '../../context/AuthContext';

interface MotoristaWithCliente extends Motorista {
  cliente?: Cliente;
  nome_cliente?: string;
  integracao?: boolean;
  integracao_data?: string;
  treinamento?: boolean;
  treinamento_data?: string;
}

const Contratados = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const { accountId } = useAuth();
  const [motoristas, setMotoristas] = useState<MotoristaWithCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteFilter, setClienteFilter] = useState<number | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [funcaoFilter, setFuncaoFilter] = useState<'todos' | 'Motorista' | 'Agregado'>('todos');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    motorista: MotoristaWithCliente | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    motorista: null,
  });

  useEffect(() => {
    fetchMotoristas();
    fetchClientes();
  }, []);

  useEffect(() => {
    // Close context menu when clicking anywhere
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu.visible]);

  const fetchMotoristas = async () => {
    try {
      setLoading(true);
      
      // Fetch all contratados
      const { data, error } = await supabase
        .from('motorista')
        .select(`
          *,
          cliente:cliente_id (
            cliente_id,
            nome,
            cnpj,
            email,
            telefone
          )
        `)
        .eq('st_cadastro', 'contratado')
        .eq('company_id', companyId)
        .order('nome');

      if (error) throw error;

      // Fetch integration and training data
      const { data: eventosData, error: eventosError } = await supabase
        .from('motorista_eventos_cliente')
        .select('*');

      if (eventosError) throw eventosError;

      // Create a map of motorista_id to eventos
      const eventosMap = new Map();
      if (eventosData) {
        eventosData.forEach(evento => {
          eventosMap.set(evento.motorista_id, evento);
        });
      }

      // Combine the data
      const motoristasWithEventos = data?.map(motorista => {
        const eventos = eventosMap.get(motorista.motorista_id);
        return {
          ...motorista,
          nome_cliente: motorista.cliente?.nome || null,
          integracao: eventos?.integracao || false,
          integracao_data: eventos?.integracao_data || null,
          treinamento: eventos?.treinamento || false,
          treinamento_data: eventos?.treinamento_data || null
        };
      }) || [];

      setMotoristas(motoristasWithEventos);
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
        .select('*')
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

  const handleStartChat = (motorista: MotoristaWithCliente) => {
    if (!motorista?.telefone) {
      toast.error('Número de telefone não disponível para este motorista');
      return;
    }
    
    startChat(motorista.telefone.toString(), motorista.nome);
  };

  const handleContextMenu = (e: React.MouseEvent, motorista: MotoristaWithCliente) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      motorista,
    });
  };

  const handleSelectItem = (id: number) => {
    const newSelectedItems = new Set(selectedItems);
    if (selectedItems.has(id)) {
      newSelectedItems.delete(id);
    } else {
      newSelectedItems.add(id);
    }
    setSelectedItems(newSelectedItems);
    
    // Update selectAll state
    setSelectAll(newSelectedItems.size === filteredMotoristas.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredMotoristas.map(m => m.motorista_id)));
    }
    setSelectAll(!selectAll);
  };

  const exportToExcel = () => {
    try {
      const dataToExport = filteredMotoristas.map(motorista => ({
        'Nome': motorista.nome,
        'CPF': formatCPF(motorista.cpf),
        'Telefone': motorista.telefone ? formatPhone(motorista.telefone.toString()) : '',
        'Email': motorista.email || '',
        'Função': motorista.funcao,
        'Data de Cadastro': formatDate(motorista.data_cadastro),
        'Cliente': motorista.nome_cliente || 'Sem cliente',
        'Integração': motorista.integracao ? 'Sim' : 'Não',
        'Data Integração': motorista.integracao_data ? formatDate(motorista.integracao_data) : '',
        'Treinamento': motorista.treinamento ? 'Sim' : 'Não',
        'Data Treinamento': motorista.treinamento_data ? formatDate(motorista.treinamento_data) : ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contratados');
      XLSX.writeFile(wb, `contratados_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Dados exportados com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar dados');
    }
  };

  const handleToggleIntegracao = async (motorista: MotoristaWithCliente) => {
    try {
      const newValue = !motorista.integracao;
      const today = new Date().toISOString().split('T')[0];
      
      // Check if record exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('motorista_eventos_cliente')
        .select('id')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .update({
            integracao: newValue,
            integracao_data: newValue ? today : null
          })
          .eq('id', existingRecord.id);
          
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .insert({
            motorista_id: motorista.motorista_id,
            integracao: newValue,
            integracao_data: newValue ? today : null
          });
          
        if (error) throw error;
      }
      
      // Update local state
      setMotoristas(prev => 
        prev.map(m => 
          m.motorista_id === motorista.motorista_id 
            ? { 
                ...m, 
                integracao: newValue, 
                integracao_data: newValue ? today : null 
              } 
            : m
        )
      );
      
      toast.success(`Integração ${newValue ? 'marcada' : 'desmarcada'} com sucesso`);
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast.error('Erro ao atualizar integração');
    }
  };

  const handleToggleTreinamento = async (motorista: MotoristaWithCliente) => {
    try {
      const newValue = !motorista.treinamento;
      const today = new Date().toISOString().split('T')[0];
      
      // Check if record exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('motorista_eventos_cliente')
        .select('id')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .update({
            treinamento: newValue,
            treinamento_data: newValue ? today : null
          })
          .eq('id', existingRecord.id);
          
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .insert({
            motorista_id: motorista.motorista_id,
            treinamento: newValue,
            treinamento_data: newValue ? today : null
          });
          
        if (error) throw error;
      }
      
      // Update local state
      setMotoristas(prev => 
        prev.map(m => 
          m.motorista_id === motorista.motorista_id 
            ? { 
                ...m, 
                treinamento: newValue, 
                treinamento_data: newValue ? today : null 
              } 
            : m
        )
      );
      
      toast.success(`Treinamento ${newValue ? 'marcado' : 'desmarcado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling training:', error);
      toast.error('Erro ao atualizar treinamento');
    }
  };

  const filteredMotoristas = motoristas.filter(motorista => {
    // Apply search filter
    const searchMatch = !searchTerm || 
      motorista.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      motorista.cpf?.includes(searchTerm) ||
      motorista.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      motorista.telefone?.toString().includes(searchTerm);
    
    // Apply cliente filter
    const clienteMatch = clienteFilter === null || motorista.cliente_id === clienteFilter;
    
    // Apply funcao filter
    const funcaoMatch = funcaoFilter === 'todos' || motorista.funcao === funcaoFilter;
    
    return searchMatch && clienteMatch && funcaoMatch;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-auto flex-1">
            <input
              type="text"
              placeholder="Buscar por nome, CPF, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative">
              <select
                value={clienteFilter === null ? '' : clienteFilter}
                onChange={(e) => setClienteFilter(e.target.value ? Number(e.target.value) : null)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="">Todos os clientes</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFuncaoFilter('todos')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  funcaoFilter === 'todos'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFuncaoFilter('Motorista')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  funcaoFilter === 'Motorista'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                Motoristas
              </button>
              <button
                onClick={() => setFuncaoFilter('Agregado')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  funcaoFilter === 'Agregado'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                Agregados
              </button>
            </div>

            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedItems.size > 0 ? `${selectedItems.size} selecionado${selectedItems.size !== 1 ? 's' : ''}` : 'Selecionar todos'}
              </span>
            </div>
          </div>
          
          <div className="relative">
            <div ref={tableContainerRef} className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Função</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Integração</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Treinamento</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredMotoristas.map((motorista) => (
                    <tr 
                      key={motorista.motorista_id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(motorista.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, motorista)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(motorista.motorista_id)}
                          onChange={() => handleSelectItem(motorista.motorista_id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {motorista.nome}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(motorista.data_cadastro)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCPF(motorista.cpf)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.telefone ? formatPhone(motorista.telefone.toString()) : '-'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {motorista.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          motorista.funcao === 'Agregado'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                        }`}>
                          {motorista.funcao}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.nome_cliente || 'Sem cliente'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleIntegracao(motorista)}
                            className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                            title={motorista.integracao ? "Desmarcar integração" : "Marcar integração"}
                          >
                            {motorista.integracao ? (
                              <CheckSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                          {motorista.integracao_data && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(motorista.integracao_data)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleTreinamento(motorista)}
                            className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                            title={motorista.treinamento ? "Desmarcar treinamento" : "Marcar treinamento"}
                          >
                            {motorista.treinamento ? (
                              <CheckSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                          {motorista.treinamento_data && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(motorista.treinamento_data)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleStartChat(motorista)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Iniciar chat"
                          >
                            <MessageSquare size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <ScrollableTableIndicator 
              containerRef={tableContainerRef} 
              className="mr-2 ml-2"
            />
          </div>
        </div>
        {filteredMotoristas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum motorista contratado encontrado
            </p>
          </div>
        ) : (
          <div className="px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Mostrando <span className="font-medium">{filteredMotoristas.length}</span> motoristas contratados
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.motorista && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <MessageSquare size={16} />,
              label: 'Iniciar chat',
              onClick: () => handleStartChat(contextMenu.motorista!),
              color: 'text-green-600 dark:text-green-400'
            },
            {
              icon: contextMenu.motorista.integracao ? <CheckCircle2 size={16} /> : <Square size={16} />,
              label: contextMenu.motorista.integracao ? 'Desmarcar integração' : 'Marcar integração',
              onClick: () => handleToggleIntegracao(contextMenu.motorista!),
              color: 'text-blue-600 dark:text-blue-400'
            },
            {
              icon: contextMenu.motorista.treinamento ? <CheckCircle2 size={16} /> : <Square size={16} />,
              label: contextMenu.motorista.treinamento ? 'Desmarcar treinamento' : 'Marcar treinamento',
              onClick: () => handleToggleTreinamento(contextMenu.motorista!),
              color: 'text-blue-600 dark:text-blue-400'
            }
          ]}
        />
      )}
    </div>
  );
};

export default Contratados;