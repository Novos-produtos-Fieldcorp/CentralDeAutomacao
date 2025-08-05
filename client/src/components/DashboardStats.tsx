import React from 'react';

interface StatItem {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral' | 'warning';
}

interface DashboardStatsProps {
  stats: StatItem[];
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  const getChangeColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="flex items-center">
            <div className={`p-3 ${stat.color} rounded-lg`}>
              <div className="text-white">
                {stat.icon}
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.title}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value ? stat.value.toLocaleString('pt-BR') : '0'}
              </p>
              <p className={`text-sm ${getChangeColor(stat.changeType)}`}>
                {stat.change}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStats;