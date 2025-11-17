import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, ChevronRight } from 'lucide-react';
import { useModuleAccess } from '../hooks/useModuleAccess';
import ComprovRotaDashboard from '@/pages/comprov-rota/ComprovRotaDashboard';
import ComprovRotaLista from '@/pages/comprov-rota/ComprovRotaLista';

const ComprovRota = () => {
  const location = useLocation();
  const { moduleAccess, loading } = useModuleAccess();
  const navRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (navRef.current) {
        const { scrollWidth, clientWidth, scrollLeft } = navRef.current;
        setShowScrollIndicator(scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    checkScroll();

    const navElement = navRef.current;
    if (navElement) {
      navElement.addEventListener('scroll', checkScroll);
    }

    window.addEventListener('resize', checkScroll);

    return () => {
      if (navElement) {
        navElement.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const tabs = [
    { path: '/comprov-rota/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/comprov-rota/lista', icon: ClipboardList, label: 'Comprovantes' }
  ];

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!moduleAccess.comprovRota) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
        Comprovante de Rota
      </h1>

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
                  data-testid={`tab-${tab.label.toLowerCase().replace(' ', '-')}`}
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
          
          {showScrollIndicator && (
            <div className="absolute right-0 top-0 bottom-0 pointer-events-none bg-gradient-to-l from-white dark:from-gray-800 to-transparent w-12 flex items-center justify-end">
              <ChevronRight className="w-5 h-5 text-gray-400 mr-2 animate-pulse" />
            </div>
          )}
        </div>

        <div className="p-6">
          <Routes>
            <Route index element={<Navigate to="/comprov-rota/dashboard" replace />} />
            <Route path="dashboard" element={<ComprovRotaDashboard />} />
            <Route path="lista" element={<ComprovRotaLista />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default ComprovRota;
