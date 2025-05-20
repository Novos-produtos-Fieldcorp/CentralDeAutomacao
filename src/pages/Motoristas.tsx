import React from 'react';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Users, TruckIcon, LayoutDashboard, Kanban, CheckCircle2, Lock, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompanyData } from '../hooks/useCompanyData';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import MotoristasLista from './contratacao/MotoristasLista';
import AgregadosLista from './contratacao/AgregadosLista';
import ContratacaoDashboard from './contratacao/ContratacaoDashboard';
import ContratacaoKanban from './contratacao/ContratacaoKanban';
import Contratados from './contratacao/Contratados';
import MotoristasInfiniteList from './motoristas/MotoristasInfiniteList';
import LoadingSpinner from '../components/LoadingSpinner';

const Motoristas = () => {
  const location = useLocation();
  const { query } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setHasAccess(true); // Always allow access to Motoristas module
      } catch (error) {
        console.error('Error checking access:', error);
        toast.error('Erro ao verificar acesso ao módulo');
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, []);

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
    { path: '/motoristas/lista', icon: Users, label: 'Motoristas' },
    { path: '/motoristas/agregados', icon: TruckIcon, label: 'Agregados' },
    { path: '/motoristas/contratados', icon: CheckCircle2, label: 'Contratados' },
    { path: '/motoristas/kanban', icon: Kanban, label: 'Kanban' },
    { path: '/motoristas/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Contratações</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        {hasAccess ? (<><div className="border-b border-gray-200 dark:border-gray-700 relative">
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
            <Route index element={<Navigate to="/motoristas/lista" replace />} />
            <Route path="lista" element={<MotoristasLista />} />
            <Route path="lista-infinita" element={<Navigate to="/motoristas/lista" replace />} />
            <Route path="agregados" element={<AgregadosLista />} />
            <Route path="contratados" element={<Contratados />} />
            <Route path="kanban" element={<ContratacaoKanban />} />
            <Route path="dashboard" element={<ContratacaoDashboard />} />
          </Routes>
        </div></>) : (
          <div className="p-8 text-center">
            <Users className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              Nenhum Motorista Cadastrado
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Para começar a utilizar o módulo de Contratações, você precisa ter pelo menos um motorista cadastrado.
              Cadastre um motorista para liberar o acesso completo ao módulo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Motoristas;