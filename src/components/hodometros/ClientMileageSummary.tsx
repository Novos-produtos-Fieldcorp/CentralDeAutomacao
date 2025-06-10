import React from 'react';
import { Building2 } from 'lucide-react';

interface ClientMileageData {
  clientName: string;
  totalKm: number;
  driverCount: number;
  drivers: {
    name: string;
    km: number;
  }[];
}

interface ClientMileageSummaryProps {
  data: ClientMileageData[];
  className?: string;
}

const ClientMileageSummary: React.FC<ClientMileageSummaryProps> = ({ data, className = '' }) => {
  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  // Sort clients by total kilometers (highest first)
  const sortedData = [...data].sort((a, b) => b.totalKm - a.totalKm);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="text-blue-500 dark:text-blue-400" size={20} />
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          KM por Operação
        </h3>
      </div>
      
      <div className="space-y-4">
        {sortedData.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            Nenhum dado disponível
          </div>
        ) : (
          sortedData.map((client, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {client.clientName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({client.driverCount} motorista{client.driverCount !== 1 ? 's' : ''})
                  </span>
                </div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {formatNumber(client.totalKm)} km
                </span>
              </div>
              <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.max(
                      5, 
                      (client.totalKm / Math.max(...sortedData.map(c => c.totalKm), 1)) * 100
                    )}%` 
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ClientMileageSummary;