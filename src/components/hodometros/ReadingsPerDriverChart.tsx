import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface ReadingsPerDriverProps {
  data: {
    nome: string;
    count: number;
  }[];
}

const ReadingsPerDriverChart: React.FC<ReadingsPerDriverProps> = ({ data }) => {
  // Generate colors with a gradient
  const colors = data.map((_, index) => {
    return `rgba(99, 102, 241, ${0.9 - (index * 0.7 / Math.max(data.length, 1))})`;
  });

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-sm text-indigo-600 dark:text-indigo-400">
            {`${payload[0].value} leituras`}
          </p>
        </div>
      );
    }
    return null;
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis 
            type="number"
            tickFormatter={formatNumber}
            stroke="#9CA3AF"
          />
          <YAxis 
            dataKey="nome" 
            type="category" 
            width={150}
            tick={{ fontSize: 12 }}
            stroke="#9CA3AF"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ bottom: 0 }}
            formatter={() => 'Número de Leituras'}
          />
          <Bar 
            dataKey="count" 
            name="Número de Leituras"
            fill="#6366F1"
            radius={[0, 4, 4, 0]}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={colors[index % colors.length]} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ReadingsPerDriverChart;