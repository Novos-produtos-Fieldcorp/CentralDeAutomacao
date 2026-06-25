import React from 'react';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Truck, LayoutDashboard, Car, Lock, ClipboardList } from 'lucide-react';
import { useModuleAccess } from '../hooks/useModuleAccess';
import LoadingSpinner from '../components/LoadingSpinner';
import JpdDashboard from './jpd-transportes/JpdDashboard';
import JpdFretes from './jpd-transportes/JpdFretes';
import JpdVeiculos from './jpd-transportes/JpdVeiculos';
import JpdVeiculoDetalhe from './jpd-transportes/JpdVeiculoDetalhe';

const JpdTransportes = () => {
  const location = useLocation();
  const { moduleAccess, loading } = useModuleAccess();

  const tabs = [
    { path: '/jpd-transportes/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/jpd-transportes/fretes', icon: ClipboardList, label: 'Fretes' },
    { path: '/jpd-transportes/veiculos', icon: Car, label: 'Veículos' },
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  if (loading) return <LoadingSpinner />;

  if (!moduleAccess.jpdTransportes) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Lock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Acesso Restrito</h1>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Módulo JPD Transportes não está disponível</p>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Sua empresa não possui acesso ao módulo JPD Transportes. Entre em contato com o administrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
          <Truck className="w-8 h-8 text-blue-600" />
          JPD Transportes
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs">
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
              </Link>
            ))}
          </div>
        </div>
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/jpd-transportes/dashboard" replace />} />
            <Route path="/dashboard" element={<JpdDashboard />} />
            <Route path="/fretes" element={<JpdFretes />} />
            <Route path="/veiculos" element={<JpdVeiculos />} />
            <Route path="/veiculos/:placa" element={<JpdVeiculoDetalhe />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default JpdTransportes;
