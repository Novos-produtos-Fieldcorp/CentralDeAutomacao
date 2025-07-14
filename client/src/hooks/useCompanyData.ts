import { useAuth } from '../context/AuthContext';
import { createFilteredQuery } from '../lib/supabase';

interface UseCompanyDataReturn {
  query: (table: string) => any;
  companyId: number | undefined;
}

export const useCompanyData = () => {
  const { companyId, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    throw new Error('Authentication required');
  }

  const result: UseCompanyDataReturn = {
    query: (table: string) => createFilteredQuery(table, companyId || 0),
    companyId
  };

  return result;
};