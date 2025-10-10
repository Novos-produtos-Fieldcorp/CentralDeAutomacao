import { useState, useEffect } from 'react';
import { X, User, Phone, Truck, Edit2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Candidate {
  motorista_id: number;
  nome: string;
  telefone: number | null;
  funcao: string;
  st_cadastro: string;
  email: string | null;
}

interface VagaCandidatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaga: {
    id: number;
    nome: string;
    cliente_id: number | null;
    cliente_nome: string | null;
  };
  companyId: number;
}

const STATUS_OPTIONS = [
  { value: 'Cadastrado', label: 'Cadastrado', color: 'bg-gray-100 text-gray-800' },
  { value: 'qualificado', label: 'Qualificado', color: 'bg-blue-100 text-blue-800' },
  { value: 'documentacao', label: 'Documentação', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'contrato_enviado', label: 'Contrato Enviado', color: 'bg-purple-100 text-purple-800' },
  { value: 'contratado', label: 'Contratado', color: 'bg-green-100 text-green-800' },
  { value: 'repescagem', label: 'Repescagem', color: 'bg-orange-100 text-orange-800' },
  { value: 'gestao_risco', label: 'Gestão de Risco', color: 'bg-red-100 text-red-800' },
  { value: 'rejeitado', label: 'Rejeitado', color: 'bg-red-200 text-red-900' },
];

const VagaCandidatesModal = ({ isOpen, onClose, vaga, companyId }: VagaCandidatesModalProps) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  useEffect(() => {
    if (isOpen && vaga.cliente_id) {
      fetchCandidates();
    }
  }, [isOpen, vaga.cliente_id, companyId]);

  const fetchCandidates = async () => {
    if (!vaga.cliente_id) {
      setCandidates([]);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id, nome, telefone, funcao, st_cadastro, email')
        .eq('company_id', companyId)
        .eq('cliente_id', vaga.cliente_id)
        .order('nome');

      if (error) {
        console.error('Error fetching candidates:', error);
        toast.error('Erro ao carregar candidatos');
        return;
      }

      setCandidates(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao carregar candidatos');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (motoristaId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', motoristaId)
        .eq('company_id', companyId);

      if (error) {
        console.error('Error updating status:', error);
        toast.error('Erro ao atualizar status');
        return;
      }

      setCandidates(prev => 
        prev.map(c => 
          c.motorista_id === motoristaId 
            ? { ...c, st_cadastro: newStatus }
            : c
        )
      );
      
      setEditingId(null);
      setSelectedStatus('');
      toast.success('Status atualizado com sucesso!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusColor = (status: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value.toLowerCase() === status.toLowerCase());
    return option?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value.toLowerCase() === status.toLowerCase());
    return option?.label || status;
  };

  const formatPhone = (phone: number | null) => {
    if (!phone) return '-';
    const phoneStr = String(phone);
    if (phoneStr.length === 11) {
      return `(${phoneStr.slice(0, 2)}) ${phoneStr.slice(2, 7)}-${phoneStr.slice(7)}`;
    }
    return phoneStr;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Candidatos Vinculados
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Vaga: <span className="font-medium">{vaga.nome}</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cliente: <span className="font-medium">{vaga.cliente_nome || 'Não especificado'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            data-testid="button-close-candidates-modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !vaga.cliente_id ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Esta vaga não está vinculada a um cliente
              </p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Nenhum candidato encontrado para este cliente
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((candidate) => (
                <div 
                  key={candidate.motorista_id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  data-testid={`card-candidate-${candidate.motorista_id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Candidate Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          candidate.funcao === 'Agregado' 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          {candidate.funcao === 'Agregado' ? (
                            <Truck className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-medium text-gray-900 dark:text-white truncate" data-testid={`text-name-${candidate.motorista_id}`}>
                            {candidate.nome}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              candidate.funcao === 'Agregado'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                            }`} data-testid={`text-type-${candidate.motorista_id}`}>
                              {candidate.funcao || 'Motorista'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-2">
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          <span data-testid={`text-phone-${candidate.motorista_id}`}>{formatPhone(candidate.telefone)}</span>
                        </div>
                        {candidate.email && (
                          <div className="text-xs truncate">
                            {candidate.email}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Section */}
                    <div className="flex items-center gap-2">
                      {editingId === candidate.motorista_id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-[180px] h-9 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid={`select-status-${candidate.motorista_id}`}
                          >
                            <option value="">Selecione...</option>
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              if (selectedStatus) {
                                handleStatusChange(candidate.motorista_id, selectedStatus);
                              }
                            }}
                            disabled={!selectedStatus}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid={`button-save-status-${candidate.motorista_id}`}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setSelectedStatus('');
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            data-testid={`button-cancel-status-${candidate.motorista_id}`}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span 
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(candidate.st_cadastro)}`}
                            data-testid={`text-status-${candidate.motorista_id}`}
                          >
                            {getStatusLabel(candidate.st_cadastro)}
                          </span>
                          <button
                            onClick={() => {
                              setEditingId(candidate.motorista_id);
                              setSelectedStatus(candidate.st_cadastro);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            data-testid={`button-edit-status-${candidate.motorista_id}`}
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VagaCandidatesModal;
