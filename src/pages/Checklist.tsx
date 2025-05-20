import React, { useRef, useEffect, useState } from 'react';
import { useLocation, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ClipboardCheck, Calendar, LayoutDashboard, Wrench, Lock, ChevronRight } from 'lucide-react';
import ChecklistSemanal from './checklist/ChecklistSemanal';
import ChecklistMensal from './checklist/ChecklistMensal';
import ChecklistDashboard from './checklist/ChecklistDashboard';
import ChecklistInfiniteList from './checklist/ChecklistInfiniteList';
import ChecklistManutencao from './checklist/ChecklistManutencao';
import { useModuleAccess } from '../hooks/useModuleAccess';

const Checklist = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { moduleAccess } = useModuleAccess();
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
    { 
      path: '/checklist/semanal', 
      icon: ClipboardCheck, 
      label: 'Checklists Semanais',
      description: 'Gerenciamento dos checklists semanais dos veículos'
    },
    { 
      path: '/checklist/mensal', 
      icon: Calendar, 
      label: 'Checklists Mensais',
      description: 'Gerenciamento dos checklists mensais dos veículos'
    },
    { 
      path: '/checklist/dashboard', 
      icon: LayoutDashboard, 
      label: 'Dashboard',
      description: 'Visualização geral e análise dos checklists'
    },
    { 
      path: '/checklist/manutencao', 
      icon: Wrench, 
      label: 'Manutenção',
      description: 'Alertas e gestão de manutenções dos veículos'
    }
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  if (!moduleAccess.checklist) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Checklists</h1>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-card">
        <div className="border-b border-card-border relative">
          <div 
            ref={navRef}
            className="overflow-x-auto scrollbar-hide"
          >
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`group flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap
                            ${isActive(tab.path)
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <tab.icon className={`w-5 h-5 mr-2 ${
                    isActive(tab.path)
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                  }`} />
                  {tab.label}
                </button>
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
            <Route index element={<Navigate to="/checklist/semanal" replace />} />
            <Route path="semanal" element={<ChecklistSemanal />} />
            <Route path="mensal" element={<ChecklistMensal />} />
            <Route path="infinito" element={<Navigate to="/checklist/mensal" replace />} />
            <Route path="dashboard" element={<ChecklistDashboard />} />
            <Route path="manutencao" element={<ChecklistManutencao />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Checklist;