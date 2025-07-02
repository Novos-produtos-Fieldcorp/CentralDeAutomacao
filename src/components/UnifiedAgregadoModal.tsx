import React, { useState, useEffect } from 'react';
import { 
  X, Truck, User, MapPin, Phone, CreditCard, FileText, Camera, 
  CheckCircle2, XCircle, ExternalLink, Home, Edit2, Users, ShieldAlert, MessageSquare 
} from 'lucide-react';
import type { 
  DocumentoMotorista, 
  Veiculo, 
  DocumentoVeiculo, 
  Motorista,
  PessoaFisicaDonoVeiculo,
  PessoaJuridicaDonoVeiculo
} from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import EditMotoristaModal from './EditMotoristaModal';
import AddAjudanteModal from './AddAjudanteModal';
import EditAjudanteModal from './EditAjudanteModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import GestaoRiscoTab from './GestaoRiscoTab';
import ComentariosTab from './ComentariosTab';

interface AgregadoDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  agregado?: Motorista | null;
  onSuccess?: () => void;
  documento: DocumentoMotorista | null;
  veiculo: (Veiculo & {
    documento_veiculo: (DocumentoVeiculo & {
      pessoa_fisica_dono_veiculo?: PessoaFisicaDonoVeiculo;
      pessoa_juridica_dono_veiculo?: PessoaJuridicaDonoVeiculo;
    })[];
  }) | null;
  endereco?: {
    logradouro?: {
      logradouro?: string;
      nr_cep?: string;
      bairro?: {
        bairro?: string;
        cidade?: {
          cidade?: string;
          estado?: {
            sigla_estado?: string;
          };
        };
      };
    };
    nr_end?: number;
    ds_complemento_end?: string;
  } | null;
  ajudantes?: any[];
}

const AgregadoDetailView: React.FC<AgregadoDetailViewProps> = ({
  isOpen,
  onClose,
  agregado,
  documento,
  veiculo,
  endereco,
  ajudantes = [],
  onSuccess
}) => {
  const [isEditingDocuments, setIsEditingDocuments] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [isEditAjudanteModalOpen, setIsEditAjudanteModalOpen] = useState(false);
  const [isDeleteAjudanteModalOpen, setIsDeleteAjudanteModalOpen] = useState(false);
  const [selectedAjudante, setSelectedAjudante] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'ajudantes' | 'gestao-risco' | 'comentarios'>('details');

  if (!isOpen || !agregado) return null;

  // Ensure we have the agregado data
  const nome = agregado.nome || '';
  const cpf = agregado.cpf || '';

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  const handleEditAjudante = (ajudante: any) => {
    setSelectedAjudante(ajudante);
    setIsEditAjudanteModalOpen(true);
  };

  const handleDeleteAjudante = (ajudante: any) => {
    setSelectedAjudante(ajudante);
    setIsDeleteAjudanteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAjudante) return;
    
    try {
      // Add your delete logic here
      toast.success('Ajudante excluído com sucesso!');
      setIsDeleteAjudanteModalOpen(false);
      setSelectedAjudante(null);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao excluir ajudante:', error);
      toast.error('Erro ao excluir ajudante');
    }
  };
  
  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Agregado • {formatCPF(cpf)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'details'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Detalhes
                </button>
                <button
                  onClick={() => setActiveTab('ajudantes')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'ajudantes'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Ajudantes
                </button>
                <button
                  onClick={() => setActiveTab('gestao-risco')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'gestao-risco'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4" />
                    Gestão de Risco
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('comentarios')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'comentarios'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    Comentários
                  </div>
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === 'details' ? (
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                        Informações Pessoais
                      </h3>
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Editar
                      </button>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                      <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Nome Completo
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {nome}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            CPF
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {formatCPF(cpf)}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Data de Nascimento
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {agregado.dt_nascimento ? formatDate(agregado.dt_nascimento) : 'Não informada'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Telefone
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {agregado.telefone ? formatPhone(agregado.telefone.toString()) : 'Não informado'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            E-mail
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {agregado.email || 'Não informado'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  {veiculo && (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                          Veículo
                        </h3>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                        <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Placa
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.placa}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Marca/Modelo
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.marca} {veiculo.tipologia}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Ano
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.ano}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'ajudantes' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Ajudantes
                    </h3>
                    <button
                      onClick={() => setIsAddAjudanteModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Adicionar Ajudante
                    </button>
                  </div>
                  
                  {ajudantes.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {ajudantes.map((ajudante) => (
                          <li key={ajudante.id_ajudante} className="px-4 py-4 sm:px-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {ajudante.nome}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {ajudante.cpf ? formatCPF(ajudante.cpf.toString()) : 'CPF não informado'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditAjudante(ajudante)}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <Edit2 className="w-4 h-4 mr-1" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteAjudante(ajudante)}
                                  className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 shadow-sm text-xs font-medium rounded-md text-red-700 dark:text-red-200 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Excluir
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        Nenhum ajudante encontrado
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Adicione um novo ajudante para começar.
                      </p>
                      <div className="mt-6">
                        <button
                          onClick={() => setIsAddAjudanteModalOpen(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Edit2 className="-ml-1 mr-2 h-5 w-5" />
                          Adicionar Ajudante
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'gestao-risco' ? (
                <GestaoRiscoTab 
                  motorista_id={agregado.motorista_id}
                  gr_motorista_id={agregado.gr_motorista_id}
                  gr_motorista_motivo={agregado.gr_motorista_motivo}
                  empresa_motorista={agregado.empresa_motorista}
                  status_motorista={agregado.status_motorista}
                  onUpdateSuccess={onSuccess}
                />
              ) : (
                <ComentariosTab 
                  motorista_id={agregado.motorista_id}
                  onUpdateSuccess={onSuccess}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isEditModalOpen && (
        <EditMotoristaModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          motorista={agregado}
          onUpdate={() => {
            setIsEditModalOpen(false);
            onSuccess?.();
          }}
        />
      )}

      <AddAjudanteModal
        isOpen={isAddAjudanteModalOpen}
        onClose={() => setIsAddAjudanteModalOpen(false)}
        motorista_id={agregado.motorista_id}
        veiculo_id={veiculo?.veiculo_id}
        onSuccess={() => {
          setIsAddAjudanteModalOpen(false);
          onSuccess?.();
        }}
      />

      {isEditAjudanteModalOpen && selectedAjudante && (
        <EditAjudanteModal
          isOpen={isEditAjudanteModalOpen}
          onClose={() => {
            setIsEditAjudanteModalOpen(false);
            setSelectedAjudante(null);
          }}
          ajudante={selectedAjudante}
          onSuccess={() => {
            setIsEditAjudanteModalOpen(false);
            setSelectedAjudante(null);
            onSuccess?.();
          }}
        />
      )}

      {isDeleteAjudanteModalOpen && selectedAjudante && (
        <DeleteConfirmationModal
          isOpen={isDeleteAjudanteModalOpen}
          onClose={() => {
            setIsDeleteAjudanteModalOpen(false);
            setSelectedAjudante(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Excluir Ajudante"
          message={`Tem certeza que deseja excluir o ajudante "${selectedAjudante.nome}"? Esta ação não pode ser desfeita.`}
        />
      )}
    </div>
  );
};

export default AgregadoDetailView;