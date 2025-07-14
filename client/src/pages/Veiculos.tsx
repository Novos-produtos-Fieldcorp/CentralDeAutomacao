import React, { useRef, useEffect, useState } from 'react';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Truck, Building2, ChevronRight } from 'lucide-react';
import VeiculosAgregados from './veiculos/VeiculosAgregados';
import VeiculosEmpresa from './veiculos/VeiculosEmpresa';
import VeiculosInfinito from './veiculos/VeiculosInfinito';
import { useCallback } from 'react';
import { useCompanyData } from '../hooks/useCompanyData';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const Veiculos = () => {
  const location = useLocation();
  const { companyId } = useCompanyData();
  const { accountId } = useAuth();
  const [missingDataCount, setMissingDataCount] = useState(0);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  useEffect(() => {
    fetchMissingDataCount();
  }, [accountId]);

  // Check if scrolling is needed and update indicator visibility
  useEffect(() => {
    const checkScroll = () => {
      if (tabsContainerRef.current) {
        const { scrollWidth, clientWidth, scrollLeft } = tabsContainerRef.current;
        // Show indicator if there's more content to scroll AND we're not at the end
        setShowScrollIndicator(scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    // Initial check
    checkScroll();

    // Add scroll event listener
    const tabsElement = tabsContainerRef.current;
    if (tabsElement) {
      tabsElement.addEventListener('scroll', checkScroll);
    }

    // Check on window resize too
    window.addEventListener('resize', checkScroll);

    return () => {
      if (tabsElement) {
        tabsElement.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const fetchMissingDataCount = useCallback(async () => {
    try {
      if (!accountId || !companyId) {
        setMissingDataCount(0);
        return;
      }
      
      const query = supabase
        .from('veiculo')
        .select('veiculo_id')
        .eq('status_veiculo', true)
        .is('motorista_id', null)
        .eq('company_id', companyId);

      // Add the missing data conditions
      query.or('tipologia.is.null,peso.is.null,cubagem.is.null');

      const { data, error } = await query;

      if (error) throw error;
      setMissingDataCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching missing data count:', error);
      setMissingDataCount(0);
    }
  }, [accountId, companyId]);

  const tabs = [
    { path: '/veiculos/agregados', icon: Truck, label: 'Veículos de Agregados' },
    { 
      path: '/veiculos/empresa', 
      icon: Building2, 
      label: 'Veículos Próprios'
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Veículos</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700 relative">
          <div 
            ref={tabsContainerRef} 
            className="overflow-x-auto scrollbar-hide"
          >
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
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
                  <span className="relative">
                    {tab.label}
                  </span>
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
            <Route index element={<Navigate to="/veiculos/agregados" replace />} />
            <Route path="agregados" element={<VeiculosAgregados />} />
            <Route path="empresa" element={<VeiculosEmpresa />} />
            <Route path="infinito" element={<Navigate to="/veiculos/empresa" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Veiculos;