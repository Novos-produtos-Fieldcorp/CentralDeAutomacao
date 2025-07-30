import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-fixed';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

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
          // For testing, accept multiple account_ids
          const validAccountIds = ['6', '20', '1', '2', '3', '4', '5']; // Add more as needed
          
          if (validAccountIds.includes(currentAccountId)) {
            setIsAuthenticated(true);
            // Map known account_ids to company_ids
            const accountToCompanyMap: { [key: string]: number } = {
              '6': 1,
              '20': 1, // Assuming account_id 20 also maps to company_id 1 for now
              '1': 1,
              '2': 1,
              '3': 1,
              '4': 1,
              '5': 1
            };
            
            const mappedCompanyId = accountToCompanyMap[currentAccountId] || 1;
            setCompanyId(mappedCompanyId);
            console.log('Auth bypassed for testing - account_id:', currentAccountId, 'company_id:', mappedCompanyId);
          } else {
            console.warn('Unknown account_id:', currentAccountId);
            setIsAuthenticated(false);
            navigate('/unauthorized');
          }
        } catch (fetchError) {
          console.error('Auth check failed:', fetchError);
          // For testing, still allow access with valid account_ids
          const validAccountIds = ['6', '20', '1', '2', '3', '4', '5'];
          if (validAccountIds.includes(currentAccountId)) {
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