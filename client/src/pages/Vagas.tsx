import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Plus, MapPin, Calendar, Clock, Users, Building, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DashboardStats from '../components/DashboardStats';
import VagasList from '../components/VagasList';
import AddVagaModal from '../components/AddVagaModal';

interface DashboardData {
  totalVagas: number;
  vagasAbertas: number;
  vagasFechadas: number;
  vagasVencendo: number;
}

const Vagas: React.FC = () => {
  const location = useLocation();
  const { accountId } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalVagas: 0,
    vagasAbertas: 0,
    vagasFechadas: 0,
    vagasVencendo: 0,
  });

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/vagas/dashboard/${accountId}`);
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchDashboardData();
    }
  }, [accountId]);

  const tabs = [
    { 
      path: '/vagas', 
      icon: LayoutDashboard, 
      label: 'Dashboard'
    },
    { 
      path: '/vagas/lista', 
      icon: Building, 
      label: 'Vagas',
      count: dashboardData.totalVagas 
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const dashboardStats = [
    {
      title: 'Total de Vagas',
      value: dashboardData.totalVagas,
      icon: <Building className="h-8 w-8" />,
      color: 'bg-blue-500',
      change: '+0%',
      changeType: 'neutral' as const,
    },
    {
      title: 'Vagas Abertas',
      value: dashboardData.vagasAbertas,
      icon: <Plus className="h-8 w-8" />,
      color: 'bg-green-500',
      change: '+0%',
      changeType: 'positive' as const,
    },
    {
      title: 'Vagas Fechadas',
      value: dashboardData.vagasFechadas,
      icon: <Calendar className="h-8 w-8" />,
      color: 'bg-gray-500',
      change: '+0%',
      changeType: 'neutral' as const,
    },
    {
      title: 'Vencendo em 7 dias',
      value: dashboardData.vagasVencendo,
      icon: <Clock className="h-8 w-8" />,
      color: 'bg-yellow-500',
      change: '+0%',
      changeType: 'warning' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestão de Vagas</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700 relative">
          <div className="flex space-x-8 px-6 overflow-x-auto scrollbar-hide relative" aria-label="Tabs">
            {tabs.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                  isActive(tab.path)
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-2 py-0.5 px-2 rounded-full text-xs font-medium ${
                    isActive(tab.path)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="p-6">
          <Routes>
            <Route index element={
              <div className="space-y-6">
                <DashboardStats stats={dashboardStats} />
                
                {/* Recent Activity */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Atividade Recente
                  </h3>
                  <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                    Nenhuma atividade recente
                  </div>
                </div>
              </div>
            } />
            <Route path="lista" element={
              <VagasList 
                onRefresh={fetchDashboardData} 
                onAddClick={() => setShowAddModal(true)}
              />
            } />
          </Routes>
        </div>
      </div>

      {/* Add Vaga Modal */}
      <AddVagaModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          fetchDashboardData();
        }}
      />
    </div>
  );
};

export default Vagas;