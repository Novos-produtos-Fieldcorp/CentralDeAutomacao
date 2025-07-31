import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-fixed';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createApiUrl } from '../lib/api-config';

interface AuthContextType {
  isAuthenticated: boolean;
  companyId?: number;
  isLoading: boolean;
  accountId?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [companyId, setCompanyId] = useState<number>();
  const [accountId, setAccountId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip auth check for admin route
        if (window.location.pathname === '/admin') {
          setIsLoading(false);
          return;
        }
        
        let currentAccountId = searchParams.get('account_id')?.trim();

        // If no account_id in URL, try localStorage
        if (!currentAccountId) {
          currentAccountId = localStorage.getItem('account_id') || undefined;
        }

        // If still no account_id, use default for testing
        if (!currentAccountId || currentAccountId === 'null' || currentAccountId === 'undefined') {
          currentAccountId = '6'; // Default account ID for testing
        }

        // Store account_id in localStorage
        if (currentAccountId) {
          localStorage.setItem('account_id', currentAccountId);
        }
        
        setAccountId(currentAccountId);

        try {
          // Buscar a empresa real baseada no account_id usando URL dinâmica
          const apiUrl = createApiUrl(`company/by-account/${currentAccountId}`);
          console.log('Fetching company data from:', apiUrl);
          const response = await fetch(apiUrl);
          
          if (response.ok) {
            const companyData = await response.json();
            setIsAuthenticated(true);
            setCompanyId(companyData.company_id);
            console.log('Auth successful - account_id:', currentAccountId, 'company_id:', companyData.company_id, 'company:', companyData.nome_company);
          } else {
            console.warn('Company not found for account_id:', currentAccountId, 'Status:', response.status);
            setIsAuthenticated(false);
            navigate('/unauthorized');
          }
        } catch (fetchError) {
          console.error('Auth check failed:', fetchError);
          // Fallback apenas para account_id=6 (para testes de desenvolvimento)
          if (currentAccountId === '6') {
            setIsAuthenticated(true);
            setCompanyId(1);
          } else {
            setIsAuthenticated(false);
            navigate('/unauthorized');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('account_id');
        setAccountId(undefined);
        setIsAuthenticated(false);
        navigate('/unauthorized');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, searchParams]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, companyId, isLoading, accountId }}>
      {children}
    </AuthContext.Provider>
  );
}