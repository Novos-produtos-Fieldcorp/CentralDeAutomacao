import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { getWiseAppLabels } from "@/lib/directApiService";

interface TagManagerProps {
  companyId: number;
}

export function TagManager({ companyId }: TagManagerProps) {
  const [isSyncingWiseApp, setIsSyncingWiseApp] = useState(false);
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();

  // Query para buscar labels do WiseApp
  const { data: tagsResponse, isLoading } = useQuery({
    queryKey: ['wiseapp-labels', companyId],
    queryFn: () => getWiseAppLabels(companyId),
    enabled: !!companyId,
  });
  
  const tags = tagsResponse?.payload || [];

  // Sincronizar labels do WiseApp
  const syncWiseAppTags = async () => {
    if (isSyncingWiseApp) return;
    
    setIsSyncingWiseApp(true);
    try {
      if (!accountId) {
        toast.error('ID da conta não encontrado');
        return;
      }

      // Verificar se temos token WiseApp
      if (!wiseAppToken) {
        toast.error('Token WiseApp não encontrado. Configure o token primeiro.');
        return;
      }

      // Buscar labels do WiseApp
      const wiseAppLabelsResponse = await getWiseAppLabels(companyId);
      const wiseAppTags = wiseAppLabelsResponse.payload || [];
      console.log('WiseApp labels found:', wiseAppTags);
      
      if (!wiseAppTags || wiseAppTags.length === 0) {
        toast('Nenhuma label encontrada no WiseApp.', {
          icon: 'ℹ️'
        });
        return;
      }

      // Atualizar cache com as novas labels
      queryClient.invalidateQueries({ queryKey: ['wiseapp-labels', companyId] });
      
      if (wiseAppTags.length > 0) {
        toast.success(`${wiseAppTags.length} label(s) sincronizada(s) do WiseApp!`);
      } else {
        toast('Nenhuma label encontrada no WiseApp.', {
          icon: 'ℹ️'
        });
      }
    } catch (error) {
      console.error('Erro ao sincronizar labels do WiseApp:', error);
      toast.error('Erro ao sincronizar labels do WiseApp');
    } finally {
      setIsSyncingWiseApp(false);
    }
  };

  if (isLoading) {
    return <div className="text-center">Carregando labels...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Labels WiseApp</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={syncWiseAppTags}
            disabled={isSyncingWiseApp}
            className="bg-green-600 dark:bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingWiseApp ? 'animate-spin' : ''}`} />
            {isSyncingWiseApp ? 'Sincronizando...' : 'Sync WiseApp'}
          </button>
        </div>
      </div>

      {tags && tags.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tags.map((tag: any) => (
            <div
              key={tag.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: tag.color || '#3B82F6' }}
                    title={`Cor: ${tag.color || '#3B82F6'}`}
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {tag.title || tag.name || 'Label'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">WiseApp</span>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <span>ID: {tag.id}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhuma label encontrada. Clique em "Sync WiseApp" para buscar labels.
          </p>
        </div>
      )}
    </div>
  );
}