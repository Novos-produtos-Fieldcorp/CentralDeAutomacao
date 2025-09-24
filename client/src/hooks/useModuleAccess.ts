import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

interface ModuleAccess {
  checklist: boolean;
  motoristas: boolean;
  vagas: boolean;
  hodometros: boolean;
  veiculos: boolean;
  clientes: boolean;
  resumos: boolean;
  tags: boolean;
  comprovantes: boolean;
}

export const useModuleAccess = () => {
  const { companyId, accountId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess>({
    checklist: true,
    motoristas: true,
    vagas: true,
    hodometros: true,
    veiculos: true,
    clientes: true,
    resumos: true,
    tags: true,
    comprovantes: true,
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
          .from("company")
          .select(
            "checklist_access, motorista_access, hodometro_acsess, resumo_access, tags_access",
          )
          .eq("company_id", companyId)
          .maybeSingle();

        if (companyError) {
          console.error("Error fetching company:", companyError);
          // Default to all modules enabled if we can't fetch company data
          setModuleAccess({
            checklist: true,
            motoristas: true,
            vagas: true,
            hodometros: true,
            veiculos: true,
            clientes: true,
            resumos: true,
            tags: true,
            comprovantes: true,
          });
          return;
        }

        if (company) {
          setModuleAccess({
            checklist: company.checklist_access || false,
            motoristas: company.motorista_access || false,
            vagas: true, // Always enabled since column doesn't exist
            hodometros: company.hodometro_acsess || false, // Note the typo in the column name
            veiculos: true, // Always enabled
            clientes: true, // Always enabled
            resumos: company.resumo_access || false,
            tags: company.tags_access || false,
            comprovantes: true,
          });
        } else {
          // Default to all modules enabled if company data doesn't exist
          setModuleAccess({
            checklist: true,
            motoristas: true,
            vagas: true,
            hodometros: true,
            veiculos: true,
            clientes: true,
            resumos: true,
            tags: true,
            comprovantes: true,
          });
        }
      } catch (error) {
        console.error("Error checking module access:", error);
        // Show user-friendly toast notification about connection issues
        toast.error(
          "Erro de conexão ao carregar configurações da empresa. Usando configurações padrão.",
        );
        // Default to all modules enabled on error
        setModuleAccess({
          checklist: true,
          motoristas: true,
          vagas: true,
          hodometros: true,
          veiculos: true,
          clientes: true,
          resumos: true,
          tags: true,
          comprovantes: true,
        });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [companyId]);

  return { loading, moduleAccess };
};
