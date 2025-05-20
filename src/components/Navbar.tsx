import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Truck, Users, Gauge, ClipboardCheck, Store, Menu, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useCompanyData } from '../hooks/useCompanyData';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const Navbar = () => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const { loading, moduleAccess } = useModuleAccess();
  const { companyId } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const { query } = useCompanyData();

  const fetchCompanyName = useCallback(async () => {
    if (!companyId) return;
    
    try {
      const { data, error } = await supabase
        .from('company')
        .select('nome_company')
        .eq('company_id', companyId)
        .single();

      if (error) throw error;
      if (data) {
        setCompanyName(data.nome_company);
      }
    } catch (error) {
      console.error('Error fetching company name:', error);
      toast.error('Erro ao carregar nome da empresa');
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompanyName();
  }, [fetchCompanyName]);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
    setIsManuallyExpanded(!isExpanded);
  };

  const menuItems = [
    { path: '/', icon: Home, label: 'Menu', isTitle: false, enabled: true },
    { path: '/checklist', icon: ClipboardCheck, label: 'Checklists', needsAccess: true, enabled: moduleAccess.checklist },
    { path: '/motoristas', icon: Users, label: 'Contratações', needsAccess: true, enabled: moduleAccess.motoristas },
    { path: '/veiculos', icon: Truck, label: 'Veículos', needsAccess: false, enabled: moduleAccess.veiculos },
    { path: '/hodometros', icon: Gauge, label: 'Hodômetros', needsAccess: true, enabled: moduleAccess.hodometros },
    { path: '/clientes', icon: Store, label: 'Clientes', needsAccess: false, enabled: moduleAccess.clientes },
  ];

  return (
    <nav 
      className={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 shadow-lg z-50
                  transition-all duration-500 ease
                  ${isExpanded ? 'w-64' : 'w-20'}`}
    >
      <div className="flex flex-col h-full overflow-y-auto smooth-scroll">
        {/* Company Name and Toggle Button */}
        <div className="px-3 py-4">
          <div className="flex justify-between items-center">
            {isExpanded ? (
              <h2 className="w-full flex justify-center">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {companyName}
                </span>
              </h2>
            ) : (
              <div className="w-full flex justify-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {companyName.substring(0, 1).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <div className="px-3 py-2">
          <button 
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? (
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 px-3 pt-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const active = isActive(item.path);
              return item.enabled ? (
                <div key={item.path} className="relative group">
                  {/* Tooltip - only visible when sidebar is collapsed and hovering */}
                  {!isExpanded && (
                    <div className="fixed left-20 ml-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none whitespace-nowrap z-[9999] shadow-md" style={{ top: 'var(--tooltip-y, 50%)', transform: 'translateY(-50%)' }}>
                      {item.label}
                      <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-600 rotate-45"></div>
                    </div>
                  )}
                  
                  <Link
                    to={item.path}
                    className={`group flex items-center h-11 px-3 rounded-lg text-sm font-medium
                              transition-all duration-500 relative
                              ${active 
                                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' 
                                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                              }`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      document.documentElement.style.setProperty('--tooltip-y', `${rect.top + rect.height/2}px`);
                    }}
                  >
                    <div className="flex items-center justify-center w-9 h-9">
                      <item.icon 
                        className={`w-5 h-5 transition-transform duration-500 group-hover:scale-110
                                   ${active 
                                       ? 'text-blue-600 dark:text-blue-400' 
                                      : 'text-gray-400 dark:text-gray-500 transition-colors duration-500 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                   }`} 
                      />
                    </div>
                    <div className={`overflow-hidden transition-all duration-500 ease-in-out flex-1
                                   ${isExpanded ? 'w-full opacity-100' : 'w-0 opacity-0'}`}>
                      <span className={`transition-colors duration-500 ${active ? 'font-medium' : ''}`}>
                        {item.label}
                      </span>
                    </div>
                  </Link>
                </div>
              ) : (
                <div
                  key={item.path}
                  className="group flex items-center h-11 px-3 rounded-lg text-sm font-medium
                            transition-all duration-500 relative cursor-not-allowed opacity-60
                            text-gray-400 dark:text-gray-600 select-none"
                >
                  <div className="flex items-center justify-center w-9 h-9">
                    <item.icon className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                  </div>
                  <div className={`overflow-hidden transition-all duration-500 ease-in-out flex-1
                                 ${isExpanded ? 'w-full opacity-100' : 'w-0 opacity-0'}`}>
                    <span className="text-gray-400 dark:text-gray-600">
                      {item.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Theme Toggle */}
        <div className="p-3 mt-auto">
          <ThemeToggle isExpanded={isExpanded} />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;