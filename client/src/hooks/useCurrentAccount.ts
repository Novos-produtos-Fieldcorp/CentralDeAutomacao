import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { useAuth } from '../context/AuthContext';

interface CurrentAccountData {
  accountId: string | null;
  companyId: number | null;
  isReady: boolean;
  isLoading: boolean;
}

export const useCurrentAccount = (): CurrentAccountData => {
  const wiseAppAccess = useWiseAppAccess();
  const auth = useAuth();
  
  // WiseAppAccess is the authoritative source when available
  // Only fall back to Auth after WiseApp has finished loading AND has no data
  const wiseAppIsLoaded = !wiseAppAccess.isLoading;
  const hasWiseAppData = !!wiseAppAccess.accountId || !!wiseAppAccess.companyId;
  
  // Use WiseApp data if it's loaded and has data, otherwise fall back to Auth
  const accountId = hasWiseAppData 
    ? wiseAppAccess.accountId 
    : (wiseAppIsLoaded ? auth.accountId : null);
    
  const companyId = hasWiseAppData 
    ? wiseAppAccess.companyId 
    : (wiseAppIsLoaded ? auth.companyId : null);
  
  // Only ready when WiseApp has loaded AND we have both accountId and companyId
  const isReady = wiseAppIsLoaded && !!accountId && !!companyId;
  const isLoading = wiseAppAccess.isLoading;
  
  return {
    accountId: accountId ?? null,
    companyId: companyId ?? null,
    isReady,
    isLoading
  };
};

export const getAccountQueryKey = (baseKey: string | string[], accountId: string | null): (string | null)[] => {
  const keys = Array.isArray(baseKey) ? baseKey : [baseKey];
  return [...keys, accountId];
};
