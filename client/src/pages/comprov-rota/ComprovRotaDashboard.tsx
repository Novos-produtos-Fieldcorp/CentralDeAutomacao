import { useState, useEffect } from 'react';
import { MapPin, Users, TrendingUp, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface DashboardStats {
  totalComprovantes: number;
  comprovantesHoje: number;
  comprovantesEsteMes: number;
  motoristasAtivos: number;
}

interface ComprovantePorMotorista {
  motorista_nome: string;
  total: number;
}

export default function ComprovRotaDashboard() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalComprovantes: 0,
    comprovantesHoje: 0,
    comprovantesEsteMes: 0,
    motoristasAtivos: 0
  });
  const [comprovantesPorMotorista, setComprovantesPorMotorista] = useState<ComprovantePorMotorista[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchDashboardData();
    }
  }, [companyId]);

  const fetchDashboardData = async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      const hoje = format(new Date(), 'yyyy-MM-dd');
      const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Total de comprovantes
      const { count: totalCount } = await supabase
        .from('comprov_rota')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      // Comprovantes hoje
      const { count: hojeCount } = await supabase
        .from('comprov_rota')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', `${hoje}T00:00:00`)
        .lte('created_at', `${hoje}T23:59:59`);

      // Comprovantes este mês
      const { count: mesCount } = await supabase
        .from('comprov_rota')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', `${inicioMes}T00:00:00`)
        .lte('created_at', `${fimMes}T23:59:59`);

      // Motoristas com comprovantes (únicos)
      const { data: motoristasData } = await supabase
        .from('comprov_rota')
        .select('id_motorista')
        .eq('company_id', companyId)
        .not('id_motorista', 'is', null);

      const motoristasUnicos = new Set(motoristasData?.map(m => m.id_motorista) || []);

      // Comprovantes por motorista (top 5)
      const { data: porMotoristaData } = await supabase
        .from('comprov_rota')
        .select(`
          id_motorista,
          motorista:motorista!comprov_rota_id_motorista_fkey (
            nome
          )
        `)
        .eq('company_id', companyId)
        .not('id_motorista', 'is', null);

      // Agrupar por motorista
      const motoristasMap = new Map<string, number>();
      porMotoristaData?.forEach(item => {
        const motoristaData = Array.isArray(item.motorista) ? item.motorista[0] : item.motorista;
        const nome = motoristaData?.nome || 'Desconhecido';
        motoristasMap.set(nome, (motoristasMap.get(nome) || 0) + 1);
      });

      const topMotoristas = Array.from(motoristasMap.entries())
        .map(([nome, total]) => ({ motorista_nome: nome, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setStats({
        totalComprovantes: totalCount || 0,
        comprovantesHoje: hojeCount || 0,
        comprovantesEsteMes: mesCount || 0,
        motoristasAtivos: motoristasUnicos.size
      });

      setComprovantesPorMotorista(topMotoristas);

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Comprovantes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.totalComprovantes}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <MapPin className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Hoje</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.comprovantesHoje}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <Calendar className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Este Mês</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.comprovantesEsteMes}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <TrendingUp className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Motoristas Ativos</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.motoristasAtivos}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
              <Users className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Top Motoristas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Top 5 Motoristas
        </h3>
        
        {comprovantesPorMotorista.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Nenhum comprovante registrado
          </p>
        ) : (
          <div className="space-y-3">
            {comprovantesPorMotorista.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.motorista_nome}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {item.total} comprovante{item.total !== 1 ? 's' : ''}
                  </span>
                  <div className="h-2 w-24 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                      style={{ 
                        width: `${Math.min((item.total / Math.max(...comprovantesPorMotorista.map(m => m.total))) * 100, 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informações Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            📍 Sobre os Comprovantes de Rota
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Os comprovantes de rota documentam as entregas e trajetos realizados pelos motoristas, 
            incluindo fotos e informações de localização para melhor rastreabilidade.
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
          <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
            ✅ Dica
          </h4>
          <p className="text-sm text-green-800 dark:text-green-200">
            Mantenha um registro consistente dos comprovantes para melhor controle e 
            auditoria das operações de entrega da sua frota.
          </p>
        </div>
      </div>
    </div>
  );
}
