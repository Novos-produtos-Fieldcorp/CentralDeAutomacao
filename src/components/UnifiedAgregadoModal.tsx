import { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AddAjudanteModal from './AddAjudanteModal';
import { supabase } from '../lib/supabase';
import type { Ajudante } from '../types/ajudante';

interface Motorista {
  motorista_id: number;
  nome_motorista: string;
  nr_cpf: string;
  nr_telefone: string;
}

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'ajudantes'>('details');
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [ajudantes, setAjudantes] = useState<Ajudante[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const formatCPF = (cpf: string | number | null): string => {
    if (!cpf) return 'Não informado';
    const cpfStr = cpf.toString().replace(/\D/g, '');
    return cpfStr.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (phone: string | number | null): string => {
    if (!phone) return 'Não informado';
    const phoneStr = phone.toString().replace(/\D/g, '');
    if (phoneStr.length === 11) {
      return phoneStr.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phoneStr.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
  };

  const fetchAjudantes = async () => {
    if (!motorista) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documento_ajudante')
        .select('*', { count: 'exact' })
        .eq('motorista_id', motorista.motorista_id)
        .order('nome', { ascending: true });
        
      if (error) throw error;
      
      setAjudantes(data || []);
    } catch (error) {
      console.error('Error fetching ajudantes:', error);
      toast.error('Erro ao carregar ajudantes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAjudante = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este ajudante?')) return;
    
    try {
      // First, delete related records from cnh_ajudante
      const { error: cnhError } = await supabase
        .from('cnh_ajudante')
        .delete()
        .eq('id_ajudante', id);
      
      if (cnhError) throw cnhError;
      
      // Then delete from documento_ajudante
      const { error } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', id);
        
      if (error) throw error;
      
      await fetchAjudantes();
      toast.success('Ajudante removido com sucesso');
      onSuccess?.();
    } catch (error) {
      console.error('Error deleting ajudante:', error);
      toast.error('Erro ao remover ajudante. Verifique se não há registros relacionados.');
    }
  };

  useEffect(() => {
    if (isOpen && motorista) {
      fetchAjudantes();
    } else {
      setAjudantes([]);
    }
  }, [isOpen, motorista]);

  if (!isOpen || !motorista) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-transparent" aria-hidden="true">
          <div className="absolute inset-0 bg-transparent"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {motorista.nome_motorista}
              </h3>
              <button
                type="button"
                className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                onClick={onClose}
              >
                <span className="sr-only">Fechar</span>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`${
                      activeTab === 'details'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Detalhes
                  </button>
                  <button
                    onClick={() => setActiveTab('ajudantes')}
                    className={`${
                      activeTab === 'ajudantes'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Ajudantes ({ajudantes.length})
                  </button>
                </nav>
              </div>

              <div className="mt-6">
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Informações Pessoais</h3>
                      </div>
                      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                        <dl className="sm:divide-y sm:divide-gray-200">
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Nome</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              {motorista.nome_motorista}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">CPF</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              {motorista.nr_cpf}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Telefone</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              {motorista.nr_telefone}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ajudantes' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">Ajudantes</h3>
                      <button
                        type="button"
                        onClick={() => setIsAddAjudanteModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Adicionar Ajudante
                      </button>
                    </div>

                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                      <ul className="divide-y divide-gray-200">
                        {isLoading ? (
                          <li className="px-6 py-4 text-center">
                            <div className="animate-pulse">
                              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                            </div>
                          </li>
                        ) : ajudantes.length === 0 ? (
                          <li className="px-6 py-4 text-center">
                            <User className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">
                              Nenhum ajudante encontrado
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Adicione um novo ajudante para começar.
                            </p>
                            <div className="mt-6">
                              <button
                                onClick={() => setIsAddAjudanteModalOpen(true)}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                Adicionar Ajudante
                              </button>
                            </div>
                          </li>
                        ) : (
                          ajudantes.map((ajudante) => (
                            <li key={ajudante.id_ajudante} className="px-6 py-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-blue-100">
                                    <User className="h-6 w-6 text-blue-600" />
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {ajudante.nome || 'Sem nome'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      CPF: {formatCPF(ajudante.cpf)}
                                    </div>
                                    {ajudante.telefone && (
                                      <div className="text-sm text-gray-500">
                                        Tel: {formatPhone(ajudante.telefone)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteAjudante(ajudante.id_ajudante)}
                                  className="text-red-600 hover:text-red-900 text-sm font-medium"
                                  title="Excluir ajudante"
                                >
                                  Excluir
                                </button>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAddAjudanteModalOpen && motorista && (
        <AddAjudanteModal
          isOpen={isAddAjudanteModalOpen}
          onClose={() => setIsAddAjudanteModalOpen(false)}
          motorista_id={motorista.motorista_id}
          onSuccess={() => {
            fetchAjudantes();
            onSuccess?.();
          }}
        />
      )}
    </div>
  );
};

export default UnifiedAgregadoModal;