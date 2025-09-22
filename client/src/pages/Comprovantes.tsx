import React from 'react';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { FileText, LayoutDashboard, ChevronRight, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompanyData } from '../hooks/useCompanyData';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useState, useEffect, useRef } from 'react';
import ComprovantesDashboard from './comprovantes/ComprovantesDashboard';
import ComprovantesLista from './comprovantes/ComprovantesLista';
import LoadingSpinner from '../components/LoadingSpinner';

const Comprovantes = () => {
  const location = useLocation();
  const { query } = useCompanyData();
  const { moduleAccess, loading } = useModuleAccess();
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Check if scrolling is needed and update indicator visibility
  useEffect(() => {
    const checkScroll = () => {
      if (navRef.current) {
        const { scrollWidth, clientWidth, scrollLeft } = navRef.current;
        // Show indicator if there's more content to scroll AND we're not at the end
        setShowScrollIndicator(scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    // Initial check
    checkScroll();

    // Add scroll event listener
    const navElement = navRef.current;
    if (navElement) {
      navElement.addEventListener('scroll', checkScroll);
    }

    // Check on window resize too
    window.addEventListener('resize', checkScroll);

    return () => {
      if (navElement) {
        navElement.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const tabs = [
    { path: '/comprovantes/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/comprovantes/lista', icon: FileText, label: 'Comprovantes' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Show loading spinner while checking module access
  if (loading) {
    return <LoadingSpinner />;
  }

  // Show access denied state if user doesn't have comprovantes module access
  if (!moduleAccess.comprovantes) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Lock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Acesso Restrito
              </h1>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Módulo Comprovantes não está disponível
            </p>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Sua empresa não possui acesso ao módulo de Comprovantes. Entre em contato com o administrador do sistema para mais informações sobre como habilitar este recurso.
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recursos do Módulo Comprovantes:
              </h2>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                <li>Dashboard de comprovantes por período</li>
                <li>Relatórios de comprovantes por cliente</li>
                <li>Análise de comprovantes por motorista</li>
                <li>Histórico completo de entregas</li>
                <li>Exportação de dados para Excel</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Comprovantes</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700 relative">
          <div 
            ref={navRef}
            className="flex space-x-8 px-6 overflow-x-auto scrollbar-hide relative" 
            aria-label="Tabs"
          >
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
          
          {/* Scroll indicator - only visible when there's more content to scroll */}
          {showScrollIndicator && (
            <div className="absolute right-0 top-0 bottom-0 pointer-events-none bg-gradient-to-l from-white dark:from-gray-800 to-transparent w-12 flex items-center justify-end">
              <ChevronRight className="w-5 h-5 text-gray-400 mr-2 animate-pulse" />
            </div>
          )}
        </div>

        <div className="p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/comprovantes/dashboard" replace />} />
            <Route path="/dashboard" element={<ComprovantesDashboard />} />
            <Route path="/lista" element={<ComprovantesLista />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Comprovantes;