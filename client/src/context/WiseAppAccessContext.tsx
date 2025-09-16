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
  // Initialize from localStorage if available
  const [token, setToken] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem('wiseapp_token_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isExpired = Date.now() > parsed.expiresAt;
        if (!isExpired) {
          return parsed.token;
        }
      }
    } catch (error) {
      console.log('Error loading cached token:', error);
    }
    return null;
  });
  
  const [companyId, setCompanyId] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem('wiseapp_company_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isExpired = Date.now() > parsed.expiresAt;
        if (!isExpired) {
          return parsed.companyId;
        }
      }
    } catch (error) {
      console.log('Error loading cached company:', error);
    }
    return null;
  });
  
  const [attendantId, setAttendantId] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem('wiseapp_attendant_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isExpired = Date.now() > parsed.expiresAt;
        if (!isExpired) {
          return parsed.attendantId;
        }
      }
    } catch (error) {
      console.log('Error loading cached attendant:', error);
    }
    return null;
  });
  
  const [attendantName, setAttendantName] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem('wiseapp_attendant_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isExpired = Date.now() > parsed.expiresAt;
        if (!isExpired) {
          return parsed.attendantName;
        }
      }
    } catch (error) {
      console.log('Error loading cached attendant name:', error);
    }
    return null;
  });
  
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
          accountId = localStorage?.getItem('account_id');
        } catch {
          accountId = null;
        }
      }
      if (!accountId) {
        setIsLoading(false);
        setHasCheckedToken(true);
        return;
      }

      try {
        // Check if we have valid cached data first
        const cachedToken = localStorage.getItem('wiseapp_token_cache');
        const cachedCompany = localStorage.getItem('wiseapp_company_cache');
        const cachedAttendant = localStorage.getItem('wiseapp_attendant_cache');
        
        let useCache = false;
        
        if (cachedToken && cachedCompany && cachedAttendant) {
          try {
            const tokenData = JSON.parse(cachedToken);
            const companyData = JSON.parse(cachedCompany);
            const attendantData = JSON.parse(cachedAttendant);
            
            const isTokenValid = Date.now() < tokenData.expiresAt;
            const isCompanyValid = Date.now() < companyData.expiresAt;
            const isAttendantValid = Date.now() < attendantData.expiresAt;
            
            if (isTokenValid && isCompanyValid && isAttendantValid) {
              console.log('Using cached WiseApp token and data');
              setToken(tokenData.token);
              setCompanyId(companyData.companyId);
              setAttendantId(attendantData.attendantId);
              setAttendantName(attendantData.attendantName);
              useCache = true;
            }
          } catch (cacheError) {
            console.log('Error reading cache, will fetch fresh data:', cacheError);
          }
        }
        
        if (!useCache) {
          console.log('Fetching fresh WiseApp token from database');
          
          // Get company ID from account ID
          const { data: company, error: companyError } = await supabase
            .from('company')
            .select('company_id')
            .eq('id_conta_wiseapp', accountId)
            .single();

          if (companyError) {
            console.error('Error fetching company:', companyError);
            setIsLoading(false);
            return;
          }

          if (company) {
            setCompanyId(company.company_id);
            
            // Cache company data
            cacheData('wiseapp_company_cache', { companyId: company.company_id });
            
            // Check if there's a token for this company
            const { data: access, error: accessError } = await supabase
              .from('wiseapp_acesso')
              .select('wiseapp_acesso_id, access_token_wiseapp, nome')
              .eq('company_id', company.company_id)
              .maybeSingle();

            if (accessError && accessError.code !== 'PGRST116') {
              console.error('Error fetching access token:', accessError);
            }

            if (access && access.access_token_wiseapp) {
              updateToken(access.access_token_wiseapp, access.wiseapp_acesso_id, access.nome);
              console.log('WiseApp token fetched and cached successfully');
            } else {
              // Check if we have a valid cached token that could be saved to database
              try {
                const cachedToken = localStorage.getItem('wiseapp_token_cache');
                if (cachedToken) {
                  const tokenData = JSON.parse(cachedToken);
                  const isTokenValid = Date.now() < tokenData.expiresAt;
                  
                  if (isTokenValid && tokenData.token) {
                    console.log('Found valid cached token, saving to database...');
                    
                    // Try to save the cached token to database
                    const { error: insertError } = await supabase
                      .from('wiseapp_acesso')
                      .insert([{ 
                        email: 'auto@sistema.com', 
                        nome: 'Token Automático', 
                        company_id: company.company_id, 
                        id_conta_wiseapp: accountId, 
                        access_token_wiseapp: tokenData.token 
                      }]);
                    
                    if (!insertError) {
                      // Successfully saved, now fetch it back to get the ID
                      const { data: newAccess } = await supabase
                        .from('wiseapp_acesso')
                        .select('wiseapp_acesso_id, access_token_wiseapp, nome')
                        .eq('company_id', company.company_id)
                        .eq('access_token_wiseapp', tokenData.token)
                        .single();
                      
                      if (newAccess) {
                        updateToken(newAccess.access_token_wiseapp, newAccess.wiseapp_acesso_id, newAccess.nome);
                        console.log('Cached token successfully saved to database and loaded');
                        return; // Don't show modal, we're done
                      }
                    } else {
                      console.error('Error saving cached token to database:', insertError);
                    }
                  }
                }
              } catch (cacheError) {
                console.log('Error processing cached token:', cacheError);
              }
              
              // No token found and couldn't save cached token, show modal
              setShowModal(true);
            }
          }
        }
      } catch (error) {
        console.error('Error verifying access:', error);
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
        onTokenSaved={(newToken, attendantId, attendantName) => {
          updateToken(newToken, attendantId || 0, attendantName || 'Atendente');
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