import { useState, useEffect } from 'react';
import { MapPin, Users, TrendingUp, Calendar, Image, Video } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  totalComprovantes: number;
  comprovantesHoje: number;
  comprovantesEsteMes: number;
  motoristasAtivos: number;
  totalFotos: number;
  totalVideos: number;
}

interface ComprovantePorMotorista {
  motorista_nome: string;
  total: number;
}

interface MediaPorDia {
  data: string;
  fotos: number;
  videos: number;
}

export default function ComprovRotaDashboard() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalComprovantes: 0,
    comprovantesHoje: 0,
    comprovantesEsteMes: 0,
    motoristasAtivos: 0,
    totalFotos: 0,
    totalVideos: 0
  });
  const [comprovantesPorMotorista, setComprovantesPorMotorista] = useState<ComprovantePorMotorista[]>([]);
  const [mediaPorDia, setMediaPorDia] = useState<MediaPorDia[]>([]);

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

      // Buscar todos os comprovantes para análise de foto/vídeo
      const { data: todosComprovantes } = await supabase
        .from('comprov_rota')
        .select('foto, created_at')
        .eq('company_id', companyId)
        .not('foto', 'is', null)
        .order('created_at', { ascending: true });

      // Função para detectar se é vídeo
      const isVideo = (foto: string | null): boolean => {
        if (!foto) return false;
        const trimmed = foto.trim();
        
        // Check base64 video
        if (trimmed.startsWith('data:video/')) return true;
        
        // Check video extensions in original data (before URL generation)
        const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
        return videoExtensions.some(ext => trimmed.toLowerCase().includes(ext));
      };

      // Contar fotos e vídeos
      let totalFotos = 0;
      let totalVideos = 0;

      // Agrupar por dia (últimos 7 dias)
      const diasMap = new Map<string, { fotos: number; videos: number }>();
      
      todosComprovantes?.forEach(item => {
        const ehVideo = isVideo(item.foto);
        
        if (ehVideo) {
          totalVideos++;
        } else {
          totalFotos++;
        }

        // Agrupar por dia
        const dia = format(parseISO(item.created_at), 'dd/MM');
        const current = diasMap.get(dia) || { fotos: 0, videos: 0 };
        
        if (ehVideo) {
          current.videos++;
        } else {
          current.fotos++;
        }
        
        diasMap.set(dia, current);
      });

      // Converter para array e pegar últimos 7 dias
      const mediaPorDiaData = Array.from(diasMap.entries())
        .map(([data, values]) => ({
          data,
          fotos: values.fotos,
          videos: values.videos
        }))
        .slice(-7);

      setStats({
        totalComprovantes: totalCount || 0,
        comprovantesHoje: hojeCount || 0,
        comprovantesEsteMes: mesCount || 0,
        motoristasAtivos: motoristasUnicos.size,
        totalFotos,
        totalVideos
      });

      setComprovantesPorMotorista(topMotoristas);
      setMediaPorDia(mediaPorDiaData);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Gráficos de Fotos e Vídeos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico de Pizza - Total Fotos vs Vídeos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Image className="h-5 w-5 text-blue-600" />
            Total de Fotos vs Vídeos
          </h3>
          {stats.totalFotos === 0 && stats.totalVideos === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Nenhuma mídia registrada
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Fotos', value: stats.totalFotos, color: '#3b82f6' },
                    { name: 'Vídeos', value: stats.totalVideos, color: '#10b981' }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[
                    { name: 'Fotos', value: stats.totalFotos, color: '#3b82f6' },
                    { name: 'Vídeos', value: stats.totalVideos, color: '#10b981' }
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalFotos}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Fotos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.totalVideos}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Vídeos</p>
            </div>
          </div>
        </div>

        {/* Gráfico de Barras - Fotos e Vídeos por Dia */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Video className="h-5 w-5 text-green-600" />
            Fotos e Vídeos por Dia (Últimos 7 Dias)
          </h3>
          {mediaPorDia.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Nenhuma mídia registrada
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mediaPorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="data" 
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar dataKey="fotos" fill="#3b82f6" name="Fotos" />
                <Bar dataKey="videos" fill="#10b981" name="Vídeos" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
