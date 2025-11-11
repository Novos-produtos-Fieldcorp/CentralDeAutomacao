import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Truck, FileText, Award, CheckCircle2, XCircle, 
  Calendar, MapPin, BarChart2, TrendingUp, AlertTriangle, ChevronDown 
} from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useDateRange } from '../../hooks/useDateRange';
import LoadingSpinner from '../../components/LoadingSpinner';

interface DashboardStats {
  totalChecklists: number;
  totalMensal: number;
  totalSemanal: number;
  totalProblemas: number;
  problemasPorCategoria: {
    categoria: string;
    total: number;
    percentual: number;
  }[];
  checklistsPorMotorista: {
    nome: string;
    total: number;
  }[];
}

const ChecklistDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalChecklists: 0,
    totalMensal: 0,
    totalSemanal: 0,
    totalProblemas: 0,
    problemasPorCategoria: [],
    checklistsPorMotorista: []
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, pendingDateRange, updatePeriod, setDateRange, applyPendingDateRange } = useDateRange('all', true);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only fetch when date range actually changes, not on pending changes
    if (!pendingDateRange && companyId) {
      fetchDashboardData();
    }
  }, [dateRange, pendingDateRange, companyId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };

    if (showPeriodDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPeriodDropdown]);

  const fetchDashboardData = async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      
      // Fetch all checklists within date range with related data
      const { data: checklists, error: checklistError } = await supabase.from('checklist')
        .select(`
          *,
          motorista:motorista_id (
            motorista_id,
            nome,
            cpf
          ),
          veiculo:veiculo_id (
            veiculo_id,
            placa,
            marca,
            tipo
          ),
          acessorios_veiculos!checklist_id(*),
          componentes_gerais!checklist_id(*),
          farol_veiculo!checklist_id(*),
          fluido_veiculo!checklist_id(*)
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false });

      if (checklistError) throw checklistError;

      if (checklists) {
        // Basic stats
        const totalMensal = checklists.filter(c => c.id_tipo_checklist === 1).length;
        const totalSemanal = checklists.filter(c => c.id_tipo_checklist === 2).length;

        // Process problems by category
        const problemasPorCategoria = processProblemasPorCategoria(checklists);

        // Process checklists by motorista
        const checklistsPorMotorista = processChecklistsPorMotorista(checklists);

        setStats({
          totalChecklists: checklists.length,
          totalMensal,
          totalSemanal,
          totalProblemas: problemasPorCategoria.reduce((acc, cat) => acc + cat.total, 0),
          problemasPorCategoria,
          checklistsPorMotorista
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const processProblemasPorCategoria = (checklists: any[]) => {
    const categorias = {
      'Acessórios': 0,
      'Componentes': 0,
      'Iluminação': 0,
      'Fluidos': 0
    };

    let totalProblemas = 0;

    checklists.forEach(checklist => {
      // Check acessorios
      const acessorios = checklist.acessorios_veiculos?.[0];
      if (acessorios) {
        Object.entries(acessorios).forEach(([key, value]) => {
          if (!key.includes('id_') && value === 2) {
            categorias['Acessórios']++;
            totalProblemas++;
          }
        });
      }

      // Check componentes
      const componentes = checklist.componentes_gerais?.[0];
      if (componentes) {
        Object.entries(componentes).forEach(([key, value]) => {
          if (!key.includes('id_') && value === 2) {
            categorias['Componentes']++;
            totalProblemas++;
          }
        });
      }

      // Check iluminação
      const farol = checklist.farol_veiculo?.[0];
      if (farol) {
        Object.entries(farol).forEach(([key, value]) => {
          if (!key.includes('id_') && value === 2) {
            categorias['Iluminação']++;
            totalProblemas++;
          }
        });
      }

      // Check fluidos
      const fluidos = checklist.fluido_veiculo?.[0];
      if (fluidos) {
        Object.entries(fluidos).forEach(([key, value]) => {
          if (!key.includes('id_') && value === 2) {
            categorias['Fluidos']++;
            totalProblemas++;
          }
        });
      }
    });

    return Object.entries(categorias).map(([categoria, total]) => ({
      categoria,
      total,
      percentual: totalProblemas > 0 ? (total / totalProblemas) * 100 : 0
    }));
  };

  const processChecklistsPorMotorista = (checklists: any[]) => {
    const motoristasMap = new Map();

    checklists.forEach(checklist => {
      const motorista = checklist.motorista;
      if (!motorista) return;

      const current = motoristasMap.get(motorista.nome) || {
        nome: motorista.nome,
        total: 0
      };

      current.total++;

      motoristasMap.set(motorista.nome, current);
    });

    return Array.from(motoristasMap.values())
      .sort((a, b) => b.total - a.total);
  };

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        {/* Período Filter */}
        <div className="relative z-[40]" ref={periodDropdownRef}>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
          >
            <Calendar className="h-4 w-4" />
            <span>
              {periodType === 'all' ? 'Período' : 
               periodType === '1day' ? 'Hoje' :
               periodType === '15days' ? '15 dias' :
               periodType === '30days' ? '30 dias' :
               periodType === 'custom' ? 'Personalizado' : 'Período'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {showPeriodDropdown && (
            <div 
              className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
              style={{ 
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: '4px',
                zIndex: 999999
              }}
            >
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar período</span>
              </div>
              {[
                { value: 'all', label: 'Todos os períodos' },
                { value: '1day', label: 'Hoje' },
                { value: '15days', label: 'Últimos 15 dias' },
                { value: '30days', label: 'Últimos 30 dias' },
                { value: 'custom', label: 'Período personalizado' }
              ].map(({ value, label }) => (
                <div key={value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                  <button
                    type="button"
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => {
                      updatePeriod(value as any);
                      setShowPeriodDropdown(false);
                    }}
                  >
                    {label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Date Range */}
      {periodType === 'custom' && (
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data inicial
              </label>
              <input
                type="date"
                data-testid="input-custom-start-date-checklist-dashboard"
                value={pendingDateRange?.startDate || dateRange.startDate}
                onChange={(e) => setDateRange({ 
                  startDate: e.target.value, 
                  endDate: pendingDateRange?.endDate || dateRange.endDate 
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data final
              </label>
              <input
                type="date"
                data-testid="input-custom-end-date-checklist-dashboard"
                value={pendingDateRange?.endDate || dateRange.endDate}
                onChange={(e) => setDateRange({ 
                  startDate: pendingDateRange?.startDate || dateRange.startDate, 
                  endDate: e.target.value 
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          
          {pendingDateRange && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                data-testid="button-apply-custom-filter-checklist-dashboard"
                onClick={() => {
                  applyPendingDateRange();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Aplicar filtro
              </button>
              <span className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                Alterações pendentes - clique em "Aplicar filtro" para atualizar
              </span>
            </div>
          )}
        </div>
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Checklists"
          value={stats.totalChecklists}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Checklists Mensais"
          value={stats.totalMensal}
          icon={Calendar}
          color="green"
        />
        <StatCard
          title="Checklists Semanais"
          value={stats.totalSemanal}
          icon={FileText}
          color="purple"
        />
        <StatCard
          title="Problemas"
          value={stats.totalProblemas}
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problems by Category */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Problemas por Categoria
            </h3>
          </div>
          <div className="space-y-4">
            {stats.problemasPorCategoria.map((categoria, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {categoria.categoria}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {categoria.total} problemas
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ width: `${categoria.percentual}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Checklists by Driver */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Checklists por Motorista
            </h3>
          </div>
          <div className="space-y-4">
            {stats.checklistsPorMotorista.slice(0, 5).map((motorista, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {motorista.nome.charAt(0)}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {motorista.nome}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {motorista.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ 
  title, 
  value, 
  icon: Icon,
  color = 'blue'
}: { 
  title: string;
  value: number;
  icon: any;
  color?: 'blue' | 'green' | 'purple' | 'amber';
}) => {
  // Define color variants based on the hodometros dashboard style
  const colorVariants = {
    blue: {
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      textColor: 'text-blue-600',
      darkTextColor: 'dark:text-blue-400',
      bgGradient: 'from-blue-600 to-indigo-600',
      darkBgGradient: 'dark:from-blue-400 dark:to-indigo-400'
    },
    green: {
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      textColor: 'text-green-600',
      darkTextColor: 'dark:text-green-400',
      bgGradient: 'from-green-600 to-emerald-600',
      darkBgGradient: 'dark:from-green-400 dark:to-emerald-400'
    },
    purple: {
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      textColor: 'text-purple-600',
      darkTextColor: 'dark:text-purple-400',
      bgGradient: 'from-purple-600 to-violet-600',
      darkBgGradient: 'dark:from-purple-400 dark:to-violet-400'
    },
    amber: {
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      textColor: 'text-amber-600',
      darkTextColor: 'dark:text-amber-400',
      bgGradient: 'from-amber-600 to-orange-600',
      darkBgGradient: 'dark:from-amber-400 dark:to-orange-400'
    }
  };

  const variant = colorVariants[color];

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col items-center text-center">
        <div className={`p-3 ${variant.iconBg} rounded-xl mb-3`}>
          <Icon className={`w-6 h-6 ${variant.iconColor}`} />
        </div>
        
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
          {title}
        </h3>
        
        <p className={`text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${variant.bgGradient} ${variant.darkBgGradient}`}>
          {value.toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  );
};

export default ChecklistDashboard;