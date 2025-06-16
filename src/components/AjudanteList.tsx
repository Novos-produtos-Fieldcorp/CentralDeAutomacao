import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Plus, User, Phone, FileText, Calendar, CreditCard, MapPin, Info } from 'lucide-react';
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
  cnh?: {
    nr_registro: number | null;
    categoria: string | null;
    nome_pai: string | null;
    nome_mae: string | null;
    foto_cnh: string | null;
  } | null;
  rg?: {
    nr_rg: number | null;
    data_emissao: string | null;
    orgao_expedidor: string | null;
    filiacao: string | null;
    foto_rg: string | null;
  } | null;
  endereco?: {
    logradouro?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  } | null;
}

const AjudanteList: React.FC<AjudanteListProps> = ({ veiculo_id }) => {
  const [ajudantes, setAjudantes] = useState<Ajudante[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAjudante, setSelectedAjudante] = useState<number | undefined>(undefined);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ajudanteToDelete, setAjudanteToDelete] = useState<Ajudante | null>(null);
  const [expandedAjudante, setExpandedAjudante] = useState<number | null>(null);

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
      
      // Fetch additional data for each ajudante
      const ajudantesWithDetails = await Promise.all((ajudantesData || []).map(async (ajudante) => {
        // Fetch CNH data
        const { data: cnhData } = await supabase
          .from('cnh_ajudante')
          .select('*')
          .eq('id_ajudante', ajudante.id_ajudante)
          .maybeSingle();
          
        // Fetch RG data
        const { data: rgData } = await supabase
          .from('rg_ajudante')
          .select('*')
          .eq('id_ajudante', ajudante.id_ajudante)
          .maybeSingle();
          
        // Fetch address data
        const { data: enderecoData } = await supabase
          .from('end_ajudante')
          .select(`
            nr_end,
            ds_complemento_end,
            logradouro (
              logradouro,
              nr_cep,
              bairro (
                bairro,
                cidade (
                  cidade,
                  estado (
                    sigla_estado
                  )
                )
              )
            )
          `)
          .eq('id_ajudante', ajudante.id_ajudante)
          .maybeSingle();
          
        // Combine all data
        return {
          ...ajudante,
          cnh: cnhData,
          rg: rgData,
          endereco: enderecoData ? {
            logradouro: enderecoData.logradouro?.logradouro,
            bairro: enderecoData.logradouro?.bairro?.bairro,
            cidade: enderecoData.logradouro?.bairro?.cidade?.cidade,
            estado: enderecoData.logradouro?.bairro?.cidade?.estado?.sigla_estado,
            cep: enderecoData.logradouro?.nr_cep
          } : null
        };
      }));
      
      setAjudantes(ajudantesWithDetails);
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

  const toggleExpandAjudante = (id: number) => {
    if (expandedAjudante === id) {
      setExpandedAjudante(null);
    } else {
      setExpandedAjudante(id);
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
        <div className="space-y-4">
          {ajudantes.map(ajudante => (
            <div key={ajudante.id_ajudante} className="space-y-2">
              <div 
                className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                onClick={() => toggleExpandAjudante(ajudante.id_ajudante)}
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
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {ajudante.cpf && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatCPF(ajudante.cpf)}
                          </p>
                        )}
                        {ajudante.telefone && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {formatPhone(ajudante.telefone)}
                          </p>
                        )}
                        {ajudante.genero && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {ajudante.genero === 'M' ? 'Masculino' : ajudante.genero === 'F' ? 'Feminino' : 'Outro'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(ajudante.id_ajudante);
                      }}
                      className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ajudante);
                      }}
                      className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {/* Document indicators */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {ajudante.comprovante_residencia && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                      <FileText className="w-3 h-3 mr-1" />
                      Comprovante
                    </span>
                  )}
                  {ajudante.cnh?.foto_cnh && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                      <CreditCard className="w-3 h-3 mr-1" />
                      CNH
                    </span>
                  )}
                  {ajudante.rg?.foto_rg && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200">
                      <FileText className="w-3 h-3 mr-1" />
                      RG
                    </span>
                  )}
                  {ajudante.endereco?.logradouro && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      <MapPin className="w-3 h-3 mr-1" />
                      Endereço
                    </span>
                  )}
                </div>
              </div>
              
              {/* Expanded details */}
              {expandedAjudante === ajudante.id_ajudante && (
                <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700 ml-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* CNH Information */}
                    {(ajudante.cnh?.nr_registro || ajudante.cnh?.categoria || ajudante.cnh?.nome_pai || ajudante.cnh?.nome_mae) && (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          Informações da CNH
                        </h5>
                        <div className="space-y-2">
                          {ajudante.cnh?.nr_registro && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Número:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.cnh.nr_registro}</p>
                            </div>
                          )}
                          {ajudante.cnh?.categoria && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Categoria:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.cnh.categoria}</p>
                            </div>
                          )}
                          {ajudante.cnh?.nome_pai && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Nome do Pai:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.cnh.nome_pai}</p>
                            </div>
                          )}
                          {ajudante.cnh?.nome_mae && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Nome da Mãe:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.cnh.nome_mae}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* RG Information */}
                    {(ajudante.rg?.nr_rg || ajudante.rg?.data_emissao || ajudante.rg?.orgao_expedidor) && (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          Informações do RG
                        </h5>
                        <div className="space-y-2">
                          {ajudante.rg?.nr_rg && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Número:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.rg.nr_rg}</p>
                            </div>
                          )}
                          {ajudante.rg?.orgao_expedidor && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Órgão Expedidor:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.rg.orgao_expedidor}</p>
                            </div>
                          )}
                          {ajudante.rg?.data_emissao && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Data de Emissão:</span>
                              <p className="text-sm text-gray-900 dark:text-white">
                                {new Date(ajudante.rg.data_emissao).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Address Information */}
                    {ajudante.endereco?.logradouro && (
                      <div className="space-y-3 md:col-span-2">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Endereço
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Logradouro:</span>
                            <p className="text-sm text-gray-900 dark:text-white">{ajudante.endereco.logradouro}</p>
                          </div>
                          {ajudante.endereco.bairro && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Bairro:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.endereco.bairro}</p>
                            </div>
                          )}
                          {ajudante.endereco.cidade && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Cidade:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.endereco.cidade}</p>
                            </div>
                          )}
                          {ajudante.endereco.estado && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Estado:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{ajudante.endereco.estado}</p>
                            </div>
                          )}
                          {ajudante.endereco.cep && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">CEP:</span>
                              <p className="text-sm text-gray-900 dark:text-white">{formatCEP(ajudante.endereco.cep)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
    </div>
  );
};

export default AjudanteList;