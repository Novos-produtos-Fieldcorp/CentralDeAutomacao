import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { getWiseAppLabels } from "@/lib/directApiService";
import { supabase } from "@/lib/supabase";
import { TagAdministration } from "./TagAdministration";

interface TagManagerProps {
  companyId: number;
}

export function TagManager({ companyId }: TagManagerProps) {
  const [isSyncingWiseApp, setIsSyncingWiseApp] = useState(false);
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();

  // Query para buscar tags do banco local
  const {
    data: localTags,
    isLoading: isLoadingLocal,
    error: localError,
  } = useQuery({
    queryKey: ["local-tags", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tag")
        .select("*")
        .eq("company_id", companyId)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Query para buscar tags do WiseApp (apenas quando necessário)
  const {
    data: tagsResponse,
    isLoading: isLoadingWiseApp,
    error: wiseAppError,
  } = useQuery({
    queryKey: ["wiseapp-tags", accountId],
    queryFn: async () => {
      if (!accountId || !wiseAppToken) {
        throw new Error("AccountId ou token não disponível");
      }
      // Fetching WiseApp tags for account
      return getWiseAppLabels(accountId, wiseAppToken);
    },
    enabled: false, // Não carregar automaticamente
    retry: 3,
    retryDelay: 1000,
  });

  const wiseAppTags = tagsResponse?.payload || tagsResponse || [];
  const tags = localTags || [];
  const isLoading = isLoadingLocal;

  const syncWiseAppTags = async () => {
    if (isSyncingWiseApp) return;

    setIsSyncingWiseApp(true);

    // Mostrar notificação de início com progresso
    const syncToast = toast.loading("Conectando com WiseApp...");

    try {
      if (!accountId) {
        toast.error("ID da conta não encontrado", { id: syncToast });
        return;
      }

      // Verificar se temos token WiseApp
      if (!wiseAppToken) {
        toast.error(
          "Token WiseApp não encontrado. Configure o token primeiro.",
          { id: syncToast },
        );
        return;
      }

      // Atualizar progresso
      toast.loading("Buscando marcadores do WiseApp...", { id: syncToast });

      // Buscar tags do WiseApp usando função robusta
      // Synchronizing tags with WiseApp
      const wiseAppLabelsResponse = await getWiseAppLabels(
        accountId || "",
        wiseAppToken || "",
        companyId,
      );
      console.log(
        "📦 [SYNC] Resposta do WiseApp (RAW):",
        wiseAppLabelsResponse,
      );
      const wiseAppTagsData =
        wiseAppLabelsResponse.payload || wiseAppLabelsResponse || [];
      console.log("📦 [SYNC] Tags extraídas:", wiseAppTagsData);
      console.log("📦 [SYNC] Primeira tag:", wiseAppTagsData[0]);
      // Tags found from WiseApp
      // WiseApp labels retrieved

      if (!wiseAppTagsData || wiseAppTagsData.length === 0) {
        toast("Nenhum marcador encontrado no WiseApp.", {
          id: syncToast,
          icon: "ℹ️",
          duration: 4000,
        });
        return;
      }

      // Atualizar progresso
      toast.loading(`Processando ${wiseAppTagsData.length} marcadores...`, {
        id: syncToast,
      });
      const { data: existingTags, error: fetchError } = await supabase
        .from("tag")
        .select("nome")
        .eq("company_id", companyId);

      if (fetchError) {
        console.error("Erro ao buscar tags existentes:", fetchError);
        throw fetchError;
      }

      const existingTagNames = new Set(
        existingTags?.map((tag) => tag.nome.toLowerCase()) || [],
      );

      const wiseAppTagNames = new Set(
        wiseAppTagsData.map((tag: any) => (tag.name || "Tag").toLowerCase()),
      );

      console.log(
        "🔍 [SYNC] Tags do WiseApp:",
        wiseAppTagsData.length,
        wiseAppTagsData.map((t: any) => t.name),
      );
      console.log(
        "🔍 [SYNC] Tags do banco:",
        existingTags?.length,
        existingTags?.map((t: any) => t.nome),
      );

      const tagsToDelete =
        existingTags?.filter(
          (tag) => !wiseAppTagNames.has(tag.nome.toLowerCase()),
        ) || [];

      console.log(
        "➖ [SYNC] Tags para remover do banco:",
        tagsToDelete.map((t: any) => t.nome),
      );

      // Preparar tags para inserção (apenas as que não existem)
      const tagsToInsert = wiseAppTagsData
        .filter(
          (tag: any) =>
            !existingTagNames.has((tag.name || "Tag").toLowerCase()),
        )
        .map((tag: any) => ({
          nome: tag.name || "Tag",
          cor: tag.color || "#3B82F6",
          company_id: companyId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

      console.log(
        "➕ [SYNC] Tags para adicionar no banco:",
        tagsToInsert.map((t: any) => t.nome),
      );

      // Processing tags for insertion and deletion
      let syncMessage = "";

      // Remover tags deletadas no WiseApp
      if (tagsToDelete.length > 0) {
        toast.loading(
          `Removendo ${tagsToDelete.length} marcadores deletados...`,
          { id: syncToast },
        );

        const tagNamesToDelete = tagsToDelete.map((tag) => tag.nome);
        const { error: deleteError } = await supabase
          .from("tag")
          .delete()
          .eq("company_id", companyId)
          .in("nome", tagNamesToDelete);

        if (deleteError) {
          console.error("Erro ao deletar tags:", deleteError);
        } else {
          syncMessage += `${tagsToDelete.length} removidos, `;
        }
      }

      if (tagsToInsert.length > 0) {
        // Atualizar progresso
        toast.loading(`Salvando ${tagsToInsert.length} novos marcadores...`, {
          id: syncToast,
        });

        const { data: insertedTags, error: insertError } = await supabase
          .from("tag")
          .insert(tagsToInsert)
          .select();

        if (insertError) {
          console.error("Erro ao inserir tags no Supabase:", insertError);
          throw insertError;
        }

        syncMessage += `${tagsToInsert.length} adicionados`;
        toast.success(`Sincronização completa: ${syncMessage}`, {
          id: syncToast,
          duration: 5000,
        });
      } else if (tagsToDelete.length > 0) {
        toast.success(
          `Sincronização completa: ${syncMessage.replace(", ", "")}`,
          {
            id: syncToast,
            duration: 5000,
          },
        );
      } else {
        toast.success("Todos os marcadores já estão atualizados.", {
          id: syncToast,
          duration: 4000,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["local-tags", companyId],
      });
      await queryClient.invalidateQueries({ queryKey: ["wiseapp-tags"] });
    } catch (error) {
      console.error("Erro ao sincronizar tags do WiseApp:", error);

      let errorMessage =
        "Erro desconhecido ao sincronizar marcadores do WiseApp";

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (
          message.includes("failed to fetch") ||
          message.includes("network") ||
          message.includes("timeout")
        ) {
          errorMessage =
            "🔄 Problema de conectividade detectado. O sistema tentou múltiplas vezes mas não conseguiu conectar com o WiseApp. Tente novamente em alguns minutos.";
        } else if (
          message.includes("401") ||
          message.includes("unauthorized")
        ) {
          errorMessage = `🔐 Falha na autenticação WiseApp (Account ID: ${accountId}). Verifique se as credenciais estão corretas e atualizadas.`;
        } else if (message.includes("403") || message.includes("forbidden")) {
          errorMessage =
            "⛔ Acesso negado pelo WiseApp. Verifique as permissões da sua conta.";
        } else if (message.includes("404") || message.includes("not found")) {
          errorMessage =
            "❓ Conta ou recurso não encontrado no WiseApp. Verifique se o Account ID está correto.";
        } else if (
          message.includes("500") ||
          message.includes("internal server")
        ) {
          errorMessage =
            "⚠️ Servidor WiseApp temporariamente indisponível. Tente novamente mais tarde.";
        } else if (
          message.includes("rate limit") ||
          message.includes("too many requests")
        ) {
          errorMessage =
            "⏱️ Muitas requisições ao WiseApp. Aguarde um momento e tente novamente.";
        } else {
          errorMessage = `❌ ${error.message}`;
        }
      }

      toast.error(errorMessage, {
        id: syncToast,
        duration: 6000,
      });

      // Still show local tags even if WiseApp fails
      // System will continue with local tags only

      // Mostrar informação adicional se há tags locais disponíveis
      if (tags.length > 0) {
        setTimeout(() => {
          toast(
            `ℹ️ Continuando com ${tags.length} marcadores locais disponíveis.`,
            {
              duration: 4000,
            },
          );
        }, 1000);
      }
    } finally {
      setIsSyncingWiseApp(false);
    }
  };

  if (isLoading) {
    return <div className="text-center">Carregando tags...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Administração de Tags */}
      <TagAdministration companyId={companyId} />

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Marcadores
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={syncWiseAppTags}
              disabled={isSyncingWiseApp}
              className="bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              title={
                isSyncingWiseApp
                  ? "Sincronização em andamento..."
                  : "Clique para sincronizar marcadores do WiseApp"
              }
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncingWiseApp ? "animate-spin" : ""}`}
              />
              {isSyncingWiseApp
                ? "Sincronizando..."
                : "Sincronizar com WiseApp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
