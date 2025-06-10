import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Truck, FileText, Award, CheckCircle2, XCircle, 
  Calendar, MapPin, BarChart2, TrendingUp, AlertTriangle,
  Building2
} from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import ClientMileageSummary from '../../components/hodometros/ClientMileageSummary';

interface DashboardStats {
  totalReadings: number;
  totalKm: number;
  totalDrivers: number;
  totalVehicles: number;
  verifiedReadings: number;
  unverifiedReadings: number;
  discrepancies: number;
  clientMileage: {
    clientName: string;
    totalKm: number;
    driverCount: number;
    drivers: {
      name: string;
      km: number;
    }[];
  }[];
  driverMileage: {
    name: string;
    km: number;
    vehicleCount: number;
  }[];
}

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalReadings: 0,
    totalKm: 0,
    totalDrivers: 0,
    totalVehicles: 0,
    verifiedReadings: 0,
    unverifiedReadings: 0,
    discrepancies: 0,
    clientMileage: [],
    driverMileage: []
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all hodometro readings within date range with related data
      const { data: hodometros, error: hodometrosError } = await supabase.from('hodometro')
        .select(`
          *,
          motorista:motorista_id (
            motorista_id,
            nome,
            cpf,
            cliente_id
          ),
          veiculo:veiculo_id (
            veiculo_id,
            placa,
            marca,
            tipo
          ),
          cliente:cliente_id (
            cliente_id,
            nome
          )
        `)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate);

      if (hodometrosError) throw hodometrosError;

      // Fetch all clients
      const { data: clients, error: clientsError } = await supabase.from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId)
        .eq('st_cliente', true);

      if (clientsError) throw clientsError;

      // Process the data
      if (hodometros) {
        // Basic stats
        const totalReadings = hodometros.length;
        const totalKm = hodometros.reduce((sum, h) => sum + (h.km_rodado || 0), 0);
        const uniqueDrivers = new Set(hodometros.map(h => h.motorista_id));
        const uniqueVehicles = new Set(hodometros.map(h => h.veiculo_id));
        const verifiedReadings = hodometros.filter(h => h.verificacao === true).length;
        const unverifiedReadings = hodometros.filter(h => h.verificacao === false || h.verificacao === null).length;
        const discrepancies = hodometros.filter(h => h.comparacao_leitura === false).length;

        // Process client mileage data
        const clientMap = new Map();
        
        // Initialize with all clients (even those with no data)
        clients?.forEach(client => {
          clientMap.set(client.cliente_id, {
            clientName: client.nome,
            totalKm: 0,
            driverCount: 0,
            drivers: [],
            driverSet: new Set() // Temporary set to track unique drivers
          });
        });
        
        // Add "No Client" category
        clientMap.set(0, {
          clientName: "Sem Cliente",
          totalKm: 0,
          driverCount: 0,
          drivers: [],
          driverSet: new Set()
        });

        // Process each hodometro reading
        hodometros.forEach(h => {
          if (!h.motorista) return;
          
          const clientId = h.motorista.cliente_id || 0;
          const driverName = h.motorista.nome;
          const km = h.km_rodado || 0;
          
          // Get or create client entry
          if (!clientMap.has(clientId)) {
            const clientName = h.cliente?.nome || "Sem Cliente";
            clientMap.set(clientId, {
              clientName,
              totalKm: 0,
              driverCount: 0,
              drivers: [],
              driverSet: new Set()
            });
          }
          
          const clientData = clientMap.get(clientId);
          
          // Add kilometers to client total
          clientData.totalKm += km;
          
          // Track unique drivers for this client
          if (!clientData.driverSet.has(h.motorista_id)) {
            clientData.driverSet.add(h.motorista_id);
            clientData.driverCount++;
            clientData.drivers.push({
              name: driverName,
              km: 0 // Initialize km
            });
          }
          
          // Add kilometers to the driver's total
          const driverIndex = clientData.drivers.findIndex(d => d.name === driverName);
          if (driverIndex !== -1) {
            clientData.drivers[driverIndex].km += km;
          }
        });
        
        // Convert Map to array and remove the temporary driverSet
        const clientMileage = Array.from(clientMap.values())
          .filter(client => client.totalKm > 0) // Only include clients with kilometers
          .map(({ driverSet, ...rest }) => rest);

        // Process driver mileage data
        const driverMap = new Map();
        
        hodometros.forEach(h => {
          if (!h.motorista) return;
          
          const driverId = h.motorista_id;
          const driverName = h.motorista.nome;
          const km = h.km_rodado || 0;
          
          if (!driverMap.has(driverId)) {
            driverMap.set(driverId, {
              name: driverName,
              km: 0,
              vehicleCount: 0,
              vehicleSet: new Set()
            });
          }
          
          const driverData = driverMap.get(driverId);
          driverData.km += km;
          
          if (!driverData.vehicleSet.has(h.veiculo_id)) {
            driverData.vehicleSet.add(h.veiculo_id);
            driverData.vehicleCount++;
          }
        });
        
        // Convert Map to array and remove the temporary vehicleSet
        const driverMileage = Array.from(driverMap.values())
          .map(({ vehicleSet, ...rest }) => rest)
          .sort((a, b) => b.km - a.km); // Sort by km (highest first)

        setStats({
          totalReadings,
          totalKm,
          totalDrivers: uniqueDrivers.size,
          totalVehicles: uniqueVehicles.size,
          verifiedReadings,
          unverifiedReadings,
          discrepancies,
          clientMileage,
          driverMileage
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <PeriodSelector
          periodType={periodType}
          dateRange={dateRange}
          onPeriodChange={updatePeriod}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard
          title="Total de Leituras"
          value={stats.totalReadings}
          icon={FileText}
          variant="blue"
        />
        <StatCard
          title="KM Total"
          value={stats.totalKm}
          suffix="km"
          icon={TrendingUp}
          variant="blue-light"
        />
        <StatCard
          title="Motoristas"
          value={stats.totalDrivers}
          icon={Users}
          variant="blue"
        />
        <StatCard
          title="Veículos"
          value={stats.totalVehicles}
          icon={Truck}
          variant="blue-light"
        />
        <StatCard
          title="Leituras Verificadas"
          value={stats.verifiedReadings}
          icon={CheckCircle2}
          variant="blue"
        />
        <StatCard
          title="Divergências"
          value={stats.discrepancies}
          icon={AlertTriangle}
          variant="blue-light"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Mileage Summary */}
        <ClientMileageSummary data={stats.clientMileage} />

        {/* Top Drivers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Top Motoristas por KM
            </h3>
          </div>
          <div className="space-y-4">
            {stats.driverMileage.slice(0, 5).map((driver, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {driver.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({driver.vehicleCount} veículo{driver.vehicleCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {formatNumber(driver.km)} km
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (driver.km / Math.max(...stats.driverMileage.map(d => d.km), 1)) * 100
                      )}%` 
                    }}
                  />
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
  suffix = '',
  icon: Icon,
  variant = 'blue'
}: { 
  title: string;
  value: number;
  suffix?: string;
  icon: any;
  variant?: 'blue' | 'blue-light';
}) => {
  const variants = {
    'blue': {
      icon: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20'
    },
    'blue-light': {
      icon: 'text-blue-400 dark:text-blue-300',
      bg: 'bg-blue-50/80 dark:bg-blue-900/10'
    }
  };

  const style = variants[variant];
  
  // Format number with dot as thousands separator
  const formattedValue = value.toLocaleString('pt-BR');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-md min-h-[160px] flex flex-col">
      <div className="flex flex-col items-center text-center h-full">
        {/* Icon Container */}
        <div className={`p-3 rounded-lg ${style.bg} mb-3`}>
          <Icon className={`w-6 h-6 ${style.icon}`} />
        </div>
        
        {/* Title Container - Allow wrapping for long titles */}
        <div className="flex-1 flex items-center">
          <h3 className="text-[18px] font-medium text-gray-600 dark:text-gray-400 leading-tight">
            {title}
          </h3>
        </div>
        
        {/* Value Container */}
        <div className="mt-3">
          <span className="text-[16px] font-bold text-gray-900 dark:text-white">
            {formattedValue}{suffix && ` ${suffix}`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HodometrosDashboard;