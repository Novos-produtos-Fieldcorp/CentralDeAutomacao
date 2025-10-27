import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Gauge, ClipboardList, LayoutDashboard, Loader as Road, ChevronRight, FileText } from 'lucide-react';
import { useModuleAccess } from '../hooks/useModuleAccess';
import HodometrosDashboard from './hodometros/HodometrosDashboard';
import HodometrosLista from './hodometros/HodometrosLista';
import HodometrosRelatorio from './hodometros/HodometrosRelatorio';
import HodometrosMinuta from './hodometros/HodometrosMinuta';
import HodometrosRomaneio from './hodometros/HodometrosRomaneio';

const Hodometros = () => {
  const location = useLocation();
  const { moduleAccess, loading } = useModuleAccess();
  const navRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

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
    { path: '/hodometros/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/hodometros/relatorio', icon: Gauge, label: 'Leituras' },
    ...(moduleAccess.minuta ? [{ path: '/hodometros/minuta', icon: ClipboardList, label: 'Minutas' }] : []),
    ...(moduleAccess.romaneio ? [{ path: '/hodometros/romaneio', icon: FileText, label: 'Romaneios' }] : []),
    { path: '/hodometros/lista', icon: ClipboardList, label: 'Relatórios' }
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!moduleAccess.hodometros) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Hodômetro e Abastecimento</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700 relative">
          <div 
            ref={navRef}
            className="overflow-x-auto scrollbar-hide"
          >
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap
                            ${isActive(tab.path)
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <tab.icon className="w-5 h-5 mr-2" />
                  {tab.label}
                </Link>
              ))}
            </nav>
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
            <Route index element={<Navigate to="/hodometros/dashboard" replace />} />
            <Route path="dashboard" element={<HodometrosDashboard />} />
            <Route path="relatorio" element={<HodometrosRelatorio />} />
            {moduleAccess.minuta && <Route path="minuta" element={<HodometrosMinuta />} />}
            {moduleAccess.romaneio && <Route path="romaneio" element={<HodometrosRomaneio />} />}
            <Route path="lista" element={<HodometrosLista />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Hodometros;