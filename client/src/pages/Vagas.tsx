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
      // First get company_id from account_id
      const companyResponse = await fetch(`/api/company/by-account/${accountId}`);
      if (!companyResponse.ok) {
        console.error('Error fetching company data');
        return;
      }
      
      const companyData = await companyResponse.json();
      const companyId = companyData.company_id;
      
      // Then fetch dashboard data using company_id
      const apiBaseUrl = window.location.hostname.includes('netlify.app') 
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1` 
        : '/api';
      const response = await fetch(`${apiBaseUrl}/vagas/dashboard/${companyId}`);
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
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Resumo das Vagas
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Visualização geral do status das vagas
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Status Distribution */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Distribuição por Status
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">Abertas</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {dashboardData.vagasAbertas}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-gray-500 rounded-full mr-3"></div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">Fechadas</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {dashboardData.vagasFechadas}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">Vencendo</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {dashboardData.vagasVencendo}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Ações Rápidas
                        </h4>
                        <div className="space-y-2">
                          <Link
                            to="/vagas/lista"
                            className="block w-full px-4 py-2 text-sm text-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 hover:border-blue-300 dark:border-blue-700 dark:hover:border-blue-600 rounded-lg transition-colors"
                          >
                            Ver Todas as Vagas
                          </Link>
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="block w-full px-4 py-2 text-sm text-center text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
                          >
                            Nova Vaga
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {dashboardData.totalVagas > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Progress das Vagas
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {Math.round((dashboardData.vagasFechadas / dashboardData.totalVagas) * 100)}% concluídas
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(dashboardData.vagasFechadas / dashboardData.totalVagas) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
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