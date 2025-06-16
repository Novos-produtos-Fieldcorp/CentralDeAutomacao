import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Plus, User, Phone, FileText, Camera, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import AjudanteForm from './AjudanteForm';
import { formatCPF, formatPhone } from '../utils/format';

interface AjudanteListProps {
  veiculo_id: number;
}

interface Ajudante {
  id_ajudante: number;
  nome: string;
  cpf: string;
  telefone: string;
  genero: string;
  comprovante_residencia: string | null;
  veiculo_id: number;
  foto_cnh?: string | null;
  foto_rg?: string | null;
}

interface AjudanteWithDocuments extends Ajudante {
  cnh_ajudante?: {
    foto_cnh: string | null;
  }[];
  rg_ajudante?: {
    foto_rg: string | null;
  }[];
}

const AjudanteList: React.FC<AjudanteListProps> = ({ veiculo_id }) => {
  const [ajudantes, setAjudantes] = useState<AjudanteWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAjudante, setSelectedAjudante] = useState<number | undefined>(undefined);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ajudanteToDelete, setAjudanteToDelete] = useState<Ajudante | null>(null);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);

  useEffect(() => {
    fetchAjudantes();
  }, [veiculo_id]);

  const fetchAjudantes = async () => {
    try {
      setLoading(true);
      
      // Fetch basic ajudante data
      const { data: ajudantesData, error: ajudantesError } = await supabase
        .from('documento_ajudante')
        .select('*')
        .eq('veiculo_id', veiculo_id);

      if (ajudantesError) throw ajudantesError;
      
      // For each ajudante, fetch their documents
      const ajudantesWithDocs = await Promise.all((ajudantesData || []).map(async (ajudante) => {
        // Fetch CNH data
        const { data: cnhData } = await supabase
          .from('cnh_ajudante')
          .select('foto_cnh')
          .eq('id_ajudante', ajudante.id_ajudante)
          .maybeSingle();
          
        // Fetch RG data
        const { data: rgData } = await supabase
          .from('rg_ajudante')
          .select('foto_rg')
          .eq('id_ajudante', ajudante.id_ajudante)
          .maybeSingle();
          
        return {
          ...ajudante,
          foto_cnh: cnhData?.foto_cnh || null,
          foto_rg: rgData?.foto_rg || null
        };
      }));
      
      setAjudantes(ajudantesWithDocs);
    } catch (error) {
      console.error('Error fetching ajudantes:', error);
      toast.error('Erro ao carregar ajudantes');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ajudante_id: number) => {
    setSelectedAjudante(ajudante_id);
    setIsFormOpen(true);
  };

  const handleDelete = (ajudante: Ajudante) => {
    setAjudanteToDelete(ajudante);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!ajudanteToDelete) return;
    
    try {
      const { error } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', ajudanteToDelete.id_ajudante);
        
      if (error) throw error;
      
      setAjudantes(ajudantes.filter(a => a.id_ajudante !== ajudanteToDelete.id_ajudante));
      toast.success('Ajudante excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting ajudante:', error);
      toast.error('Erro ao excluir ajudante');
    }
  };

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Ajudantes
        </h3>
        <button
          onClick={() => {
            setSelectedAjudante(undefined);
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : ajudantes.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum ajudante cadastrado para este veículo
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {ajudantes.map(ajudante => (
            <div 
              key={ajudante.id_ajudante}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white">
                      {ajudante.nome}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {ajudante.cpf ? formatCPF(ajudante.cpf) : 'CPF não informado'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(ajudante.id_ajudante)}
                    className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(ajudante)}
                    className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ajudante.telefone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{formatPhone(ajudante.telefone)}</span>
                  </div>
                )}
              </div>

              {/* Document thumbnails */}
              <div className="mt-3 flex flex-wrap gap-3">
                {ajudante.comprovante_residencia && (
                  <div className="flex flex-col items-center gap-1">
                    <div 
                      className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 overflow-hidden cursor-pointer"
                      onClick={() => setActiveDocument(ajudante.comprovante_residencia)}
                    >
                      {isPdf(ajudante.comprovante_residencia) ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                          <FileText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                        </div>
                      ) : (
                        <img 
                          src={ajudante.comprovante_residencia} 
                          alt="Comprovante" 
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Comprovante</span>
                  </div>
                )}

                {ajudante.foto_cnh && (
                  <div className="flex flex-col items-center gap-1">
                    <div 
                      className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 overflow-hidden cursor-pointer"
                      onClick={() => setActiveDocument(ajudante.foto_cnh)}
                    >
                      {isPdf(ajudante.foto_cnh) ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                          <FileText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                        </div>
                      ) : (
                        <img 
                          src={ajudante.foto_cnh} 
                          alt="CNH" 
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">CNH</span>
                  </div>
                )}

                {ajudante.foto_rg && (
                  <div className="flex flex-col items-center gap-1">
                    <div 
                      className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 overflow-hidden cursor-pointer"
                      onClick={() => setActiveDocument(ajudante.foto_rg)}
                    >
                      {isPdf(ajudante.foto_rg) ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                          <FileText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                        </div>
                      ) : (
                        <img 
                          src={ajudante.foto_rg} 
                          alt="RG" 
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">RG</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Ajudante Modal */}
      <AjudanteForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        veiculo_id={veiculo_id}
        ajudante_id={selectedAjudante}
        onSuccess={fetchAjudantes}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && ajudanteToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Confirmar Exclusão
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir o ajudante <span className="font-medium">{ajudanteToDelete.nome}</span>?
              </p>
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen document viewer */}
      {activeDocument && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setActiveDocument(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Visualização do Documento
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openDocumentInNewTab(activeDocument)}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Abrir em nova aba"
                >
                  <ExternalLink size={20} />
                </button>
                <button
                  onClick={() => setActiveDocument(null)}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="relative h-[calc(90vh-80px)]">
              {isPdf(activeDocument) ? (
                <iframe 
                  src={`${activeDocument}#toolbar=1`} 
                  className="w-full h-full" 
                  title="PDF Viewer"
                />
              ) : (
                <img
                  src={activeDocument}
                  alt="Documento"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AjudanteList;