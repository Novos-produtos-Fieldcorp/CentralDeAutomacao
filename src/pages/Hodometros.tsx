import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Gauge, ClipboardList, LayoutDashboard, Loader as Road, ChevronRight } from 'lucide-react';
import HodometrosDashboard from './hodometros/HodometrosDashboard';
import HodometrosLista from './hodometros/HodometrosLista';
import HodometrosRelatorio from './hodometros/HodometrosRelatorio';

const Hodometros = () => {
  const location = useLocation();
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
    { path: '/hodometros/relatorio', icon: ClipboardList, label: 'Relatório de Km' },
    { path: '/hodometros/lista', icon: Gauge, label: 'Leituras' }
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-primary">Hodômetros</h1>

      <div className="bg-card rounded-lg shadow-card">
        <div className="border-b border-card-border relative">
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
                              ? 'border-primary text-primary'
                              : 'border-transparent text-text-secondary hover:text-primary hover:border-primary/30'}`}
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

        <div className="p-6 min-h-[calc(100vh-16rem)]">
          <Routes>
            <Route index element={<Navigate to="/hodometros/dashboard" replace />} />
            <Route path="dashboard" element={<HodometrosDashboard />} />
            <Route path="relatorio" element={<HodometrosRelatorio />} />
            <Route path="lista" element={<HodometrosLista />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Hodometros;