import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Building, Clock, Edit2, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Vaga } from '@shared/schema';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import VagaDetailsModal from './VagaDetailsModal';

interface VagasListProps {
  onRefresh: () => void;
}

const VagasList: React.FC<VagasListProps> = ({ onRefresh }) => {
  const { accountId } = useAuth();
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVaga, setSelectedVaga] = useState<Vaga | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchVagas = async () => {
    try {
      setLoading(true);
      
      // First get company_id from account_id
      const companyRes = await fetch(`/api/company/by-account/${accountId}`);
      if (!companyRes.ok) {
        setError('Erro ao buscar dados da empresa');
        return;
      }
      
      const companyData = await companyRes.json();
      const companyId = companyData.company_id;
      
      // Now fetch vagas using company_id with joins
      const response = await fetch(`/api/vagas/company/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setVagas(data);
      } else {
        setError('Erro ao carregar vagas');
      }
    } catch (error) {
      console.error('Error fetching vagas:', error);
      setError('Erro ao carregar vagas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchVagas();
    }
  }, [accountId]);

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const handleDeleteVaga = async (vagaId: number) => {
    // Show confirmation toast
    toast((t) => (
      <div className="flex items-center space-x-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Deletar vaga?</p>
          <p className="text-xs text-gray-500">Esta ação não pode ser desfeita</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              
              // Show loading toast
              const loadingToast = toast.loading('Deletando vaga...');
              
              try {
                const response = await fetch(`/api/vagas/${vagaId}`, {
                  method: 'DELETE',
                });

                toast.dismiss(loadingToast);

                if (response.ok) {
                  // Refresh the list and dashboard
                  await fetchVagas();
                  onRefresh();
                  toast.success('Vaga deletada com sucesso!');
                } else {
                  const errorData = await response.json();
                  toast.error(`Erro ao deletar: ${errorData.error || 'Erro desconhecido'}`);
                }
              } catch (error) {
                toast.dismiss(loadingToast);
                console.error('Error deleting vaga:', error);
                toast.error('Erro ao deletar vaga');
              }
            }}
            className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
          >
            Deletar
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-xs hover:bg-gray-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-center',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'aberta':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'fechada':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'pausada':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="text-center py-8">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      {vagas.length === 0 ? (
        <div className="p-6 text-center py-12">
          <Building className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Nenhuma vaga encontrada
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Crie sua primeira vaga para começar
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vaga
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cliente/Unidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Operação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data Limite
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {vagas.map((vaga) => (
                <tr key={vaga.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {vaga.nome || 'Sem nome'}
                      </div>
                      {vaga.descricao && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {vaga.descricao}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <Building size={16} className="mr-1 text-gray-400" />
                        {(vaga as any).cliente_nome || 'Sem cliente'}
                      </div>
                      {(vaga as any).unidade_nome && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {(vaga as any).unidade_nome}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {(vaga as any).operacao_nome || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900 dark:text-white">
                      <Users size={16} className="mr-1 text-gray-400" />
                      {vaga.quantidade || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900 dark:text-white">
                      <Calendar size={16} className="mr-1 text-gray-400" />
                      {formatDate(vaga.dt_limite?.toString() || null)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor((vaga as any).status_nome || 'Ativa')}`}>
                      {(vaga as any).status_nome || 'Ativa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setSelectedVaga(vaga);
                          setIsModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Visualizar"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteVaga(vaga.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal de Detalhes/Edição */}
      {selectedVaga && (
        <VagaDetailsModal
          vaga={selectedVaga}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedVaga(null);
          }}
          onUpdate={() => {
            fetchVagas();
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

export default VagasList;