import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCompanyData } from './useCompanyData';
import toast from 'react-hot-toast';

interface ModuleAccess {
  checklist: boolean;
  motoristas: boolean;
  hodometros: boolean;
  veiculos: boolean;
  clientes: boolean;
}

export const useModuleAccess = () => {
  const { companyId } = useAuth();
  const { query } = useCompanyData();
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

        // Use the centralized query function from useCompanyData for proper error handling
        const company = await query(
          'company',
          {
            select: 'checklist_access, motorista_access, hodometro_acsess',
            filters: [{ column: 'company_id', operator: 'eq', value: companyId }],
            single: true
          }
        );

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
        
        // The centralized error handling in useCompanyData will already show user-friendly messages
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
  }, [companyId, query]);

  return { loading, moduleAccess };
};