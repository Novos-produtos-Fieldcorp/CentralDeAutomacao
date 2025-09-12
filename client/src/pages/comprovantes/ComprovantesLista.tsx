import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Download, Calendar, User, Building, MapPin, FileText, Eye, Trash2, Plus, X } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import type { Comprovante } from '@/../../shared/schema';
import AddComprovanteModal from '../../components/comprovantes/AddComprovanteModal';

interface ComprovanteWithDetails extends Comprovante {
  motorista?: {
    nome: string;
  };
  cliente?: {
    nome: string;
  };
  endereco?: {
    logradouro?: {
      logradouro: string;
      nr_cep: string;
      bairro?: {
        bairro: string;
        cidade?: {
          cidade: string;
          estado?: {
            sigla_estado: string;
          };
        };
      };
    };
    nr_end?: number;
  }[];
}

const ComprovantesLista = () => {
  const { companyId } = useCompanyData();
  const [comprovantes, setComprovantes] = useState<ComprovanteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataFilter, setDataFilter] = useState<string>('');
  const [motoristaFilter, setMotoristaFilter] = useState<string>('');
  const [clienteFilter, setClienteFilter] = useState<string>('');
  const [cidadeFilter, setCidadeFilter] = useState<string>('');
  
  // Dropdown states
  const [showDataDropdown, setShowDataDropdown] = useState(false);
  const [showMotoristaDropdown, setShowMotoristaDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Ref for dropdowns
  const dataDropdownRef = useRef<HTMLDivElement>(null);
  const motoristaDropdownRef = useRef<HTMLDivElement>(null);
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  const cidadeDropdownRef = useRef<HTMLDivElement>(null);

  // Filter options
  const [motoristas, setMotoristas] = useState<{ id: number; nome: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);

  useEffect(() => {
    fetchComprovantes();
    fetchFilterOptions();
  }, [companyId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dataDropdownRef.current && !dataDropdownRef.current.contains(event.target as Node)) {
        setShowDataDropdown(false);
      }
      if (motoristaDropdownRef.current && !motoristaDropdownRef.current.contains(event.target as Node)) {
        setShowMotoristaDropdown(false);
      }
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(event.target as Node)) {
        setShowClienteDropdown(false);
      }
      if (cidadeDropdownRef.current && !cidadeDropdownRef.current.contains(event.target as Node)) {
        setShowCidadeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFilterOptions = async () => {
    try {
      // Fetch motoristas
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .order('nome');

      if (motoristasData) {
        setMotoristas(motoristasData.map(m => ({ id: m.motorista_id, nome: m.nome || '' })));
      }

      // Fetch clientes
      const { data: clientesData } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId)
        .eq('st_cliente', true)
        .order('nome');

      if (clientesData) {
        setClientes(clientesData.map(c => ({ id: c.cliente_id, nome: c.nome })));
      }

      // Fetch unique cities from addresses - simplified approach
      const { data: cidadesData } = await supabase
        .from('cidade')
        .select('cidade')
        .order('cidade');

      if (cidadesData) {
        const uniqueCidades = [...new Set(cidadesData.map(c => c.cidade))];
        setCidades(uniqueCidades);
      }

    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchComprovantes = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('comprovante')
        .select(`
          *,
          motorista:motorista_id(nome),
          cliente:cliente_id(nome),
          endereco:end_comprovante_entrega(
            nr_end,
            logradouro:id_logradouro(
              logradouro,
              nr_cep,
              bairro:id_bairro(
                bairro,
                cidade:id_cidade(
                  cidade,
                  estado:id_estado(sigla_estado)
                )
              )
            )
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;


      setComprovantes(data || []);
    } catch (error) {
      console.error('Error fetching comprovantes:', error);
      toast.error('Erro ao carregar comprovantes');
    } finally {
      setLoading(false);
    }
  };

  const filteredComprovantes = comprovantes.filter(comprovante => {
    const matchesSearch = searchTerm === '' || 
      comprovante.motorista?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comprovante.cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesData = dataFilter === '' || 
      (comprovante.created_at && format(new Date(comprovante.created_at), 'yyyy-MM-dd') === dataFilter);

    const matchesMotorista = motoristaFilter === '' || 
      comprovante.motorista?.nome === motoristaFilter;

    const matchesCliente = clienteFilter === '' || 
      comprovante.cliente?.nome === clienteFilter;

    const matchesCidade = cidadeFilter === '' || 
      comprovante.endereco?.[0]?.logradouro?.bairro?.cidade?.cidade === cidadeFilter;

    return matchesSearch && matchesData && matchesMotorista && matchesCliente && matchesCidade;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setDataFilter('');
    setMotoristaFilter('');
    setClienteFilter('');
    setCidadeFilter('');
  };

  const openImageInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Lista de Comprovantes
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            data-testid="button-add-comprovante"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por motorista ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                data-testid="input-search-comprovantes"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div className="relative" ref={dataDropdownRef}>
            <button
              onClick={() => setShowDataDropdown(!showDataDropdown)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                dataFilter 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              data-testid="dropdown-data-filter"
            >
              <Calendar className="w-4 h-4" />
              {dataFilter ? format(new Date(dataFilter), 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}
              {dataFilter && (
                <X 
                  className="w-3 h-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDataFilter('');
                  }}
                />
              )}
            </button>
            {showDataDropdown && (
              <div className="absolute top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <input
                  type="date"
                  value={dataFilter}
                  onChange={(e) => {
                    setDataFilter(e.target.value);
                    setShowDataDropdown(false);
                  }}
                  className="w-full p-2 border-0 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Motorista Filter */}
          <div className="relative" ref={motoristaDropdownRef}>
            <button
              onClick={() => setShowMotoristaDropdown(!showMotoristaDropdown)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                motoristaFilter 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              data-testid="dropdown-motorista-filter"
            >
              <User className="w-4 h-4" />
              {motoristaFilter || 'Motorista'}
              {motoristaFilter && (
                <X 
                  className="w-3 h-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMotoristaFilter('');
                  }}
                />
              )}
            </button>
            {showMotoristaDropdown && (
              <div className="absolute top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {motoristas.map((motorista) => (
                  <button
                    key={motorista.id}
                    onClick={() => {
                      setMotoristaFilter(motorista.nome);
                      setShowMotoristaDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {motorista.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cliente Filter */}
          <div className="relative" ref={clienteDropdownRef}>
            <button
              onClick={() => setShowClienteDropdown(!showClienteDropdown)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                clienteFilter 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              data-testid="dropdown-cliente-filter"
            >
              <Building className="w-4 h-4" />
              {clienteFilter || 'Cliente'}
              {clienteFilter && (
                <X 
                  className="w-3 h-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClienteFilter('');
                  }}
                />
              )}
            </button>
            {showClienteDropdown && (
              <div className="absolute top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {clientes.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => {
                      setClienteFilter(cliente.nome);
                      setShowClienteDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {cliente.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cidade Filter */}
          <div className="relative" ref={cidadeDropdownRef}>
            <button
              onClick={() => setShowCidadeDropdown(!showCidadeDropdown)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                cidadeFilter 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              data-testid="dropdown-cidade-filter"
            >
              <MapPin className="w-4 h-4" />
              {cidadeFilter || 'Cidade'}
              {cidadeFilter && (
                <X 
                  className="w-3 h-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCidadeFilter('');
                  }}
                />
              )}
            </button>
            {showCidadeDropdown && (
              <div className="absolute top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                {cidades.map((cidade, index) => (
                  <button
                    key={`cidade-${index}-${cidade}`}
                    onClick={() => {
                      setCidadeFilter(cidade);
                      setShowCidadeDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {cidade}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear Filters */}
          {(searchTerm || dataFilter || motoristaFilter || clienteFilter || cidadeFilter) && (
            <button
              onClick={clearFilters}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              data-testid="button-clear-filters"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {filteredComprovantes.length} comprovante(s) encontrado(s)
            </p>
            <button
              onClick={() => {/* TODO: Implement export */}}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2"
              data-testid="button-export-comprovantes"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Motorista
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cidade da Entrega
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Endereço de Entrega
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Comprovante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredComprovantes.map((comprovante) => (
                <tr key={comprovante.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {comprovante.created_at 
                      ? format(new Date(comprovante.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {comprovante.motorista?.nome || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {comprovante.cliente?.nome || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {comprovante.endereco?.[0]?.logradouro?.bairro?.cidade?.cidade || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {comprovante.endereco && comprovante.endereco.length > 0 ? (
                      <div className="space-y-1">
                        {comprovante.endereco.map((end, index) => (
                          <div key={index} className="text-xs">
                            {end?.logradouro?.logradouro && (
                              <div>
                                {end.logradouro.logradouro}
                                {end.nr_end && `, ${end.nr_end}`}
                              </div>
                            )}
                            {end?.logradouro?.bairro && (
                              <div className="text-gray-500">
                                {end.logradouro.bairro.bairro}
                                {end.logradouro.bairro.cidade && 
                                  ` - ${end.logradouro.bairro.cidade.cidade}`
                                }
                                {end.logradouro.bairro.cidade?.estado?.sigla_estado && 
                                  ` / ${end.logradouro.bairro.cidade.estado.sigla_estado}`
                                }
                              </div>
                            )}
                            {end?.logradouro?.nr_cep && (
                              <div className="text-gray-500">
                                CEP: {end.logradouro.nr_cep}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {comprovante.foto_comprovante ? (
                      <button
                        onClick={() => openImageInNewTab(comprovante.foto_comprovante!)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        data-testid={`button-view-image-${comprovante.id}`}
                      >
                        <FileText className="w-4 h-4" />
                        Ver Imagem
                      </button>
                    ) : (
                      <span className="text-gray-400">Sem imagem</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {comprovante.foto_comprovante && (
                        <button
                          onClick={() => openImageInNewTab(comprovante.foto_comprovante!)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          data-testid={`button-view-comprovante-${comprovante.id}`}
                          title="Ver comprovante"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {/* TODO: Implement delete */}}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        data-testid={`button-delete-comprovante-${comprovante.id}`}
                        title="Excluir comprovante"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredComprovantes.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum comprovante encontrado
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <AddComprovanteModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchComprovantes();
          fetchFilterOptions();
        }}
      />
    </div>
  );
};

export default ComprovantesLista;