import { useEffect, useState } from 'react';
import { MessageCircle, Lock } from 'lucide-react';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import { BlixxPanel } from './blixx-grupos/BlixxPanel';
import type { BlixxGroup } from './blixx-grupos/lib/blixxTypes';

const BlixxGrupos = () => {
  const { moduleAccess, loading } = useModuleAccess();
  const { companyId } = useCurrentAccount();
  const [groups, setGroups] = useState<BlixxGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      if (!companyId) {
        setLoadingGroups(false);
        return;
      }
      try {
        setLoadingGroups(true);
        setError(null);
        const { data, error } = await supabase
          .from('blixx_groups')
          .select('id, name, wa_chat_id, company_id')
          .eq('company_id', companyId)
          .order('name');
        if (error) throw error;
        const rows = (data ?? []) as BlixxGroup[];
        console.info(
          `[BlixxGrupos] companyId=${companyId} → ${rows.length} grupo(s) encontrado(s)`,
        );
        setGroups(rows);
      } catch (e) {
        console.error('Erro ao carregar grupos Blixx:', e);
        setError('Erro ao carregar grupos. Verifique se o setup do banco foi executado.');
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, [companyId]);

  if (loading) return <LoadingSpinner />;

  if (!moduleAccess.blixxGrupos) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Lock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Acesso Restrito</h1>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Módulo Blixx Grupos não está disponível</p>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Sua empresa não possui acesso ao módulo Blixx Grupos. Entre em contato com o administrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-green-600" />
          Blixx Grupos
        </h1>
      </div>

      {loadingGroups ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center text-gray-500 dark:text-gray-400 space-y-2">
          <p>
            Nenhum grupo encontrado para esta empresa (ID&nbsp;{companyId ?? '—'}).
          </p>
          <p className="text-sm">
            Os grupos são criados automaticamente pelo n8n quando chegam mensagens do
            WhatsApp. Se já existem grupos, confirme que o n8n grava{' '}
            <code className="px-1 rounded bg-gray-100 dark:bg-gray-700">company_id</code>{' '}
            = {companyId ?? 'o ID desta empresa'} na tabela{' '}
            <code className="px-1 rounded bg-gray-100 dark:bg-gray-700">blixx_groups</code>.
          </p>
        </div>
      ) : (
        <BlixxPanel groups={groups} companyId={companyId} />
      )}
    </div>
  );
};

export default BlixxGrupos;
