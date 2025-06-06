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

interface MonthlyData {
  month: string;
  km: number;
}

interface DriverMileageChartProps {
  data: MonthlyData[];
  driverName: string;
}

const DriverMileageChart: React.FC<DriverMileageChartProps> = ({ data, driverName }) => {
  // Generate colors with a blue gradient
  const colors = data.map((_, index) => {
    const intensity = 40 + (index * 5);
    return `rgba(59, 130, 246, ${0.5 + (index * 0.05)})`;
  });

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {`${payload[0].value.toLocaleString('pt-BR')} km`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4">
        Quilometragem Mensal: {driverName}
      </h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis 
              dataKey="month" 
              angle={-45} 
              textAnchor="end" 
              height={60} 
              tick={{ fontSize: 12 }}
              stroke="#9CA3AF"
            />
            <YAxis 
              tickFormatter={(value) => `${value.toLocaleString('pt-BR')}`}
              stroke="#9CA3AF"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ bottom: 0 }}
              formatter={() => 'Quilômetros Rodados'}
            />
            <Bar 
              dataKey="km" 
              name="Quilômetros Rodados" 
              radius={[4, 4, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DriverMileageChart;