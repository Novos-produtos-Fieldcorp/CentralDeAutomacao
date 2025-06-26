import React, { useState, useEffect } from 'react';
import { X, Clock, Database, Globe, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { convertBrasiliaToUTC, convertUTCToBrasilia } from '../utils/time';

interface TimeDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TimeDebugModal: React.FC<TimeDebugModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [dbTime, setDbTime] = useState<any>(null);
  const [browserTime, setBrowserTime] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDatabaseTime();
      const interval = setInterval(() => {
        setBrowserTime(new Date());
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const fetchDatabaseTime = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_current_brasilia_time_details');
      
      if (error) throw error;
      setDbTime(data);
    } catch (error) {
      console.error('Error fetching database time:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDatabaseTime();
    setBrowserTime(new Date());
    setRefreshing(false);
  };

  // Format time as HH:MM:SS
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Format date as YYYY-MM-DD
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Calculate Brasilia time from browser time
  const getBrasiliaTime = () => {
    // Get UTC time
    const utcTime = new Date(
      browserTime.getTime() + browserTime.getTimezoneOffset() * 60 * 1000
    );
    
    // Convert to Brasilia time (UTC-3)
    return new Date(utcTime.getTime() - 3 * 60 * 60 * 1000);
  };

  // Format time as HH:MM
  const formatTimeHHMM = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const brasiliaTime = getBrasiliaTime();
  const brasiliaTimeHHMM = formatTimeHHMM(brasiliaTime);
  
  // Get UTC time in HH:MM format
  const utcTime = new Date(
    browserTime.getTime() + browserTime.getTimezoneOffset() * 60 * 1000
  );
  const utcTimeHHMM = formatTimeHHMM(utcTime);
  
  // Convert between formats for demonstration
  const brasiliaToUTC = convertBrasiliaToUTC(brasiliaTimeHHMM);
  const utcToBrasilia = convertUTCToBrasilia(utcTimeHHMM);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Diagnóstico de Fuso Horário
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex justify-end">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Atualizar
            </button>
          </div>
          
          {/* Browser Time Section */}
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Horário do Navegador
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Data e Hora Local
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {browserTime.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Horário UTC
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {browserTime.toUTCString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Formato HH:MM: {utcTimeHHMM}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Horário de Brasília (calculado)
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDate(brasiliaTime)} {formatTime(brasiliaTime)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Formato HH:MM: {brasiliaTimeHHMM}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  ISO String
                </div>
                <div className="text-sm font-mono text-gray-900 dark:text-white break-all">
                  {browserTime.toISOString()}
                </div>
              </div>
            </div>
          </div>
          
          {/* Time Conversion Test Section */}
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800/30">
            <h3 className="text-base font-medium text-green-800 dark:text-green-200 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
              Teste de Conversão de Horários
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Brasília → UTC
                </div>
                <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                  {brasiliaTimeHHMM} → {brasiliaToUTC}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Horário de Brasília convertido para UTC
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  UTC → Brasília
                </div>
                <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                  {utcTimeHHMM} → {utcToBrasilia}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Horário UTC convertido para Brasília
                </div>
              </div>
            </div>
          </div>
          
          {/* Database Time Section */}
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              Horário do Banco de Dados
            </h3>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : dbTime ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Horário UTC
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {new Date(dbTime.utc_time).toUTCString()}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Horário de Brasília
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {new Date(dbTime.brasilia_time).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Formato para Comparação com Agendamento
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                    {dbTime.formatted_time}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Este é o formato usado para comparar com o horário agendado nos grupos
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Hora UTC
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {dbTime.utc_hour}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Minuto UTC
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {dbTime.utc_minute}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Hora Brasília
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {dbTime.brasilia_hour}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Minuto Brasília
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {dbTime.brasilia_minute}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Erro ao carregar dados do banco
              </div>
            )}
          </div>
          
          {/* Time Comparison */}
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4">
              Comparação de Horários
            </h3>
            
            {dbTime && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Horário de Brasília (Navegador)
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatTime(brasiliaTime)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Horário de Brasília (Banco)
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {dbTime.formatted_time}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Diferença
                  </div>
                  <div className={`text-sm font-medium ${
                    dbTime.formatted_time === `${brasiliaTime.getHours().toString().padStart(2, '0')}:${brasiliaTime.getMinutes().toString().padStart(2, '0')}`
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {dbTime.formatted_time === `${brasiliaTime.getHours().toString().padStart(2, '0')}:${brasiliaTime.getMinutes().toString().padStart(2, '0')}`
                      ? 'Sincronizado'
                      : 'Dessincronizado'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeDebugModal;