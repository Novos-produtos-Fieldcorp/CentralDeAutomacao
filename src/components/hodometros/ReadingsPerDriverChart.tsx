import React from 'react';

interface ReadingsPerDriverProps {
  data: {
    nome: string;
    count: number;
  }[];
}

const ReadingsPerDriverChart: React.FC<ReadingsPerDriverProps> = ({ data }) => {
  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  // Sort data by count in descending order
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  
  // Find max value for percentage calculation
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Estilo fixo para o fundo escuro
  const darkBackgroundStyle = {
    backgroundColor: '#1B1F2B',
    color: 'white'
  };

  return (
    <div style={darkBackgroundStyle} className="w-full space-y-4 p-6 rounded-xl">
      {sortedData.map((driver, index) => (
        <div key={index} className="relative">
          <div className="flex justify-between items-center mb-1">
            <div className="font-medium text-white">
              {driver.nome}
            </div>
            <span className="font-medium text-white">
              {formatNumber(driver.count)}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.max(
                  5, 
                  (driver.count / maxCount) * 100
                )}%` 
              }}
            />
          </div>
        </div>
      ))}

      {data.length === 0 && (
        <div className="text-center py-4 text-gray-400">
          Nenhum dado disponível para o período selecionado
        </div>
      )}
    </div>
  );
};

export default ReadingsPerDriverChart;