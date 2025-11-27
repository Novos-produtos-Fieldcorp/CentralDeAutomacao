import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WiseAppTokenModal from '../components/WiseAppTokenModal';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';

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
  const { updateCompanyFromSession, companyId: authCompanyId } = useAuth();
  const queryClient = useQueryClient();
  
  // Helper to check if session data is valid (not expired)
  const getValidSessionData = () => {
    try {
      const cached = localStorage.getItem('wiseapp_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isExpired = Date.now() > parsed.expiresAt;
        if (!isExpired) {
          return parsed;
        }
      }
    } catch (error) {
      // Error loading cached session
    }
    return null;
  };
  
  const validSession = getValidSessionData();
  
  const [token, setToken] = useState<string | null>(validSession?.token || null);
  const [companyId, setCompanyId] = useState<number | null>(validSession?.companyId || null);
  const [attendantId, setAttendantId] = useState<number | null>(validSession?.attendantId || null);
  const [attendantName, setAttendantName] = useState<string | null>(validSession?.attendantName || null);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(validSession?.email || null);
  
  const [showModal, setShowModal] = useState(false);
  const [canCloseModal, setCanCloseModal] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedToken, setHasCheckedToken] = useState(false);
  const [searchParams] = useSearchParams();

  // Helper function to save session data with expiration (1 hour default)
  const saveSession = (data: {
    token: string;
    email: string;
    companyId: number;
    attendantId: number;
    attendantName: string;
    accountId?: string;
  }, expirationHours: number = 1) => {
    try {
      const session = {
        ...data,
        expiresAt: Date.now() + (expirationHours * 60 * 60 * 1000)
      };
      localStorage.setItem('wiseapp_session', JSON.stringify(session));
      
      // Also save account_id separately for URL-less access
      if (data.accountId) {
        localStorage.setItem('account_id', data.accountId);
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  // Helper function to update state and cache after successful authentication
  const updateSession = (
    newToken: string, 
    newEmail: string,
    newCompanyId: number,
    newAttendantId: number, 
    newAttendantName: string, 
    accountIdToSave?: string
  ) => {
    console.log('🔄 [WiseAppAccess] Atualizando sessão:', { 
      email: newEmail, 
      companyId: newCompanyId,
      previousCompanyId: companyId,
      authCompanyId 
    });
    
    // Check if company changed - need to invalidate all queries
    const companyChanged = authCompanyId && authCompanyId !== newCompanyId;
    
    setToken(newToken);
    setAuthenticatedEmail(newEmail);
    setCompanyId(newCompanyId);
    setAttendantId(newAttendantId);
    setAttendantName(newAttendantName);
    
    saveSession({
      token: newToken,
      email: newEmail,
      companyId: newCompanyId,
      attendantId: newAttendantId,
      attendantName: newAttendantName,
      accountId: accountIdToSave
    });
    
    // CRITICAL: Sync companyId with AuthContext
    console.log('🔄 [WiseAppAccess] Sincronizando companyId com AuthContext:', newCompanyId);
    updateCompanyFromSession(newCompanyId, accountIdToSave);
    
    // If company changed, invalidate ALL queries to force refetch with new companyId
    if (companyChanged) {
      console.log('🔄 [WiseAppAccess] Empresa mudou! Invalidando todas as queries...');
      queryClient.invalidateQueries();
    }
  };

  // Helper function to validate session
  const isSessionValid = () => {
    const session = getValidSessionData();
    return session && session.token && session.email;
  };

  // Helper function to clear all session data
  const clearSession = () => {
    try {
      localStorage.removeItem('wiseapp_session');
      localStorage.removeItem('wiseapp_token_cache');
      localStorage.removeItem('wiseapp_company_cache');
      localStorage.removeItem('wiseapp_attendant_cache');
      setToken(null);
      setAuthenticatedEmail(null);
      setCompanyId(null);
      setAttendantId(null);
      setAttendantName(null);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  useEffect(() => {
    const verificarAcesso = async () => {
      console.log('🔍 [WiseAppAccess] Iniciando verificação de acesso...');
      
      // Check for valid session first (user already authenticated with email)
      if (hasCheckedToken) {
        console.log('🔍 [WiseAppAccess] Já verificado nesta sessão...');
        
        // Only skip authentication if we have BOTH valid session AND authenticated email
        if (isSessionValid() && authenticatedEmail) {
          console.log('✅ [WiseAppAccess] Sessão válida com email:', authenticatedEmail);
          setIsLoading(false);
          return;
        }
        
        // Session invalid or no email - show modal
        console.log('❌ [WiseAppAccess] Sessão inválida ou sem email autenticado, mostrando modal');
        setShowModal(true);
        setCanCloseModal(false);
        setIsLoading(false);
        return;
      }

      // Get account_id from URL or localStorage
      let accountId = searchParams.get('account_id')?.trim();
      console.log('🔍 [WiseAppAccess] Account ID da URL:', accountId);
      
      if (!accountId) {
        try {
          accountId = localStorage?.getItem('account_id') ?? undefined;
          console.log('🔍 [WiseAppAccess] Account ID do localStorage:', accountId);
        } catch {
          accountId = undefined;
        }
      }
      
      // Save account_id for future use
      if (accountId) {
        try {
          localStorage.setItem('account_id', accountId);
        } catch {
          // Ignore storage errors
        }
      }
      
      if (!accountId) {
        console.error('❌ [WiseAppAccess] Account ID não encontrado, mostrando modal');
        setShowModal(true);
        setCanCloseModal(false);
        setIsLoading(false);
        setHasCheckedToken(true);
        return;
      }

      try {
        // Check if we have a valid session with authenticated email
        const session = getValidSessionData();
        
        if (session && session.email && session.token) {
          console.log('✅ [WiseAppAccess] Sessão válida encontrada para:', session.email);
          setToken(session.token);
          setAuthenticatedEmail(session.email);
          setCompanyId(session.companyId);
          setAttendantId(session.attendantId);
          setAttendantName(session.attendantName);
          
          // CRITICAL: Sync companyId with AuthContext from cached session
          if (session.companyId) {
            console.log('🔄 [WiseAppAccess] Sincronizando companyId do cache com AuthContext:', session.companyId);
            updateCompanyFromSession(session.companyId, accountId);
            
            // If AuthContext has different company, invalidate queries
            if (authCompanyId && authCompanyId !== session.companyId) {
              console.log('🔄 [WiseAppAccess] CompanyId do cache diferente do AuthContext, invalidando queries...');
              queryClient.invalidateQueries();
            }
          }
          
          setShowModal(false);
          setIsLoading(false);
          setHasCheckedToken(true);
          return;
        }
        
        // No valid session - need to fetch company info and show authentication modal
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
          setShowModal(true);
          setCanCloseModal(false);
          setIsLoading(false);
          setHasCheckedToken(true);
          return;
        }

        if (company) {
          console.log('✅ [WiseAppAccess] Empresa encontrada:', company);
          setCompanyId(company.company_id);
          
          // ALWAYS show authentication modal - user must provide email
          console.log('📧 [WiseAppAccess] Mostrando modal de autenticação (e-mail obrigatório)');
          setShowModal(true);
          setCanCloseModal(false);
        } else {
          console.log('❌ [WiseAppAccess] Empresa não encontrada para Account ID:', accountId);
          setShowModal(true);
          setCanCloseModal(false);
        }
      } catch (error) {
        console.error('❌ [WiseAppAccess] Erro na verificação:', error);
        setShowModal(true);
        setCanCloseModal(false);
      } finally {
        setIsLoading(false);
        setHasCheckedToken(true);
      }
    };

    verificarAcesso();
  }, [searchParams, authenticatedEmail]);

  return (
    <WiseAppAccessContext.Provider value={{ token, companyId, attendantId, attendantName, isLoading }}>
      {children}
      <WiseAppTokenModal
        open={showModal}
        onClose={() => canCloseModal && setShowModal(false)}
        onTokenSaved={(newToken, newAttendantId, newAttendantName, email) => {
          const accountId = searchParams.get('account_id')?.trim() || localStorage?.getItem('account_id') || '';
          updateSession(
            newToken, 
            email || '', 
            companyId || 0, 
            newAttendantId || 0, 
            newAttendantName || 'Atendente',
            accountId
          );
          setShowModal(false);
          setCanCloseModal(true);
          setHasCheckedToken(true);
        }}
        companyId={companyId}
        isDismissible={canCloseModal}
      />
    </WiseAppAccessContext.Provider>
  );
};

export const useWiseAppAccess = () => useContext(WiseAppAccessContext);

export { WiseAppAccessContext };
