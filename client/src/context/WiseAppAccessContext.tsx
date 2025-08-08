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
  const [token, setToken] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [attendantId, setAttendantId] = useState<number | null>(null);
  const [attendantName, setAttendantName] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const verificarAcesso = async () => {
      // Check if token exists in localStorage
      const storedToken = localStorage.getItem('wiseapp_token');
      const storedAttendantId = localStorage.getItem('attendant_id');
      const storedAttendantName = localStorage.getItem('attendant_name');
      
      if (storedToken && storedAttendantId) {
        setToken(storedToken);
        setAttendantId(parseInt(storedAttendantId));
        setAttendantName(storedAttendantName);
        setIsLoading(false);
        return;
      }

      let accountId = searchParams.get('account_id')?.trim();
      if (!accountId) {
        accountId = localStorage.getItem('account_id') ?? '123456'; // Default for migration
      }
      if (!accountId) {
        setIsLoading(false);
        return;
      }

      try {
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
            setToken(access.access_token_wiseapp);
            setAttendantId(access.wiseapp_acesso_id);
            setAttendantName(access.nome);
            localStorage.setItem('wiseapp_token', access.access_token_wiseapp);
            localStorage.setItem('attendant_id', access.wiseapp_acesso_id.toString());
            localStorage.setItem('attendant_name', access.nome || '');
          } else {
            // No token found, show modal
            setShowModal(true);
          }
        }
      } catch (error) {
        console.error('Error verifying access:', error);
      } finally {
        setIsLoading(false);
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
        onTokenSaved={(newToken) => {
          setToken(newToken);
          setShowModal(false);
        }}
        companyId={companyId}
      />
    </WiseAppAccessContext.Provider>
  );
};

export const useWiseAppAccess = () => useContext(WiseAppAccessContext);

export { WiseAppAccessContext };