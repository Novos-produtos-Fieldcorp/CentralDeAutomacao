import React, { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TodayReadingsCard = () => {
  const [todayReadings, setTodayReadings] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const { companyId } = useAuth();
  
  useEffect(() => {
    const fetchTodayReadings = async () => {
      try {
        setLoading(true);
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch all hodometer readings for today
        const { data, error, count } = await supabase
          .from('hodometro')
          .select('id_hodometro', { count: 'exact' })
          .eq('data', today)
          .eq('company_id', companyId);
        
        if (error) throw error;
        
        setTodayReadings(count || 0);
      } catch (error) {
        console.error('Error fetching today readings:', error);
        toast.error('Erro ao calcular leituras de hoje');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTodayReadings();
  }, [companyId]);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1">
      <div className="flex flex-col items-center text-center">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl mb-3">
          <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
          Leituras Realizadas Hoje
        </h3>
        
        {loading ? (
          <div className="animate-pulse h-12 w-40 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
        ) : (
          <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
            {todayReadings}
          </p>
        )}
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
          {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  );
};

export default TodayReadingsCard;