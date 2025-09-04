import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { getWiseAppLabels } from "@/lib/directApiService";
import { supabase } from "@/lib/supabase";
import { TagAdministration } from './TagAdministration';

interface TagManagerProps {
  companyId: number;
}

export function TagManager({ companyId }: TagManagerProps) {
  const [isSyncingWiseApp, setIsSyncingWiseApp] = useState(false);
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();

  // Query para buscar tags do banco local
  const { data: localTags, isLoading: isLoadingLocal, error: localError } = useQuery({
    queryKey: ['local-tags', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tag')
        .select('*')
        .eq('company_id', companyId)
        .order('nome');

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Query para buscar tags do WiseApp (apenas quando necessário)
  const { data: tagsResponse, isLoading: isLoadingWiseApp, error: wiseAppError } = useQuery({
    queryKey: ['wiseapp-tags', accountId],
    queryFn: async () => {
      if (!accountId || !wiseAppToken) {
        throw new Error('AccountId ou token não disponível');
      }
      console.log('Buscando tags do WiseApp para account:', accountId);
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

      // Buscar tags do WiseApp
      console.log('Sincronizando tags - Account ID:', accountId, 'Token disponível:', !!wiseAppToken);
      const wiseAppLabelsResponse = await getWiseAppLabels(accountId || '', wiseAppToken || '');
      const wiseAppTagsData = wiseAppLabelsResponse.payload || wiseAppLabelsResponse || [];
      console.log('Tags encontradas:', wiseAppTagsData);
      console.log('WiseApp labels found:', wiseAppTagsData);
      
      if (!wiseAppTagsData || wiseAppTagsData.length === 0) {
        toast('Nenhuma tag encontrada no WiseApp.', {
          icon: 'ℹ️'
        });
        return;
      }

      // Salvar tags no Supabase
      console.log('Salvando tags no Supabase para company_id:', companyId);
      
      // Primeiro, buscar tags existentes para evitar duplicatas
      const { data: existingTags, error: fetchError } = await supabase
        .from('tag')
        .select('nome')
        .eq('company_id', companyId);

      if (fetchError) {
        console.error('Erro ao buscar tags existentes:', fetchError);
        throw fetchError;
      }

      const existingTagNames = new Set(existingTags?.map(tag => tag.nome.toLowerCase()) || []);

      // Preparar tags para inserção (apenas as que não existem)
      const tagsToInsert = wiseAppTagsData
        .filter((tag: any) => !existingTagNames.has((tag.name || tag.title || 'Tag').toLowerCase()))
        .map((tag: any) => ({
          nome: tag.name || tag.title || 'Tag',
          cor: tag.color || '#3B82F6',
          company_id: companyId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

      console.log('Tags para inserir:', tagsToInsert);

      if (tagsToInsert.length > 0) {
        const { data: insertedTags, error: insertError } = await supabase
          .from('tag')
          .insert(tagsToInsert)
          .select();

        if (insertError) {
          console.error('Erro ao inserir tags no Supabase:', insertError);
          throw insertError;
        }

        console.log('Tags inseridas com sucesso:', insertedTags);
        toast.success(`${tagsToInsert.length} tags sincronizadas e salvas no banco de dados!`);
      } else {
        toast('Todas as tags já existem no banco de dados.', {
          icon: 'ℹ️'
        });
      }
      
      // Invalidar queries para atualizar UI
      await queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['wiseapp-tags'] });
      
    } catch (error) {
      console.error('Erro ao sincronizar tags do WiseApp:', error);
      toast.error('Erro ao sincronizar tags do WiseApp');
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Sincronização com WiseApp</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={syncWiseAppTags}
              disabled={isSyncingWiseApp}
              className="bg-green-600 dark:bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingWiseApp ? 'animate-spin' : ''}`} />
              {isSyncingWiseApp ? 'Sincronizando...' : 'Sincronizar com WiseApp'}
            </button>
          </div>
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
                    style={{ backgroundColor: tag.cor || '#3B82F6' }}
                    title={`Cor: ${tag.cor || '#3B82F6'}`}
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {tag.nome}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Local</span>
                </div>
              </div>
              {tag.limite_max && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Limite: {tag.limite_max} associados
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhuma tag encontrada. Clique em "Sincronizar com WiseApp" para buscar tags do WiseApp.
          </p>
        </div>
      )}
    </div>
  );
}