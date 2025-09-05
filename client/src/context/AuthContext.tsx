import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-fixed';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCompanyByAccountId } from '../lib/directApiService';

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
  // Initialize with values from localStorage if available
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const saved = localStorage.getItem('isAuthenticated');
    return saved === 'true';
  });
  const [companyId, setCompanyId] = useState<number | undefined>(() => {
    const saved = localStorage.getItem('companyId');
    return saved ? parseInt(saved) : undefined;
  });
  const [accountId, setAccountId] = useState<string | undefined>(() => {
    return localStorage.getItem('account_id') || undefined;
  });
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

        // If no account_id, user needs to provide one
        if (!currentAccountId || currentAccountId === 'null' || currentAccountId === 'undefined') {
          console.log('No account_id provided - user must specify one in URL');
          setIsLoading(false);
          navigate('/unauthorized');
          return;
        }

        // Store account_id in localStorage
        if (currentAccountId) {
          localStorage.setItem('account_id', currentAccountId);
        }
        
        setAccountId(currentAccountId);

        // Check if we already have valid cached data
        const cachedAuth = localStorage.getItem('isAuthenticated') === 'true';
        const cachedCompanyId = localStorage.getItem('companyId');
        const cachedAccountId = localStorage.getItem('account_id');
        
        // If we have cached auth data and the account_id matches, use it
        if (cachedAuth && cachedCompanyId && cachedAccountId === currentAccountId) {
          setIsAuthenticated(true);
          setCompanyId(parseInt(cachedCompanyId));
          console.log('Using cached auth - account_id:', currentAccountId, 'company_id:', cachedCompanyId);
          setIsLoading(false);
          return;
        }

        try {
          // Buscar a empresa real baseada no account_id usando Supabase direto
          console.log('Fetching company data for account_id:', currentAccountId);
          const companyData = await getCompanyByAccountId(currentAccountId);
          
          // Update state and cache
          setIsAuthenticated(true);
          setCompanyId(companyData.company_id);
          
          // Save to localStorage for persistence
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('companyId', companyData.company_id.toString());
          localStorage.setItem('companyName', companyData.nome_company || '');
          
          console.log('Auth successful - account_id:', currentAccountId, 'company_id:', companyData.company_id, 'company:', companyData.nome_company);
        } catch (fetchError) {
          console.error('Auth check failed:', fetchError);
          
          // Clear cached data on failure
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('companyId');
          localStorage.removeItem('companyName');
          
          setIsAuthenticated(false);
          navigate('/unauthorized');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        
        // Clear all cached data
        localStorage.removeItem('account_id');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('companyId');
        localStorage.removeItem('companyName');
        
        setAccountId(undefined as string | undefined);
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