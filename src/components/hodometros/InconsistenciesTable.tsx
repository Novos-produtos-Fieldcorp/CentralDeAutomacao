import React, { useState, useEffect } from 'react';
import { Camera, AlertCircle, X, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { formatCPF } from '../../utils/format';

interface HodometroReading {
  id_hodometro: number;
  data: string;
  hora: string;
  hod_informado: number | null;
  hod_lido: number | null;
  km_rodado: number | null;
  bateria: number | null;
  foto_hodometro: string | null;
  trip_lida: number | null;
  trip_informada: string | null;
  comparacao_leitura: boolean | null;
  verificacao: boolean | null;
  motorista: {
    motorista_id: number;
    nome: string;
    cpf: string;
  };
  veiculo: {
    veiculo_id: number;
    placa: string;
    marca: string;
    tipo: string;
  };
}

const InconsistenciesTable: React.FC = () => {
  const [hodometros, setHodometros] = useState<HodometroReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalInconsistencies, setTotalInconsistencies] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const { companyId } = useAuth();

  useEffect(() => {
    fetchInconsistencies();
  }, [companyId]);

  const fetchInconsistencies = async () => {
    try {
      setLoading(true);
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch all hodometer readings with inconsistencies (verificacao = false)
      const { data, error } = await supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          hod_lido,
          hod_informado,
          km_rodado,
          bateria,
          foto_hodometro,
          trip_lida,
          trip_informada,
          comparacao_leitura,
          verificacao,
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
          )
        `)
        .eq('company_id', companyId)
        .eq('verificacao', false)
        .order('data', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      setHodometros(data || []);
      setTotalInconsistencies(data?.length || 0);
    } catch (error) {
      console.error('Error fetching inconsistencies:', error);
      toast.error('Erro ao carregar inconsistências');
    } finally {
      setLoading(false);
    }
  };

  const handleShowPhoto = (photo: string | null) => {
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('pt-BR');
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Inconsistências de Hodômetro
          </h3>
        </div>
        <div className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200 rounded-full text-sm font-medium">
          {totalInconsistencies} {totalInconsistencies === 1 ? 'inconsistência' : 'inconsistências'}
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : hodometros.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro Informado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro Lido</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foto</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {hodometros.map((hodometro) => (
                <tr key={hodometro.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {hodometro.motorista?.nome || 'Não informado'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {hodometro.motorista?.cpf ? formatCPF(hodometro.motorista.cpf) : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatDateBR(hodometro.data)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {hodometro.hora}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase">
                      {hodometro.veiculo?.placa || 'Não informada'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {hodometro.veiculo?.marca} {hodometro.veiculo?.tipo}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                        <span>-</span>
                      ) : (
                        <span>{hodometro.hod_informado !== null ? formatNumber(hodometro.hod_informado) : '-'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          Bateria: {hodometro.bateria}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-900 dark:text-white">
                          {hodometro.hod_lido !== null ? formatNumber(hodometro.hod_lido) : '-'}
                        </div>
                      )}
                      
                      {/* Discrepancy tag */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Divergente
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {hodometro.foto_hodometro ? (
                      <button
                        onClick={() => handleShowPhoto(hodometro.foto_hodometro)}
                        className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        title="Ver foto do hodômetro"
                      >
                        <Camera size={18} />
                      </button>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600">
                        <Camera size={18} className="inline-block opacity-50" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-40 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
          <Eye className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma inconsistência encontrada</p>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Foto do Hodômetro
              </h3>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            <div className="relative aspect-video">
              <img
                src={selectedPhoto}
                alt="Foto do Hodômetro"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InconsistenciesTable;