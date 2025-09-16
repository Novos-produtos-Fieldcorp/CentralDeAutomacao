import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WiseAppTokenModal from '../components/WiseAppTokenModal';
import { useSearchParams } from 'react-router-dom';

interface WiseAppAccessContextType {
  token: string | null;
  companyId: number | null;
  attendantId: number | null;
  attendantName: string | null;
  isLoading: boolean;
}

const WiseAppAccessContext = createContext<WiseAppAccessContextType>({
  token: null,
  companyId: null,
  attendantId: null,
  attendantName: null,
  isLoading: true,
});

export const WiseAppAccessProvider = ({ children }: { children: React.ReactNode }) => {
  // Clear stale cache if there's a mismatch between cache and database
  const clearStaleCache = () => {
    console.log('Clearing stale WiseApp cache due to authentication mismatch');
    localStorage.removeItem('wiseapp_token_cache');
    localStorage.removeItem('wiseapp_company_cache');
    localStorage.removeItem('wiseapp_attendant_cache');
  };

  // Initialize token state - don't use cache initially, validate against backend first
  const [token, setToken] = useState<string | null>(null);
  
  // Initialize all states as null - will be populated from database verification
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [attendantId, setAttendantId] = useState<number | null>(null);
  const [attendantName, setAttendantName] = useState<string | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedToken, setHasCheckedToken] = useState(false);
  const [searchParams] = useSearchParams();

  // Helper function to cache data with expiration
  const cacheData = (key: string, data: any, expirationHours: number = 2) => {
    try {
      const cache = {
        ...data,
        expiresAt: Date.now() + (expirationHours * 60 * 60 * 1000) // 2 hours default
      };
      localStorage.setItem(key, JSON.stringify(cache));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  };

  // Helper function to update token and cache
  const updateToken = (newToken: string, newAttendantId: number, newAttendantName: string) => {
    setToken(newToken);
    setAttendantId(newAttendantId);
    setAttendantName(newAttendantName);
    
    // Cache the token and attendant info
    cacheData('wiseapp_token_cache', { token: newToken });
    cacheData('wiseapp_attendant_cache', { 
      attendantId: newAttendantId, 
      attendantName: newAttendantName 
    });
  };

  useEffect(() => {
    const verificarAcesso = async () => {
      // Don't check again if we already checked in this session
      if (hasCheckedToken) {
        setIsLoading(false);
        return;
      }

      let accountId = searchParams.get('account_id')?.trim();
      if (!accountId) {
        // Get from localStorage if available
        try {
          accountId = localStorage?.getItem('account_id') || undefined;
        } catch {
          accountId = undefined;
        }
      }
      if (!accountId) {
        console.log('No account_id found - showing modal for token configuration');
        setShowModal(true);
        setIsLoading(false);
        setHasCheckedToken(true);
        return;
      }

      // Store account_id for future use
      localStorage.setItem('account_id', accountId);

      try {
        console.log('Fetching fresh WiseApp token from database for account_id:', accountId);
        
        // Get company ID from account ID
        const { data: company, error: companyError } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .single();

        if (companyError) {
          console.error('Error fetching company:', companyError);
          clearStaleCache();
          setShowModal(true);
          setIsLoading(false);
          setHasCheckedToken(true);
          return;
        }

        if (company) {
          console.log('Found company_id:', company.company_id);
          setCompanyId(company.company_id);
          
          // Check if there's a valid token for this company in database
          const { data: access, error: accessError } = await supabase
            .from('wiseapp_acesso')
            .select('wiseapp_acesso_id, access_token_wiseapp, nome')
            .eq('company_id', company.company_id)
            .not('access_token_wiseapp', 'is', null)
            .maybeSingle();

          if (accessError && accessError.code !== 'PGRST116') {
            console.error('Error fetching access token:', accessError);
          }

          if (access && access.access_token_wiseapp) {
            console.log('Found valid WiseApp token in database');
            setToken(access.access_token_wiseapp);
            setAttendantId(access.wiseapp_acesso_id);
            setAttendantName(access.nome);
            
            // Now cache the valid data
            cacheData('wiseapp_token_cache', { token: access.access_token_wiseapp });
            cacheData('wiseapp_company_cache', { companyId: company.company_id });
            cacheData('wiseapp_attendant_cache', { 
              attendantId: access.wiseapp_acesso_id, 
              attendantName: access.nome 
            });
            
            console.log('WiseApp token loaded and cached successfully');
          } else {
            console.log('No WiseApp token found in database - showing configuration modal');
            // Clear any stale cache since database has no token
            clearStaleCache();
            setShowModal(true);
          }
        }
      } catch (error) {
        console.error('Error verifying access:', error);
        clearStaleCache();
        setShowModal(true);
      } finally {
        setIsLoading(false);
        setHasCheckedToken(true);
      }
    };

    verificarAcesso();
  }, [searchParams]);

  return (
    <WiseAppAccessContext.Provider value={{ token, companyId, attendantId, attendantName, isLoading }}>
      {children}
      <WiseAppTokenModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onTokenSaved={async (newToken: string) => {
          // Token was saved to database by modal, now fetch fresh data
          console.log('Token saved, fetching fresh data from database');
          
          // Clear all cache first
          localStorage.removeItem('wiseapp_token_cache');
          localStorage.removeItem('wiseapp_company_cache');
          localStorage.removeItem('wiseapp_attendant_cache');
          
          if (companyId) {
            try {
              // Fetch the updated token info from database
              const { data: access, error: accessError } = await supabase
                .from('wiseapp_acesso')
                .select('wiseapp_acesso_id, access_token_wiseapp, nome')
                .eq('company_id', companyId)
                .not('access_token_wiseapp', 'is', null)
                .maybeSingle();

              if (access && access.access_token_wiseapp) {
                console.log('Fresh token loaded from database successfully');
                setToken(access.access_token_wiseapp);
                setAttendantId(access.wiseapp_acesso_id);
                setAttendantName(access.nome);
                
                // Cache the fresh data
                cacheData('wiseapp_token_cache', { token: access.access_token_wiseapp });
                cacheData('wiseapp_attendant_cache', { 
                  attendantId: access.wiseapp_acesso_id, 
                  attendantName: access.nome 
                });
              }
            } catch (error) {
              console.error('Error fetching fresh token:', error);
            }
          }
          
          setShowModal(false);
          setHasCheckedToken(true);
        }}
        companyId={companyId}
      />
    </WiseAppAccessContext.Provider>
  );
};

export const useWiseAppAccess = () => useContext(WiseAppAccessContext);

export { WiseAppAccessContext };