import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { useAuth } from '../context/AuthContext';

interface CurrentAccountData {
  accountId: string | null;
  companyId: number | null;
  isReady: boolean;
}

export const useCurrentAccount = (): CurrentAccountData => {
  const wiseAppAccess = useWiseAppAccess();
  const auth = useAuth();
  
  const accountId = wiseAppAccess.accountId || auth.accountId || null;
  const companyId = wiseAppAccess.companyId || auth.companyId || null;
  
  const isReady = !wiseAppAccess.isLoading && (!!accountId || !!companyId);
  
  return {
    accountId,
    companyId,
    isReady
  };
};

export const getAccountQueryKey = (baseKey: string | string[], accountId: string | null): (string | null)[] => {
  const keys = Array.isArray(baseKey) ? baseKey : [baseKey];
  return [...keys, accountId];
};
