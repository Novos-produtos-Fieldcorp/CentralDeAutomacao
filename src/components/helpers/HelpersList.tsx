import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { DocumentoAjudante } from '../../types/database';
import HelperListItem from './HelperListItem';
import HelperFormModal from './HelperFormModal';
import DeleteHelperModal from './DeleteHelperModal';
import toast from 'react-hot-toast';

interface HelpersListProps {
  veiculoId: number;
}

const HelpersList: React.FC<HelpersListProps> = ({ veiculoId }) => {
  const [helpers, setHelpers] = useState<DocumentoAjudante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHelper, setSelectedHelper] = useState<DocumentoAjudante | null>(null);

  useEffect(() => {
    fetchHelpers();
  }, [veiculoId]);

  const fetchHelpers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documento_ajudante')
        .select(`
          *,
          cnh_ajudante(*),
          rg_ajudante(*)
        `)
        .eq('veiculo_id', veiculoId);

      if (error) throw error;
      setHelpers(data || []);
    } catch (error) {
      console.error('Error fetching helpers:', error);
      toast.error('Erro ao carregar ajudantes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHelper = () => {
    setSelectedHelper(null);
    setIsAddModalOpen(true);
  };

  const handleEditHelper = (helper: DocumentoAjudante) => {
    setSelectedHelper(helper);
    setIsEditModalOpen(true);
  };

  const handleDeleteHelper = (helper: DocumentoAjudante) => {
    setSelectedHelper(helper);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteHelper = async () => {
    if (!selectedHelper) return;

    try {
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
    }
  };

  const filteredHelpers = helpers.filter(helper => {
    const searchLower = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      (helper.nome && helper.nome.toLowerCase().includes(searchLower)) ||
      (helper.cpf && helper.cpf.toString().includes(searchTerm))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Ajudantes ({helpers.length})
        </h3>
        <button
          onClick={handleAddHelper}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Adicionar Ajudante
        </button>
      </div>

      {helpers.length > 0 && (
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar ajudante por nome ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : filteredHelpers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHelpers.map(helper => (
            <HelperListItem
              key={helper.id_ajudante}
              helper={helper}
              onEdit={handleEditHelper}
              onDelete={handleDeleteHelper}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Nenhum ajudante encontrado' : 'Nenhum ajudante cadastrado'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
            >
              Limpar busca
            </button>
          )}
        </div>
      )}

      <HelperFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        veiculoId={veiculoId}
        onSuccess={fetchHelpers}
      />

      <HelperFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        veiculoId={veiculoId}
        helper={selectedHelper}
        onSuccess={fetchHelpers}
      />

      <DeleteHelperModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteHelper}
        helper={selectedHelper}
      />
    </div>
  );
};

export default HelpersList;