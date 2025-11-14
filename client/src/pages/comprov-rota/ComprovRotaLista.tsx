import { useState, useEffect, type ChangeEvent } from 'react';
import { MapPin, Plus, Search, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import LoadingSpinner from '../../components/LoadingSpinner';

interface ComprovRotaItem {
  id: number;
  created_at: string;
  id_motorista: number | null;
  company_id: number | null;
  foto: string | null;
  motorista?: {
    motorista_id: number;
    nome: string;
  } | null;
}

export default function ComprovRotaLista() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [comprovantes, setComprovantes] = useState<ComprovRotaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredComprovantes, setFilteredComprovantes] = useState<ComprovRotaItem[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchComprovantes();
    }
  }, [companyId]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = comprovantes.filter((item) => {
        const motoristaData = item.motorista;
        return motoristaData?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredComprovantes(filtered);
    } else {
      setFilteredComprovantes(comprovantes);
    }
  }, [searchTerm, comprovantes]);

  const fetchComprovantes = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('comprov_rota')
        .select(`
          id,
          created_at,
          id_motorista,
          company_id,
          foto,
          motorista:motorista!comprov_rota_id_motorista_fkey (
            motorista_id,
            nome
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching comprovantes de rota:', error);
        toast.error('Erro ao carregar comprovantes de rota');
        return;
      }

      setComprovantes(data || []);
      setFilteredComprovantes(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="h-8 w-8 text-blue-600" />
            Comprovantes de Rota
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie os comprovantes de rota dos motoristas
          </p>
        </div>
        <button 
          data-testid="button-add-comprov-rota"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Comprovante
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filtros</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                data-testid="input-search-motorista"
                type="text"
                placeholder="Buscar por motorista..."
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {filteredComprovantes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12">
          <div className="flex flex-col items-center justify-center">
            <MapPin className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum comprovante encontrado
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              {searchTerm 
                ? 'Nenhum resultado encontrado para sua busca.' 
                : 'Comece adicionando um novo comprovante de rota.'}
            </p>
            {!searchTerm && (
              <button 
                data-testid="button-add-first-comprov"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Adicionar Primeiro Comprovante
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComprovantes.map((item) => {
            const motoristaData = item.motorista;
            const motoristaNome = motoristaData?.nome || 'Motorista não identificado';

            return (
              <div 
                key={item.id} 
                data-testid={`card-comprov-rota-${item.id}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        {motoristaNome}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.created_at)}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md border border-gray-300 dark:border-gray-600">
                      #{item.id}
                    </span>
                  </div>

                  {item.foto ? (
                    <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <img 
                        src={item.foto} 
                        alt="Comprovante" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <MapPin className="h-12 w-12 text-gray-400 dark:text-gray-600" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Total: {filteredComprovantes.length} comprovante{filteredComprovantes.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
