import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, Filter, Search, RefreshCw, ChevronDown, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCurrentAccount } from '../hooks/useCurrentAccount';

interface Operacao {
  id: number;
  operacao: string;
  company_id: number;
}

interface Motorista {
  motorista_id: number;
  nome: string;
}

interface Viagem {
  id: number;
  created_at: string;
  updated_at: string;
  operacao_id: number | null;
  operacao_nome?: string;
  status?: string;
  motorista_id?: number;
  motorista_nome?: string;
  veiculo_id?: number;
  placa?: string;
  origem?: string;
  destino?: string;
  data_saida?: string;
  data_chegada?: string;
}

const OperacoesDashboard = () => {
  const { companyId } = useCurrentAccount();

  const { data: operacoes = [] } = useQuery<Operacao[]>({
    queryKey: ['operacoes', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operacao')
        .select('*')
        .order('operacao');
      
      if (error) {
        console.warn('Erro ao buscar operações:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: viagensStats } = useQuery({
    queryKey: ['viagens-stats', companyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.warn('Tabela acompanhamento_viagem não acessível:', error);
        return { total: 0 };
      }
      return { total: count || 0 };
    },
    enabled: !!companyId,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Map className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total de Viagens</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{viagensStats?.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Operações Ativas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{operacoes.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Em Andamento</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">-</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Filter className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Concluídas Hoje</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">-</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Operações Cadastradas</h3>
        {operacoes.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Nenhuma operação cadastrada para esta empresa.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {operacoes.map((op) => (
              <div
                key={op.id}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <p className="font-medium text-gray-900 dark:text-white">{op.operacao}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const OperacoesViagens = () => {
  const { companyId } = useCurrentAccount();
  const [selectedOperacao, setSelectedOperacao] = useState<string>('all');
  const [selectedMotorista, setSelectedMotorista] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOperacaoDropdownOpen, setIsOperacaoDropdownOpen] = useState(false);
  const [isMotoristaDropdownOpen, setIsMotoristaDropdownOpen] = useState(false);

  const { data: operacoes = [] } = useQuery<Operacao[]>({
    queryKey: ['operacoes', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operacao')
        .select('*')
        .order('operacao');
      
      if (error) {
        console.warn('Erro ao buscar operações:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: motoristas = [] } = useQuery<Motorista[]>({
    queryKey: ['motoristas-operacoes', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: viagens = [], isLoading, refetch } = useQuery<Viagem[]>({
    queryKey: ['viagens', companyId, selectedOperacao, selectedMotorista],
    queryFn: async () => {
      let query = supabase
        .from('acompanhamento_viagem')
        .select('*')
        .limit(100);

      if (selectedOperacao !== 'all') {
        query = query.eq('operacao_id', parseInt(selectedOperacao));
      }

      if (selectedMotorista !== 'all') {
        query = query.eq('motorista_id', parseInt(selectedMotorista));
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.warn('Erro ao buscar viagens:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!companyId,
  });

  const filteredViagens = viagens.filter(viagem => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        viagem.origem?.toLowerCase().includes(search) ||
        viagem.destino?.toLowerCase().includes(search) ||
        viagem.placa?.toLowerCase().includes(search) ||
        viagem.motorista_nome?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    return true;
  });

  const getMotoristaName = (id: string) => {
    if (id === 'all') return 'Todos os Motoristas';
    const motorista = motoristas.find(m => m.motorista_id.toString() === id);
    return motorista?.nome || 'Motorista';
  };

  const getOperacaoName = (id: string) => {
    if (id === 'all') return 'Todas as Operações';
    const operacao = operacoes.find(op => op.id.toString() === id);
    return operacao?.operacao || 'Operação';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por origem, destino, placa ou motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="input-search-viagens"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsOperacaoDropdownOpen(!isOperacaoDropdownOpen);
                setIsMotoristaDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 min-w-[200px] justify-between"
              data-testid="button-filter-operacao"
            >
              <Filter className="w-4 h-4" />
              <span className="truncate">
                {getOperacaoName(selectedOperacao)}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOperacaoDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOperacaoDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedOperacao('all');
                    setIsOperacaoDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedOperacao === 'all' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  Todas as Operações
                </button>
                {operacoes.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => {
                      setSelectedOperacao(op.id.toString());
                      setIsOperacaoDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedOperacao === op.id.toString() ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {op.operacao}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsMotoristaDropdownOpen(!isMotoristaDropdownOpen);
                setIsOperacaoDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 min-w-[200px] justify-between"
              data-testid="button-filter-motorista"
            >
              <User className="w-4 h-4" />
              <span className="truncate">
                {getMotoristaName(selectedMotorista)}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isMotoristaDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMotoristaDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedMotorista('all');
                    setIsMotoristaDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedMotorista === 'all' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  Todos os Motoristas
                </button>
                {motoristas.map((motorista) => (
                  <button
                    key={motorista.motorista_id}
                    onClick={() => {
                      setSelectedMotorista(motorista.motorista_id.toString());
                      setIsMotoristaDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedMotorista === motorista.motorista_id.toString() ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {motorista.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="button-refresh-viagens"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Carregando viagens...
          </div>
        ) : filteredViagens.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhuma viagem encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Destino</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredViagens.map((viagem) => (
                  <tr key={viagem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{viagem.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {viagem.created_at ? new Date(viagem.created_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{viagem.motorista_nome || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{viagem.origem || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{viagem.destino || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{viagem.placa || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        viagem.status === 'concluida' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : viagem.status === 'em_andamento'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {viagem.status || 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Operacoes = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { path: '/operacoes', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/operacoes/viagens', label: 'Viagens', icon: Map },
  ];

  const isActiveTab = (path: string) => {
    if (path === '/operacoes') {
      return currentPath === '/operacoes' || currentPath === '/operacoes/';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Operações</h1>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActiveTab(tab.path)
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
              data-testid={`tab-${tab.label.toLowerCase()}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <Routes>
        <Route path="/" element={<OperacoesDashboard />} />
        <Route path="/viagens" element={<OperacoesViagens />} />
      </Routes>
    </div>
  );
};

export default Operacoes;
