import { SlidersHorizontal, Lock } from 'lucide-react';
import { useModuleAccess } from '../hooks/useModuleAccess';
import LoadingSpinner from '../components/LoadingSpinner';
import PainelTabs from './painel-controle-blixx/PainelTabs';

const PainelControleBlixx = () => {
  const { moduleAccess, loading } = useModuleAccess();

  if (loading) return <LoadingSpinner />;

  if (!moduleAccess.painelControleBlixx) {
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
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Módulo Painel de Controle Blixx não está disponível
            </p>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Sua empresa não possui acesso ao módulo Painel de Controle Blixx. Entre em contato com o administrador.
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
          <SlidersHorizontal className="w-8 h-8 text-blue-600" />
          Painel de Controle Blixx
        </h1>
      </div>

      <PainelTabs />
    </div>
  );
};

export default PainelControleBlixx;
