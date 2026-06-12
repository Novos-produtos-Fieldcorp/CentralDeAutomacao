import { useState, useEffect } from "react";
import { useCurrentAccount } from "./useCurrentAccount";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

interface ModuleAccess {
  checklist: boolean;
  motoristas: boolean;
  hodometros: boolean;
  minuta: boolean;
  romaneio: boolean;
  veiculos: boolean;
  clientes: boolean;
  resumos: boolean;
  tags: boolean;
  comprovantes: boolean;
  comprovRota: boolean;
  bomba: boolean;
  calculoUmPorDia: boolean;
  bau: boolean;
  operacoes: boolean;
  logs: boolean;
  jpdTransportes: boolean;
  blixxGrupos: boolean;
  painelControleBlixx: boolean;
}

export const useModuleAccess = () => {
  const { companyId, accountId } = useCurrentAccount();
  const [loading, setLoading] = useState(true);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess>({
    checklist: true,
    motoristas: true,
    hodometros: true,
    minuta: true,
    romaneio: false,
    veiculos: true,
    clientes: true,
    resumos: true,
    tags: true,
    comprovantes: true,
    comprovRota: false,
    bomba: false,
    calculoUmPorDia: false,
    bau: false,
    operacoes: false,
    logs: false,
    jpdTransportes: false,
    blixxGrupos: false,
    painelControleBlixx: false,
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
            "checklist_access, motorista_access, hodometro_acsess, minuta_access, romaneio_access, resumo_access, tags_access, comprovante_access, comprov_rota_access, bomba_gasolina_access, calculo_um_por_dia, bau_access, operacoes_access, logs_access, jpd_transportes_access, blixx_grupos_access, painel_controle_blixx_access",
          )
          .eq("company_id", companyId)
          .maybeSingle();

        if (companyError) {
          console.error("Error fetching company:", companyError);
          // Default to all modules enabled if we can't fetch company data
          setModuleAccess({
            checklist: true,
            motoristas: true,
            hodometros: true,
            minuta: true,
            romaneio: false,
            veiculos: true,
            clientes: true,
            resumos: true,
            tags: true,
            comprovantes: true,
            comprovRota: false,
            bomba: false,
            calculoUmPorDia: false,
            bau: false,
            operacoes: false,
            logs: false,
            jpdTransportes: false,
            blixxGrupos: false,
            painelControleBlixx: false,
          });
          return;
        }

        if (company) {
          setModuleAccess({
            checklist: company.checklist_access || false,
            motoristas: company.motorista_access || false,
            hodometros: company.hodometro_acsess || false, // Note the typo in the column name
            minuta: company.minuta_access || false,
            romaneio: company.romaneio_access || false,
            veiculos: true, // Always enabled
            clientes: true, // Always enabled
            resumos: company.resumo_access || false,
            tags: company.tags_access || false,
            comprovantes: company.comprovante_access || false,
            comprovRota: company.comprov_rota_access || false,
            bomba: company.bomba_gasolina_access || false,
            calculoUmPorDia: company.calculo_um_por_dia || false,
            bau: company.bau_access || false,
            operacoes: company.operacoes_access || false,
            logs: (company as any).logs_access || false,
            jpdTransportes: (company as any).jpd_transportes_access || false,
            blixxGrupos: (company as any).blixx_grupos_access || false,
            painelControleBlixx: (company as any).painel_controle_blixx_access || false,
          });
        } else {
          // Default to all modules enabled if company data doesn't exist
          setModuleAccess({
            checklist: true,
            motoristas: true,
            hodometros: true,
            minuta: true,
            romaneio: false,
            veiculos: true,
            clientes: true,
            resumos: true,
            tags: true,
            comprovantes: true,
            comprovRota: false,
            bomba: false,
            calculoUmPorDia: false,
            bau: false,
            operacoes: false,
            logs: false,
            jpdTransportes: false,
            blixxGrupos: false,
            painelControleBlixx: false,
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
          hodometros: true,
          minuta: true,
          romaneio: false,
          veiculos: true,
          clientes: true,
          resumos: true,
          tags: true,
          comprovantes: true,
          comprovRota: false,
          bomba: false,
          calculoUmPorDia: false,
          bau: false,
          operacoes: false,
          logs: false,
          jpdTransportes: false,
          blixxGrupos: false,
          painelControleBlixx: false,
        });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [companyId]);

  return { loading, moduleAccess };
};
