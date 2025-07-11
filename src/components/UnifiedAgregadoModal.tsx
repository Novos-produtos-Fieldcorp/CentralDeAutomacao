import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Format CPF function is now defined at the top of the files directly since the utils module is not found
const formatCPF = (cpf: string): string => {
  if (!cpf) return '';
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatPhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

const formatCEP = (cep: string): string => {
  if (!cep) return '';
  return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
};

import { toast } from 'sonner';
import { X, Edit2 } from 'lucide-react';

// Types
interface Veiculo {
  veiculo_id: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  cor?: string;
  tipo_veiculo?: string;
}

interface DocumentoMotorista {
  id: string;
  motorista_id: string;
  foto_cnh?: string;
  foto_comprovante_residencia?: string;
  cnh_url?: string; // Added for compatibility
  comprovante_residencia_url?: string; // Added for compatibility
}

interface DocumentoAjudante {
  id_ajudante: string;
  motorista_id: string;
  nome?: string;
  cpf?: string;
  telefone?: string;
}

interface MotoristaBase {
  motorista_id: number;
  nome_motorista: string;
  cpf: string | null;
  telefone: string | number | null;
  email: string | null;
  veiculo_id: number | null;
  endereco_id: number | null;
  logradouro?: string | null;
  nome_cidade?: string | null;
  sigla_estado?: string | null;
  nr_cep?: string | null;
  nome_bairro?: string | null;
  nr_end?: string | null;
  ds_complemento_end?: string | null;
  [key: string]: any; // Allow additional properties
}

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  motorista: MotoristaBase | null;
  onClose?: () => void;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ 
  isOpen, 
  motorista, 
  onClose = () => {},
  onSuccess = () => {}
}: UnifiedAgregadoModalProps) => {
  // State for active tab
  const [activeTab, setActiveTab] = useState<'detalhes' | 'documentos' | 'veiculo' | 'ajudantes' | 'gestao-risco' | 'comentarios'>('detalhes');
  
  // State for modal
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [documentoMotorista, setDocumentoMotorista] = useState<DocumentoMotorista | null>(null);
  const [ajudantes, setAjudantes] = useState<DocumentoAjudante[]>([]);
  const [ajudantesCount, setAjudantesCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [gestaoRiscoCount] = useState(0);
  const [comentariosCount] = useState(0);
  
  // Modal states - removed unused state setters since they're not needed
  
  // Helper function to get document URL with fallback
  const getDocumentUrl = (doc: DocumentoMotorista | null, type: 'cnh' | 'comprovante'): string | undefined => {
    if (!doc) return undefined;
    if (type === 'cnh') {
      return doc.foto_cnh || doc.cnh_url;
    } else {
      return doc.foto_comprovante_residencia || doc.comprovante_residencia_url;
    }
  };
  
  // Fetch all data when modal opens or motorista changes
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !motorista?.motorista_id) return;
      
      try {
        // Fetch veiculo
        if (motorista.veiculo_id) {
          const { data: veiculoData } = await supabase
            .from('veiculo')
            .select('*')
            .eq('veiculo_id', motorista.veiculo_id)
            .single();
          
          if (veiculoData) {
            setVeiculo(veiculoData);
          }
        }
        
        // Fetch documento_motorista
        const { data: docData } = await supabase
          .from('documento_motorista')
          .select('*')
          .eq('motorista_id', motorista.motorista_id)
          .single();
        
        if (docData) {
          setDocumentoMotorista(docData);
          setDocumentCount(1); // Assuming one document per motorista
        }
        
        // Fetch ajudantes
        const { data: ajudantesData } = await supabase
          .from('documento_ajudante')
          .select('*')
          .eq('motorista_id', motorista.motorista_id);
        
        if (ajudantesData) {
          setAjudantes(ajudantesData);
          setAjudantesCount(ajudantesData.length);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Erro ao carregar os dados. Tente novamente.');
      }
    };
    
    fetchData();
  }, [isOpen, motorista]);
  
  // Helper functions
  const handleEditAjudante = (ajudante: DocumentoAjudante) => {
    // This would open the edit modal if implemented
    console.log('Edit ajudante:', ajudante);
  };

  const handleDeleteAjudante = async (ajudante: DocumentoAjudante) => {
    if (!confirm('Tem certeza que deseja excluir este ajudante? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      // First delete any related records in cnh_ajudante
      const { error: cnhError } = await supabase
        .from('cnh_ajudante')
        .delete()
        .eq('ajudante_id', ajudante.id_ajudante);

      if (cnhError) throw cnhError;

      // Then delete the ajudante
      const { error: deleteError } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', ajudante.id_ajudante);

      if (deleteError) throw deleteError;

      // Update the list of ajudantes
      const { data, error: fetchError } = await supabase
        .from('documento_ajudante')
        .select('*')
        .eq('motorista_id', motorista?.motorista_id);
        
      if (!fetchError && data) {
        setAjudantes(data);
        setAjudantesCount(data.length);
        toast.success('Ajudante removido com sucesso!');
      }
    } catch (error) {
      console.error('Error deleting ajudante:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir ajudante');
    }
  };

  const handleAjudanteAdded = async () => {
    if (!motorista?.motorista_id) return;
    
    const { data, error } = await supabase
      .from('documento_ajudante')
      .select('*')
      .eq('motorista_id', motorista.motorista_id);
      
    if (!error && data) {
      setAjudantes(data);
      setAjudantesCount(data.length);
      toast.success('Ajudante adicionado com sucesso!');
    }
  };

  const handleAjudanteUpdated = async () => {
    if (!motorista?.motorista_id) return;
    
    const { data, error } = await supabase
      .from('documento_ajudante')
      .select('*')
      .eq('motorista_id', motorista.motorista_id);
      
    if (!error && data) {
      setAjudantes(data);
      setAjudantesCount(data.length);
      toast.success('Ajudante atualizado com sucesso!');
    }
  };

  const renderVeiculoTab = () => {
    if (!veiculo) {
      return <p className="text-gray-500 dark:text-gray-400">Nenhum veículo cadastrado.</p>;
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Marca</p>
            <p className="font-medium">{veiculo.marca || 'Não informada'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Modelo</p>
            <p className="font-medium">{veiculo.modelo || 'Não informado'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Placa</p>
            <p className="font-medium">{veiculo.placa || 'Não informada'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ano</p>
            <p className="font-medium">{veiculo.ano || 'Não informado'}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderDocumentosTab = () => {
    if (!documentoMotorista) {
      return <p className="text-gray-500 dark:text-gray-400">Nenhum documento encontrado.</p>;
    }

    const cnhUrl = getDocumentUrl(documentoMotorista, 'cnh');
    const comprovanteUrl = getDocumentUrl(documentoMotorista, 'comprovante');

    return (
      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">CNH</h3>
          {cnhUrl ? (
            <div className="flex items-center space-x-2">
              <a
                href={cnhUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Visualizar CNH
              </a>
            </div>
          ) : (
            <p className="text-gray-500">Nenhuma CNH cadastrada</p>
          )}
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Comprovante de Residência</h3>
          {comprovanteUrl ? (
            <div className="flex items-center space-x-2">
              <a
                href={comprovanteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Visualizar Comprovante
              </a>
            </div>
          ) : (
            <p className="text-gray-500">Nenhum comprovante cadastrado</p>
          )}
        </div>
      </div>
    );
  };

  const renderAjudantesTab = () => {
    if (ajudantes.length === 0) {
      return <p className="text-gray-500 dark:text-gray-400">Nenhum ajudante cadastrado.</p>;
    }

    return (
      <div className="space-y-4">
        {ajudantes.map((ajudante) => (
          <div key={ajudante.id_ajudante} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{ajudante.nome || 'Ajudante sem nome'}</h3>
                <p className="text-sm text-gray-500">
                  {ajudante.telefone ? formatPhone(ajudante.telefone) : 'Sem telefone'}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditAjudante(ajudante)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteAjudante(ajudante)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen || !motorista) return null;

  // Ensure we have the motorista data
  const nome = motorista.nome_motorista || '';
  const cpf = motorista.cpf ? formatCPF(motorista.cpf) : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {nome || 'Detalhes do Agregado'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <span className="sr-only">Fechar</span>
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Basic Info */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {nome || 'Nome não disponível'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              CPF: {cpf ? formatCPF(cpf) : 'Não informado'}
            </p>
            {motorista.telefone && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Telefone: {formatPhone(motorista.telefone.toString())}
              </p>
            )}
            {motorista.email && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Email: {motorista.email}
              </p>
            )}
          </div>
          
          {/* Tabs Navigation */}
          <nav className="flex space-x-8 border-b border-gray-200 dark:border-gray-700">
            <button
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'detalhes'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveTab('detalhes')}
            >
              <span>👤</span>
              <span>Detalhes</span>
            </button>
            
            <button
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'documentos'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveTab('documentos')}
            >
              <span>📁</span>
              <span>Documentos</span>
              {documentCount > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                  {documentCount}
                </span>
              )}
            </button>
            
            <button
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'veiculo'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveTab('veiculo')}
            >
              <span>🚚</span>
              <span>Veículo</span>
            </button>
            
            <button
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'ajudantes'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveTab('ajudantes')}
            >
              <span>👥</span>
              <span>Ajudantes</span>
              {ajudantesCount > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                  {ajudantesCount}
                </span>
              )}
            </button>
            
            <button
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'gestao-risco'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveTab('gestao-risco')}
            >
              <span>🛡️</span>
              <span>Gestão de Risco</span>
              {gestaoRiscoCount > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                  {gestaoRiscoCount}
                </span>
              )}
            </button>
            
            <button
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'comentarios'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveTab('comentarios')}
            >
              <span>💬</span>
              <span>Comentários</span>
              {comentariosCount > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                  {comentariosCount}
                </span>
              )}
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {activeTab === 'detalhes' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Informações Pessoais</h3>
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">Nome Completo</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                    {nome || 'Não informado'}
                  </dd>
                </div>
                <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50 dark:bg-gray-700">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">CPF</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                    {cpf ? formatCPF(cpf) : 'Não informado'}
                  </dd>
                </div>
                {motorista.telefone && (
                  <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">Telefone</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                      {formatPhone(motorista.telefone.toString())}
                    </dd>
                  </div>
                )}
                {motorista.email && (
                  <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50 dark:bg-gray-700">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                      {motorista.email}
                    </dd>
                  </div>
                )}
                {motorista.logradouro && (
                  <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">Endereço</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                      {`${motorista.logradouro}${motorista.nr_end ? `, ${motorista.nr_end}` : ''}${motorista.ds_complemento_end ? ` - ${motorista.ds_complemento_end}` : ''}`}
                    </dd>
                  </div>
                )}
                {(motorista.nome_bairro || motorista.nome_cidade || motorista.sigla_estado || motorista.nr_cep) && (
                  <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50 dark:bg-gray-700">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">Localização</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                      {[
                        motorista.nome_bairro,
                        motorista.nome_cidade,
                        motorista.sigla_estado
                      ].filter(Boolean).join(' - ')}
                      {motorista.nr_cep && (
                        <span className="block mt-1">
                          CEP: {formatCEP(motorista.nr_cep)}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => {}}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar Dados
                </button>
              </div>
            </div>
          )}
          
          {activeTab === 'documentos' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Documentos</h3>
                <button
                  onClick={() => {}}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="-ml-0.5 mr-1.5">+</span>
                  Adicionar Documento
                </button>
              </div>
              
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">CNH</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                    {documentoMotorista?.cnh_url ? (
                      <div className="flex items-center space-x-2">
                        <span>Documento anexado</span>
                        <button
                          onClick={() => {}}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Nenhum documento anexado</span>
                    )}
                  </dd>
                </div>
                <div className="px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50 dark:bg-gray-700">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">Comprovante de Residência</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                    {documentoMotorista?.comprovante_residencia_url ? (
                      <div className="flex items-center space-x-2">
                        <span>Documento anexado</span>
                        <button
                          onClick={() => {}}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Nenhum documento anexado</span>
                    )}
                  </dd>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'veiculo' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Veículo</h3>
              
              {renderVeiculoTab()}
            </div>
          )}
          
          {activeTab === 'ajudantes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Ajudantes</h3>
                <button
                  type="button"
                  onClick={() => {}}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="-ml-0.5 mr-1.5">+</span>
                  Adicionar Ajudante
                </button>
              </div>
              
              {renderAjudantesTab()}
            </div>
          )}
          
          {activeTab === 'gestao-risco' && (
            <div className="p-4">
              <p className="text-gray-500">Gestão de Risco (em desenvolvimento)</p>
            </div>
          )}
          {activeTab === 'comentarios' && (
            <div className="p-4">
              <p className="text-gray-500">Comentários (em desenvolvimento)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UnifiedAgregadoModal;