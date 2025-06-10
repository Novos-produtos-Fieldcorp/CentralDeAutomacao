import React from 'react';

interface VehicleMileageProps {
  data: {
    placa: string;
    totalKm: number;
    lastDate?: string;
  }[];
}

const VehicleMileageChart: React.FC<VehicleMileageProps> = ({ data }) => {
  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  // Sort data by totalKm in descending order
  const sortedData = [...data].sort((a, b) => b.totalKm - a.totalKm);
  
  // Find max value for percentage calculation
  const maxKm = Math.max(...data.map(v => v.totalKm), 1);

  return (
    <div className="w-full space-y-4 p-6 rounded-xl bg-white dark:bg-gray-800">
      {sortedData.map((vehicle, index) => (
        <div key={index} className="relative">
          <div className="flex justify-between items-center mb-1">
            <div className="font-medium text-gray-900 dark:text-white">
              {vehicle.placa}
            </div>
            <div className="flex items-center gap-2">
              {vehicle.lastDate && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {vehicle.lastDate}
                </span>
              )}
              <span className="font-medium text-gray-900 dark:text-white">
                {formatNumber(vehicle.totalKm)} km
              </span>
            </div>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.max(
                  5, 
                  (vehicle.totalKm / maxKm) * 100
                )}%` 
              }}
            />
          </div>
        </div>
      ))}

      {data.length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          Nenhum dado disponível para o período selecionado
        </div>
      )}
    </div>
  );
};

export default VehicleMileageChart;