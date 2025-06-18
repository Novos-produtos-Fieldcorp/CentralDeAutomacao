import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, FilePen, MessageCircle, Filter, ChevronDown, X, Users, Download, Upload } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import MassMessageModal from '../../components/MassMessageModal';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import DocumentViewer from '../../components/DocumentViewer';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import ImportExportModal from '../../components/ImportExportModal';

interface Agregado {
  motorista_id: number;
  nome: string;
  cpf: string;
  telefone: string | null;
  email: string | null;
  dt_nascimento: string | null;
  genero: string | null;
  st_cadastro: string;
  data_cadastro: string;
  cliente?: {
    cliente_id: number;
    nome: string;
  } | null;
  veiculo?: {
    veiculo_id: number;
    placa: string;
    marca: string;
    tipo: string;
    tipologia: string;
  }[] | null;
  cidade?: string;
  documento_motorista?: {
    id_documento_motorista: number;
    foto_cnh: string | null;
    foto_comprovante_residencia: string | null;
  }[] | null;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const { accountId } = useAuth();
  const [agregados, setAgregados] = useState<Agregado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clienteFilter, setClienteFilter] = useState<string>('');
  const [cidadeFilter, setCidadeFilter] = useState<string>('');
  const [tipologiaFilter, setTipologiaFilter] = useState<string>('');
  const [clientes, setClientes] = useState<{cliente_id: number; nome: string}[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [tipologias, setTipologias] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDocumentUploadModalOpen, setIsDocumentUploadModalOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<Agregado | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    handlePageChange,
    handlePageSizeChange
  } = usePagination({
    data: agregados,
    initialPageSize: 10
  });

  useEffect(() => {
    fetchAgregados();
    fetchFilters();
  }, []);

  const fetchAgregados = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vw_agregados_completo')
        .select(`
          motorista_id,
          nome,
          cpf,
          telefone,
          email,
          dt_nascimento,
          genero,
          st_cadastro,
          data_cadastro,
          cidade,
          cliente:cliente_id (
            cliente_id,
            nome
          ),
          veiculo:veiculo_id (
            veiculo_id,
            placa,
            marca,
            tipo,
            tipologia
          ),
          documento_motorista:documento_motorista_id (
            id_documento_motorista,
            foto_cnh,
            foto_comprovante_residencia
          )
        `)
        .eq('company_id', companyId);

      if (error) throw error;

      setAgregados(data || []);
    } catch (error) {
      console.error('Error fetching agregados:', error);
      toast.error('Erro ao carregar agregados');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      // Fetch clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId)
        .eq('st_cliente', true)
        .order('nome');

      if (clientesError) throw clientesError;
      setClientes(clientesData || []);

      // Fetch unique cities
      const { data: cidadesData, error: cidadesError } = await supabase
        .from('vw_agregados_completo')
        .select('cidade')
        .eq('company_id', companyId)
        .not('cidade', 'is', null);

      if (cidadesError) throw cidadesError;
      const uniqueCidades = Array.from(new Set(cidadesData?.map(item => item.cidade).filter(Boolean)));
      setCidades(uniqueCidades);

      // Fetch unique tipologias
      const { data: tipologiasData, error: tipologiasError } = await supabase
        .from('veiculo')
        .select('tipologia')
        .eq('company_id', companyId)
        .not('tipologia', 'is', null);

      if (tipologiasError) throw tipologiasError;
      const uniqueTipologias = Array.from(new Set(tipologiasData?.map(item => item.tipologia).filter(Boolean)));
      setTipologias(uniqueTipologias);
    } catch (error) {
      console.error('Error fetching filters:', error);
      toast.error('Erro ao carregar filtros');
    }
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
    setSelectAll(newSelectedItems.size === filteredAgregados.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAgregados.map(a => a.motorista_id)));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkAction = async (actionType: 'status' | 'client') => {
    setBulkActionType(actionType);
    setIsBulkActionsModalOpen(true);
  };

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .delete()
          .eq('motorista_id', id);

        if (error) throw error;
      }

      // Update the list
      setAgregados(agregados.filter(a => !selectedItems.has(a.motorista_id)));
      toast.success(`${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''} excluído${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting agregados:', error);
      toast.error('Erro ao excluir agregados');
    }
  };

  const handleMassMessage = () => {
    setIsMassMessageModalOpen(true);
  };

  const handleStartChat = (telefone: string | null, nome: string) => {
    if (telefone) {
      startChat(telefone, nome);
    } else {
      toast.error('Este agregado não possui telefone cadastrado');
    }
  };

  const handleViewDocument = (agregado: Agregado) => {
    setSelectedAgregado(agregado);
    setIsDocumentViewerOpen(true);
  };

  const handleUploadDocument = (agregado: Agregado) => {
    setSelectedAgregado(agregado);
    setIsDocumentUploadModalOpen(true);
  };

  const handleOpenUnifiedModal = (agregado: Agregado) => {
    setSelectedAgregado(agregado);
    setIsUnifiedModalOpen(true);
  };

  const exportToExcel = () => {
    try {
      const dataToExport = filteredAgregados.map(agregado => ({
        'Nome': agregado.nome,
        'CPF': formatCPF(agregado.cpf),
        'Telefone': agregado.telefone ? formatPhone(agregado.telefone) : '-',
        'Email': agregado.email || '-',
        'Status': agregado.st_cadastro.replace(/_/g, ' ').toUpperCase(),
        'Cliente': agregado.cliente?.nome || '-',
        'Cidade': agregado.cidade || '-',
        'Veículo': agregado.veiculo && agregado.veiculo.length > 0 ? 
          `${agregado.veiculo[0].placa.toUpperCase()} - ${agregado.veiculo[0].marca} ${agregado.veiculo[0].tipo}` : '-',
        'Tipologia': agregado.veiculo && agregado.veiculo.length > 0 ? 
          agregado.veiculo[0].tipologia : '-',
        'Data de Cadastro': new Date(agregado.data_cadastro).toLocaleDateString('pt-BR')
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Agregados');
      XLSX.writeFile(wb, `agregados_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Dados exportados com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar dados');
    }
  };

  const filteredAgregados = agregados.filter(agregado => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      agregado.nome.toLowerCase().includes(searchLower) ||
      agregado.cpf.includes(searchTerm) ||
      (agregado.email && agregado.email.toLowerCase().includes(searchLower)) ||
      (agregado.telefone && agregado.telefone.includes(searchTerm)) ||
      (agregado.veiculo && agregado.veiculo.length > 0 && 
        agregado.veiculo[0].placa.toLowerCase().includes(searchLower));
    
    const matchesStatus = !statusFilter || agregado.st_cadastro === statusFilter;
    const matchesCliente = !clienteFilter || 
      (clienteFilter === 'sem_cliente' ? !agregado.cliente : 
        agregado.cliente?.cliente_id.toString() === clienteFilter);
    const matchesCidade = !cidadeFilter || agregado.cidade === cidadeFilter;
    const matchesTipologia = !tipologiaFilter || 
      (agregado.veiculo && agregado.veiculo.length > 0 && 
        agregado.veiculo[0].tipologia === tipologiaFilter);
    
    return matchesSearch && matchesStatus && matchesCliente && matchesCidade && matchesTipologia;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-96 flex-1">
              <input
                type="text"
                placeholder="Buscar por nome, CPF, email, telefone ou placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all"
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

            {/* Export and Add Agregado */}
            <div className="flex gap-2">
              <div className="flex gap-2">
                {selectedItems.size > 0 && (
                  <>
                    <button
                      onClick={() => handleBulkAction('status')}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                              transition-colors flex items-center gap-2 text-sm"
                    >
                      <Users className="w-4 h-4" />
                      Atualizar Status
                    </button>
                    <button
                      onClick={() => handleBulkAction('client')}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                              transition-colors flex items-center gap-2 text-sm"
                    >
                      <Users className="w-4 h-4" />
                      Atualizar Cliente
                    </button>
                    <button
                      onClick={() => setIsBulkDeleteModalOpen(true)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                              focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                              transition-colors flex items-center gap-2 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                    <button
                      onClick={handleMassMessage}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                              focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                              transition-colors flex items-center gap-2 text-sm"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Mensagem
                    </button>
                  </>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsImportExportModalOpen(true)}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 
                            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 
                            transition-colors flex items-center gap-2 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Importar
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 
                            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 
                            transition-colors flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Exportar
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                            transition-colors flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Agregado
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="">Todos os status</option>
                <option value="cadastrado">Cadastrado</option>
                <option value="qualificado">Qualificado</option>
                <option value="documentacao">Documentação</option>
                <option value="gr">GR</option>
                <option value="contrato_enviado">Contrato Enviado</option>
                <option value="contratado">Contratado</option>
                <option value="repescagem">Repescagem</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            {/* Cliente Filter */}
            <div className="relative">
              <select
                value={clienteFilter}
                onChange={(e) => setClienteFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="">Todos os clientes</option>
                <option value="sem_cliente">Sem cliente</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id.toString()}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            {/* Cidade Filter */}
            <div className="relative">
              <select
                value={cidadeFilter}
                onChange={(e) => setCidadeFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="">Todas as cidades</option>
                {cidades.map((cidade, index) => (
                  <option key={index} value={cidade}>
                    {cidade}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            {/* Tipologia Filter */}
            <div className="relative">
              <select
                value={tipologiaFilter}
                onChange={(e) => setTipologiaFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="">Todas as tipologias</option>
                {tipologias.map((tipologia, index) => (
                  <option key={index} value={tipologia}>
                    {tipologia}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
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
        
        <div ref={tableRef} className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPF</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedData.map((agregado) => (
                <tr key={agregado.motorista_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(agregado.motorista_id)}
                      onChange={() => handleSelectItem(agregado.motorista_id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {agregado.nome}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {agregado.cidade || 'Cidade não informada'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatCPF(agregado.cpf)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {agregado.telefone ? formatPhone(agregado.telefone) : '-'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {agregado.email || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      agregado.st_cadastro === 'contratado' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' :
                      agregado.st_cadastro === 'rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                    }`}>
                      {agregado.st_cadastro.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {agregado.cliente?.nome || 'Sem cliente'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {agregado.veiculo && agregado.veiculo.length > 0 ? (
                        <>
                          <div className="font-medium">{agregado.veiculo[0].placa.toUpperCase()}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {agregado.veiculo[0].marca} {agregado.veiculo[0].tipo}
                          </div>
                        </>
                      ) : (
                        'Sem veículo'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                      {agregado.telefone && (
                        <button
                          onClick={() => handleStartChat(agregado.telefone, agregado.nome)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Iniciar chat"
                        >
                          <MessageCircle size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenUnifiedModal(agregado)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        title="Visualizar detalhes"
                      >
                        <FilePen size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredAgregados.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum agregado encontrado
            </p>
          </div>
        ) : (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* Modals */}
      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAgregados}
      />

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={() => {
          fetchAgregados();
          setSelectedItems(new Set());
          setSelectAll(false);
        }}
        clientes={clientes}
      />

      <BulkDeleteConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusão em Massa"
        message="Tem certeza que deseja excluir todos os agregados selecionados? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="agregado"
      />

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={Array.from(selectedItems).map(id => {
          const agregado = agregados.find(a => a.motorista_id === id);
          return agregado?.telefone || '';
        }).filter(Boolean)}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadModalOpen}
        onClose={() => setIsDocumentUploadModalOpen(false)}
        motorista_id={selectedAgregado?.motorista_id || 0}
        nome={selectedAgregado?.nome || ''}
        onUploadSuccess={fetchAgregados}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedAgregado?.documento_motorista?.[0] || null}
        nome={selectedAgregado?.nome || ''}
        cpf={selectedAgregado?.cpf}
        email={selectedAgregado?.email || undefined}
        telefone={selectedAgregado?.telefone || undefined}
        dt_nascimento={selectedAgregado?.dt_nascimento || undefined}
        isAgregado={true}
        st_cadastro={selectedAgregado?.st_cadastro}
      />

      <UnifiedAgregadoModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        motorista={selectedAgregado}
        onSuccess={fetchAgregados}
      />

      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
      />
    </div>
  );
};

export default AgregadosLista;