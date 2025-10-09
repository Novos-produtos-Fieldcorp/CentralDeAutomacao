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
      // Error loading cached token
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
      // Error loading cached company
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
      // Error loading cached attendant
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
      // Error loading cached attendant name
    }
    return null;
  });
  
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedToken, setHasCheckedToken] = useState(false);
  const [searchParams] = useSearchParams();

  // Helper function to cache data with expiration
  const cacheData = (key: string, data: any, expirationHours: number = 1) => { // Reduzir para 1 hora
    try {
      const cache = {
        ...data,
        expiresAt: Date.now() + (expirationHours * 60 * 60 * 1000) // 1 hour default
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

  // Helper function to validate token and clear if expired
  const validateToken = () => {
    try {
      const cached = localStorage.getItem('wiseapp_token_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isExpired = Date.now() > parsed.expiresAt;
        if (isExpired) {
          console.log('Token WiseApp expirado, limpando cache...');
          clearCache();
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      clearCache();
      return false;
    }
  };

  // Helper function to clear all cached data
  const clearCache = () => {
    try {
      localStorage.removeItem('wiseapp_token_cache');
      localStorage.removeItem('wiseapp_company_cache');
      localStorage.removeItem('wiseapp_attendant_cache');
      setToken(null);
      setCompanyId(null);
      setAttendantId(null);
      setAttendantName(null);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  useEffect(() => {
    const verificarAcesso = async () => {
      console.log('🔍 [WiseAppAccess] Iniciando verificação de acesso...');
      
      // Don't check again if we already checked in this session
      if (hasCheckedToken) {
        console.log('🔍 [WiseAppAccess] Já verificado nesta sessão, validando token...');
        // Validar token antes de finalizar
        if (token && !validateToken()) {
          console.log('❌ [WiseAppAccess] Token expirado, mostrando modal');
          setShowModal(true);
        }
        setIsLoading(false);
        return;
      }

      let accountId = searchParams.get('account_id')?.trim();
      console.log('🔍 [WiseAppAccess] Account ID da URL:', accountId);
      
      if (!accountId) {
        // Get from localStorage if available
        try {
          accountId = localStorage?.getItem('account_id');
          console.log('🔍 [WiseAppAccess] Account ID do localStorage:', accountId);
        } catch {
          accountId = null;
        }
      }
      
      if (!accountId) {
        console.error('❌ [WiseAppAccess] Account ID não encontrado, mostrando modal');
        setShowModal(true);
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
              // Using cached WiseApp token and data
              setToken(tokenData.token);
              setCompanyId(companyData.companyId);
              setAttendantId(attendantData.attendantId);
              setAttendantName(attendantData.attendantName);
              useCache = true;
            }
          } catch (cacheError) {
            // Error reading cache, fetching fresh data
          }
        }
        
        if (!useCache) {
          console.log('🔍 [WiseAppAccess] Buscando dados frescos do banco...');
          
          // Fetching fresh WiseApp token from database
          
          // Get company ID from account ID
          console.log('🔍 [WiseAppAccess] Buscando empresa com id_conta_wiseapp:', accountId);
          
          const { data: company, error: companyError } = await supabase
            .from('company')
            .select('company_id')
            .eq('id_conta_wiseapp', accountId)
            .single();

          console.log('📊 [WiseAppAccess] Resultado da busca da empresa:', {
            error: companyError,
            data: company
          });

          if (companyError) {
            console.error('❌ [WiseAppAccess] Erro ao buscar empresa:', companyError);
            setIsLoading(false);
            return;
          }

          if (company) {
            console.log('✅ [WiseAppAccess] Empresa encontrada:', company);
            setCompanyId(company.company_id);
            
            // Cache company data
            cacheData('wiseapp_company_cache', { companyId: company.company_id });
            
            // Check if there's a token for this company
            console.log('🔍 [WiseAppAccess] Buscando token para company_id:', company.company_id);
            
            const { data: access, error: accessError } = await supabase
              .from('wiseapp_acesso')
              .select('wiseapp_acesso_id, access_token_wiseapp, nome, email')
              .eq('company_id', company.company_id)
              .maybeSingle();

            console.log('📊 [WiseAppAccess] Resultado da busca:', {
              error: accessError,
              data: access,
              has_token: !!access?.access_token_wiseapp
            });

            if (accessError && accessError.code !== 'PGRST116') {
              console.error('❌ [WiseAppAccess] Erro ao buscar token:', accessError);
            }

            if (access && access.access_token_wiseapp) {
              console.log('✅ [WiseAppAccess] Token encontrado:', {
                email: access.email,
                nome: access.nome,
                token_length: access.access_token_wiseapp.length
              });
              updateToken(access.access_token_wiseapp, access.wiseapp_acesso_id, access.nome);
              // WiseApp token fetched and cached successfully
            } else {
              console.log('❌ [WiseAppAccess] Nenhum token encontrado no banco, verificando cache...');
              
              // Check if we have a valid cached token that could be saved to database
              try {
                const cachedToken = localStorage.getItem('wiseapp_token_cache');
                console.log('🔍 [WiseAppAccess] Token em cache:', cachedToken ? 'Encontrado' : 'Não encontrado');
                
                if (cachedToken) {
                  const tokenData = JSON.parse(cachedToken);
                  const isTokenValid = Date.now() < tokenData.expiresAt;
                  
                  if (isTokenValid && tokenData.token) {
                    // Found valid cached token, saving to database
                    
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
                        // Cached token successfully saved to database
                        return; // Don't show modal, we're done
                      }
                    } else {
                      console.error('Error saving cached token to database:', insertError);
                    }
                  }
                }
              } catch (cacheError) {
                // Error processing cached token
              }
              
              // No token found and couldn't save cached token, show modal
              console.log('❌ [WiseAppAccess] Nenhum token válido encontrado, mostrando modal de autenticação');
              setShowModal(true);
            }
          } else {
            console.log('❌ [WiseAppAccess] Empresa não encontrada para Account ID:', accountId);
            setShowModal(true);
          }
        }
      } catch (error) {
        console.error('❌ [WiseAppAccess] Erro na verificação:', error);
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