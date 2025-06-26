import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TimeDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TimeDebugModal: React.FC<TimeDebugModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeData, setTimeData] = useState<any>(null);
  const [debugData, setDebugData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTimeData();
      fetchDebugData();
    }
  }, [isOpen]);

  const fetchTimeData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_current_brasilia_time_details');
      
      if (error) throw error;
      setTimeData(data);
    } catch (err) {
      console.error('Error fetching time data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados de horário');
    } finally {
      setLoading(false);
    }
  };

  const fetchDebugData = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/debug-group-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      console.error('Error fetching debug data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados de debug');
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch (e) {
      return timeString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Diagnóstico de Horário
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Erro ao buscar dados</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Informações de Horário</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Horário UTC</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {timeData?.utc_time ? formatTime(timeData.utc_time) : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Horário Brasília</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {timeData?.brasilia_time ? formatTime(timeData.brasilia_time) : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Horário Formatado (HH:MM)</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {timeData?.formatted_time || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {debugData && (
                <>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Dados de Debug</h3>
                    <div className="space-y-2">
                      <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Horário Atual (Formatado)</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {debugData.debug_info?.current_time?.formatted_time || 'N/A'}
                        </p>
                      </div>
                      
                      <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Grupos Ativos</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {debugData.debug_info?.groups?.total_active || 0} grupo(s)
                        </p>
                      </div>
                      
                      <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Grupos com Horário Atual</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {debugData.debug_info?.groups?.matching_current_time || 0} grupo(s)
                        </p>
                        {debugData.debug_info?.groups?.matching_groups?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Grupos correspondentes:</p>
                            {debugData.debug_info.groups.matching_groups.map((g: any) => (
                              <div key={g.id} className="text-xs text-gray-700 dark:text-gray-300">
                                {g.name} (Horário: {g.scheduled_time})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Envios Recentes</p>
                        {debugData.debug_info?.recent_envios?.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {debugData.debug_info.recent_envios.map((e: any) => (
                              <div key={e.id} className="text-xs border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                                <p className="text-gray-700 dark:text-gray-300">
                                  {formatTime(e.data_envio)}
                                </p>
                                <p className={`text-xs ${e.status ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {e.status ? 'Sucesso' : 'Falha'}: {e.mensagem}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            Nenhum envio recente
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Todos os Grupos Ativos</h3>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Nome</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Horário</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                          {debugData.debug_info?.groups?.all_active_groups?.map((g: any) => (
                            <tr key={g.id} className={g.scheduled_time === debugData.debug_info?.current_time?.formatted_time ? 'bg-amber-100 dark:bg-amber-900/30' : ''}>
                              <td className="px-3 py-2 text-xs text-gray-900 dark:text-white">{g.id}</td>
                              <td className="px-3 py-2 text-xs text-gray-900 dark:text-white">{g.name}</td>
                              <td className="px-3 py-2 text-xs text-gray-900 dark:text-white">{g.scheduled_time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeDebugModal;