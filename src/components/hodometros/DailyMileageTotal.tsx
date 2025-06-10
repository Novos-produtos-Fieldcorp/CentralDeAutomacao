import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface DailyMileageProps {
  selectedDate?: string;
}

const DailyMileageTotal: React.FC<DailyMileageProps> = ({ selectedDate }) => {
  const [totalKm, setTotalKm] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const { companyId } = useAuth();
  
  useEffect(() => {
    const fetchDailyMileage = async () => {
      try {
        setLoading(true);
        
        // Use today's date if no date is provided
        const targetDate = selectedDate || new Date().toISOString().split('T')[0];
        
        // Fetch all hodometer readings for the specified date
        const { data, error } = await supabase
          .from('hodometro')
          .select(`
            id_hodometro,
            km_rodado,
            hod_lido,
            hod_informado,
            data,
            motorista:motorista_id (
              motorista_id,
              nome
            )
          `)
          .eq('data', targetDate)
          .eq('company_id', companyId);
        
        if (error) throw error;
        
        // Calculate total kilometers
        let dailyTotal = 0;
        
        if (data && data.length > 0) {
          // Sum up km_rodado values (which represent the distance traveled)
          dailyTotal = data.reduce((sum, reading) => {
            // Use km_rodado if available, otherwise calculate from hodometer readings
            if (reading.km_rodado) {
              return sum + reading.km_rodado;
            } else if (reading.hod_lido && reading.hod_informado) {
              // Calculate difference between readings
              const diff = Math.max(0, reading.hod_lido - reading.hod_informado);
              return sum + diff;
            }
            return sum;
          }, 0);
        }
        
        setTotalKm(dailyTotal);
      } catch (error) {
        console.error('Error fetching daily mileage:', error);
        toast.error('Erro ao calcular quilometragem diária');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDailyMileage();
  }, [selectedDate, companyId]);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border-l-4 border-blue-500 dark:border-blue-400 p-6 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1">
      <div className="flex flex-col items-center text-center">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
          <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          Quilometragem Total Diária
        </h3>
        
        {loading ? (
          <div className="animate-pulse h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
        ) : (
          <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
            {totalKm.toLocaleString('pt-BR')} km
          </span>
        )}
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-center">
          <Calendar className="w-4 h-4 mr-1" />
          {selectedDate ? new Date(selectedDate).toLocaleDateString('pt-BR') : 'Hoje'}
        </p>
      </div>
    </div>
  );
};

export default DailyMileageTotal;