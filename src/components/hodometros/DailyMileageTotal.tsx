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
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-800 p-6 rounded-xl shadow-lg border border-blue-400 dark:border-blue-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col items-center text-center">
        <div className="p-3 bg-white/20 rounded-xl mb-3">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        
        <h3 className="text-sm font-medium text-blue-100 mb-2">
          Quilometragem Total Diária
        </h3>
        
        {loading ? (
          <div className="animate-pulse h-12 w-40 bg-white/20 rounded-md"></div>
        ) : (
          <p className="text-3xl font-bold text-white">
            {totalKm.toLocaleString('pt-BR')} km
          </p>
        )}
        
        <p className="text-sm text-blue-200 mt-3 flex items-center justify-center">
          <Calendar className="w-4 h-4 mr-1" />
          {selectedDate ? new Date(selectedDate).toLocaleDateString('pt-BR') : 'Hoje'}
        </p>
      </div>
    </div>
  );
};

export default DailyMileageTotal;