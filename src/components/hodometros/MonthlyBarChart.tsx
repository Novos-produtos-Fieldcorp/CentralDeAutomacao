import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface MonthlyData {
  month: string;
  km: number;
}

interface MonthlyBarChartProps {
  data: MonthlyData[];
  height?: number;
  showGrid?: boolean;
}

const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ 
  data, 
  height = 300,
  showGrid = true
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">Sem dados para exibir</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md">
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-blue-600 dark:text-blue-400">
            {payload[0].value.toLocaleString('pt-BR')} km
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />}
        <XAxis 
          dataKey="month" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#6b7280', fontSize: 12 }}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickFormatter={(value) => `${value.toLocaleString('pt-BR')}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="km" 
          fill="#3b82f6" 
          radius={[4, 4, 0, 0]}
          barSize={40}
          animationDuration={1500}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MonthlyBarChart;