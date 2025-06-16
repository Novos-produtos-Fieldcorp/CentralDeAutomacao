import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Phone, X, Loader2, AlertCircle, FileText, Camera, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import HelperForm from './HelperForm';
import { formatCPF, formatPhone } from '../utils/format';

interface HelperListProps {
  veiculo_id: number;
}

interface Helper {
  id_ajudante: number;
  nome: string;
  cpf: string;
  telefone: string;
  genero: string;
  comprovante_residencia: string | null;
}

interface HelperWithDocuments extends Helper {
  cnh_ajudante?: {
    foto_cnh: string | null;
  }[];
  rg_ajudante?: {
    foto_rg: string | null;
  }[];
}

interface DeleteHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  helper: Helper | null;
  onConfirm: () => void;
}

const DeleteHelperModal: React.FC<DeleteHelperModalProps> = ({ isOpen, onClose, helper, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
    onClose();
  };

  if (!isOpen || !helper) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="text-red-500" size={24} />
            Confirmar Exclusão
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Tem certeza que deseja excluir este ajudante? Esta ação não pode ser desfeita.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Nome:</span> {helper.nome}
            </p>
            {helper.cpf && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">CPF:</span> {formatCPF(helper.cpf)}
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
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
  );
};

const DocumentPreview: React.FC<{ url: string | null, type: string }> = ({ url, type }) => {
  const [showFullImage, setShowFullImage] = useState(false);
  
  if (!url) return null;
  
  const isPdf = url.toLowerCase().endsWith('.pdf');
  
  const openInNewTab = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  
  return (
    <>
      <div 
        className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
        onClick={() => setShowFullImage(true)}
        title={`Ver ${type}`}
      >
        {isPdf ? (
          <div className="h-full w-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        ) : (
          <img 
            src={url} 
            alt={type} 
            className="h-full w-full object-cover"
          />
        )}
      </div>
      
      {/* Full-screen preview */}
      {showFullImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {type}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={openInNewTab}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Abrir em nova aba"
                >
                  <ExternalLink size={20} />
                </button>
                <button
                  onClick={() => setShowFullImage(false)}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="relative h-[calc(90vh-80px)]">
              {isPdf ? (
                <iframe 
                  src={`${url}#toolbar=1`} 
                  className="w-full h-full" 
                  title="PDF Viewer"
                />
              ) : (
                <img
                  src={url}
                  alt={type}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const HelperList: React.FC<HelperListProps> = ({ veiculo_id }) => {
  const [helpers, setHelpers] = useState<HelperWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedHelper, setSelectedHelper] = useState<number | undefined>(undefined);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [helperToDelete, setHelperToDelete] = useState<Helper | null>(null);

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
          cnh_ajudante(foto_cnh),
          rg_ajudante(foto_rg)
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

  const handleEdit = (helper_id: number) => {
    setSelectedHelper(helper_id);
    setIsFormOpen(true);
  };

  const handleDelete = (helper: Helper) => {
    setHelperToDelete(helper);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!helperToDelete) return;
    
    try {
      const { error } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', helperToDelete.id_ajudante);
        
      if (error) throw error;
      
      setHelpers(helpers.filter(h => h.id_ajudante !== helperToDelete.id_ajudante));
      toast.success('Ajudante excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting helper:', error);
      toast.error('Erro ao excluir ajudante');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Ajudantes
        </h3>
        <button
          onClick={() => {
            setSelectedHelper(undefined);
            setIsFormOpen(true);
          }}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                   dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                   rounded-lg transition-colors flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Adicionar Ajudante
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : helpers.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum ajudante cadastrado para este veículo
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {helpers.map(helper => (
            <div 
              key={helper.id_ajudante}
              className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {helper.nome}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    {helper.cpf && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCPF(helper.cpf)}
                      </span>
                    )}
                    {helper.telefone && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhone(helper.telefone)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Document Previews */}
                <div className="flex -space-x-1 mr-2">
                  {helper.comprovante_residencia && (
                    <DocumentPreview 
                      url={helper.comprovante_residencia} 
                      type="Comprovante de Residência" 
                    />
                  )}
                  {helper.cnh_ajudante?.[0]?.foto_cnh && (
                    <DocumentPreview 
                      url={helper.cnh_ajudante[0].foto_cnh} 
                      type="CNH" 
                    />
                  )}
                  {helper.rg_ajudante?.[0]?.foto_rg && (
                    <DocumentPreview 
                      url={helper.rg_ajudante[0].foto_rg} 
                      type="RG" 
                    />
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(helper.id_ajudante)}
                    className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(helper)}
                    className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <HelperForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        veiculo_id={veiculo_id}
        helper_id={selectedHelper}
        onSuccess={fetchHelpers}
      />

      <DeleteHelperModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        helper={helperToDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default HelperList;