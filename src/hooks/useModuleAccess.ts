import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface ModuleAccess {
  checklist: boolean;
  motoristas: boolean;
  hodometros: boolean;
  veiculos: boolean;
  clientes: boolean;
}

export const useModuleAccess = () => {
  const { companyId, accountId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess>({
    checklist: true,
    motoristas: true,
    hodometros: true,
    veiculos: true,
    clientes: true
  });

  useEffect(() => {
    const checkAccess = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);

        // Use supabase directly to avoid circular dependency with useCompanyData
        const { data: company, error: companyError } = await supabase
          .from('company')
          .select('checklist_access, motorista_access, hodometro_acsess')
          .eq('company_id', companyId)
          .maybeSingle();

        if (companyError) {
          console.error('Error fetching company:', companyError);
          // Default to all modules enabled if we can't fetch company data
          setModuleAccess({
            checklist: true,
            motoristas: true,
            hodometros: true,
            veiculos: true,
            clientes: true
          });
          return;
        }

        if (company) {
          setModuleAccess({
            checklist: company.checklist_access || false,
            motoristas: company.motorista_access || false,
            hodometros: company.hodometro_acsess || false, // Note the typo in the column name
            veiculos: true, // Always enabled
            clientes: true  // Always enabled
          });
        } else {
          // Default to all modules enabled if company data doesn't exist
          setModuleAccess({
            checklist: true,
            motoristas: true,
            hodometros: true,
            veiculos: true,
            clientes: true
          });
        }
      } catch (error) {
        console.error('Error checking module access:', error);
        // Don't show error toast to user, just log to console
        // Default to all modules enabled on error
        setModuleAccess({
          checklist: true,
          motoristas: true,
          hodometros: true,
          veiculos: true,
          clientes: true
        });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [companyId]);

  return { loading, moduleAccess };
};