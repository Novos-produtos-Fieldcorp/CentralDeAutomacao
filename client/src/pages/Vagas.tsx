import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Plus, MapPin, Calendar, Clock, Users, Building, Settings } from 'lucide-react';
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
  const navigate = useNavigate();
  const location = useLocation();
  const { accountId } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalVagas: 0,
    vagasAbertas: 0,
    vagasFechadas: 0,
    vagasVencendo: 0,
  });

  // Set active tab based on current route
  useEffect(() => {
    const path = location.pathname.split('/')[2] || 'dashboard';
    setActiveTab(path);
  }, [location.pathname]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'dashboard') {
      navigate('/vagas');
    } else {
      navigate(`/vagas/${tab}`);
    }
  };

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
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: <Settings size={20} />,
      count: null 
    },
    { 
      id: 'vagas', 
      label: 'Vagas', 
      icon: <Building size={20} />,
      count: dashboardData.totalVagas 
    },
  ];

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
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Gestão de Vagas
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gerencie vagas de trabalho e oportunidades
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
              {tab.count !== null && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs font-medium ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <Routes>
        <Route path="/" element={
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
        <Route path="/vagas" element={
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Lista de Vagas
              </h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <Plus size={20} className="mr-2" />
                Adicionar Vaga
              </button>
            </div>
            
            <VagasList onRefresh={fetchDashboardData} />
          </div>
        } />
      </Routes>

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