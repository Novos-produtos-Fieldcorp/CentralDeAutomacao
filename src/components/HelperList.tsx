import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Phone, Mail, FileText, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../utils/format';
import HelperForm from './HelperForm';

interface HelperListProps {
  veiculo_id: number;
}

interface Helper {
  id_ajudante: number;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  genero: string | null;
  comprovante_residencia: string | null;
  cnh?: {
    id_cnh_ajudante: number;
    nr_registro: number | null;
    categoria: string | null;
    nome_pai: string | null;
    nome_mae: string | null;
    foto_cnh: string | null;
  } | null;
  rg?: {
    id_rg_ajudante: number;
    nr_rg: number | null;
    data_emissao: string | null;
    orgao_expedidor: string | null;
    foto_rg: string | null;
  } | null;
}

const HelperList: React.FC<HelperListProps> = ({ veiculo_id }) => {
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedHelper, setSelectedHelper] = useState<Helper | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedHelper, setExpandedHelper] = useState<number | null>(null);

  useEffect(() => {
    fetchHelpers();
  }, [veiculo_id]);

  const fetchHelpers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('documento_ajudante')
        .select(`
          *,
          cnh_ajudante (*),
          rg_ajudante (*)
        `)
        .eq('veiculo_id', veiculo_id);

      if (error) throw error;
      
      setHelpers(data || []);
    } catch (error) {
      console.error('Error fetching helpers:', error);
      toast.error('Erro ao carregar ajudantes');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (helper: Helper) => {
    setSelectedHelper(helper);
    setIsEditModalOpen(true);
  };

  const handleDelete = (helper: Helper) => {
    setSelectedHelper(helper);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedHelper) return;
    
    try {
      setDeleting(true);
      
      const { error } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', selectedHelper.id_ajudante);
        
      if (error) throw error;
      
      setHelpers(helpers.filter(h => h.id_ajudante !== selectedHelper.id_ajudante));
      toast.success('Ajudante excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting helper:', error);
      toast.error('Erro ao excluir ajudante');
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedHelper(expandedHelper === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Ajudantes
        </h3>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                   dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                   rounded-lg transition-colors flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Adicionar Ajudante
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : helpers.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum ajudante cadastrado para este veículo
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {helpers.map(helper => (
            <div 
              key={helper.id_ajudante}
              className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div 
                className="p-4 cursor-pointer"
                onClick={() => toggleExpand(helper.id_ajudante)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-base font-medium text-gray-900 dark:text-white">
                        {helper.nome}
                      </h4>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {helper.cpf ? formatCPF(helper.cpf.toString()) : 'CPF não informado'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(helper);
                      }}
                      className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Editar ajudante"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(helper);
                      }}
                      className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Excluir ajudante"
                    >
                      <Trash2 size={18} />
                    </button>
                    {expandedHelper === helper.id_ajudante ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
              
              {expandedHelper === helper.id_ajudante && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Informações Pessoais
                      </h5>
                      <div className="space-y-2">
                        {helper.telefone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatPhone(helper.telefone)}
                            </span>
                          </div>
                        )}
                        {helper.genero && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {helper.genero === 'M' ? 'Masculino' : helper.genero === 'F' ? 'Feminino' : 'Outro'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Documentos
                      </h5>
                      <div className="space-y-2">
                        {helper.cnh && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              CNH: {helper.cnh.categoria || 'Não informada'} 
                              {helper.cnh.nr_registro ? ` - ${helper.cnh.nr_registro}` : ''}
                            </span>
                          </div>
                        )}
                        {helper.rg && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              RG: {helper.rg.nr_rg || 'Não informado'} 
                              {helper.rg.orgao_expedidor ? ` - ${helper.rg.orgao_expedidor}` : ''}
                            </span>
                          </div>
                        )}
                        {helper.comprovante_residencia && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Comprovante de Residência: Disponível
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Helper Modal */}
      <HelperForm
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        veiculo_id={veiculo_id}
        onSuccess={fetchHelpers}
      />

      <HelperForm
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        veiculo_id={veiculo_id}
        helper={selectedHelper}
        onSuccess={fetchHelpers}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedHelper && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Confirmar Exclusão
              </h2>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir o ajudante <span className="font-medium">{selectedHelper.nome}</span>? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelperList;