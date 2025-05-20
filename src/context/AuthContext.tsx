import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';

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
          currentAccountId = localStorage.getItem('account_id');
        }

        // If still no account_id, redirect to unauthorized
        if (!currentAccountId || currentAccountId === 'null' || currentAccountId === 'undefined') {
          console.log('No valid account ID found');
          setIsAuthenticated(false);
          setAccountId(undefined);
          navigate('/unauthorized');
          return;
        }

        // Store account_id in localStorage
        if (currentAccountId) {
          localStorage.setItem('account_id', currentAccountId);
        }
        
        setAccountId(currentAccountId);
        console.log('Checking company for account ID:', currentAccountId);

        try {
          // Find company by account ID
          const { data: company, error } = await supabase
            .from('company')
            .select('company_id, st_company, checklist_access, motorista_access, hodometro_acsess')
            .eq('id_conta_wiseapp', currentAccountId)
            .single();

          if (error) {
            console.error('Supabase error:', error);
            throw new Error(`Failed to fetch company data: ${error.message}`);
          }

          if (!company) {
            console.error('No company found for account ID:', currentAccountId);
            throw new Error('No company found for this account');
          }

          const isValid = company.st_company === true;
          console.log('Company status:', isValid);

          // Update authentication state
          setIsAuthenticated(isValid);
          setCompanyId(company.company_id);

          if (!isValid) {
            console.log('Company is not active');
            localStorage.removeItem('account_id');
            setAccountId(undefined);
            navigate('/unauthorized');
          }
        } catch (fetchError) {
          console.error('Failed to fetch company data:', fetchError);
          throw new Error('Failed to authenticate with Supabase');
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