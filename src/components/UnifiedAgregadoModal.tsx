import React, { useState, useRef, useEffect } from 'react';
import { X, Truck, MapPin, FileText, Camera, Loader2, ExternalLink, Upload, Save, ArrowLeft, Users, User, Home, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import AddAjudanteModal from './AddAjudanteModal';
import EditAjudanteModal from './EditAjudanteModal';
import EditMotoristaModal from './EditMotoristaModal';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import VehicleDocumentsModal from './veiculos/VehicleDocumentsModal';

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: any;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'helpers'>('details');
  const [loading, setLoading] = useState(true);
  const [motoristaData, setMotoristaData] = useState<any | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [veiculo, setVeiculo] = useState<any | null>(null);
  const [documento, setDocumento] = useState<any | null>(null);
  const [documentoVeiculo, setDocumentoVeiculo] = useState<any | null>(null);
  const [ajudantes, setAjudantes] = useState<any[]>([]);
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [isEditAjudanteModalOpen, setIsEditAjudanteModalOpen] = useState(false);
  const [isEditMotoristaModalOpen, setIsEditMotoristaModalOpen] = useState(false);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const [isVehicleDocumentsModalOpen, setIsVehicleDocumentsModalOpen] = useState(false);
  const [selectedAjudante, setSelectedAjudante] = useState<any | null>(null);
  const [uploading, setUploading] = useState<{cnh: boolean, comprovante: boolean, crv: boolean}>({
    cnh: false,
    comprovante: false,
    crv: false
  });
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && motorista) {
      fetchData();
    }
  }, [isOpen, motorista]);

  const fetchData = async () => {
    if (!motorista) return;
    
    try {
      setLoading(true);
      
      // Fetch motorista details first
      const { data: motoristaDetails, error: motoristaError } = await supabase
        .from('motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .single();
      
      if (motoristaError) throw motoristaError;
      setMotoristaData(motoristaDetails);
      
      // Fetch address - Fixed column name from motorista_id to id_motorista
      const { data: enderecoData, error: enderecoError } = await supabase
        .from('end_motorista')
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
        .eq('id_motorista', motorista.motorista_id)
        .maybeSingle();
      
      if (enderecoError && enderecoError.code !== 'PGRST116') throw enderecoError;
      setEndereco(enderecoData);
      
      // Fetch vehicle
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculo')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .eq('status_veiculo', true)
        .maybeSingle();
      
      if (veiculoError && veiculoError.code !== 'PGRST116') throw veiculoError;
      setVeiculo(veiculoData);
      
      // Fetch documents
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
      
      if (documentoError && documentoError.code !== 'PGRST116') throw documentoError;
      setDocumento(documentoData);
      
      // Fetch vehicle documents if vehicle exists
      if (veiculoData) {
        const { data: docVeiculoData, error: docVeiculoError } = await supabase
          .from('documento_veiculo')
          .select('*')
          .eq('veiculo_id', veiculoData.veiculo_id)
          .maybeSingle();
        
        if (docVeiculoError && docVeiculoError.code !== 'PGRST116') throw docVeiculoError;
        setDocumentoVeiculo(docVeiculoData);
      }
      
      // Fetch ajudantes
      const { data: ajudantesData, error: ajudantesError } = await supabase
        .from('documento_ajudante')
        .select(`
          *,
          cnh_ajudante(*),
          rg_ajudante(*),
          end_ajudante(nr_end, ds_complemento_end, logradouro(logradouro, nr_cep, bairro(bairro, cidade(cidade, estado(sigla_estado)))))
        `)
        .eq('motorista_id', motorista.motorista_id);
      
      if (ajudantesError) throw ajudantesError;
      setAjudantes(ajudantesData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cnh' | 'comprovante' | 'crv') => {
    const file = e.target.files?.[0];
    if (!file || !motorista) return;
    
    try {
      setUploading(prev => ({ ...prev, [type]: true }));
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${motorista.motorista_id}_${type}_${Date.now()}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, file);
        
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);
      
      // Update the appropriate document record
      if (type === 'cnh' || type === 'comprovante') {
        // Check if documento_motorista exists
        if (documento) {
          // Update existing record
          const updateData = type === 'cnh' 
            ? { foto_cnh: publicUrl } 
            : { foto_comprovante_residencia: publicUrl };
          
          const { error: updateError } = await supabase
            .from('documento_motorista')
            .update(updateData)
            .eq('id_documento_motorista', documento.id_documento_motorista);
          
          if (updateError) throw updateError;
        } else {
          // Create new record
          const insertData = {
            motorista_id: motorista.motorista_id,
            foto_cnh: type === 'cnh' ? publicUrl : null,
            foto_comprovante_residencia: type === 'comprovante' ? publicUrl : null
          };
          
          const { error: insertError } = await supabase
            .from('documento_motorista')
            .insert(insertData);
          
          if (insertError) throw insertError;
        }
        
        // Update local state
        setDocumento(prev => ({
          ...prev,
          [type === 'cnh' ? 'foto_cnh' : 'foto_comprovante_residencia']: publicUrl
        }));
      } else if (type === 'crv' && veiculo) {
        // Check if documento_veiculo exists
        if (documentoVeiculo) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('documento_veiculo')
            .update({ foto_crv: publicUrl })
            .eq('id_documento_veiculo', documentoVeiculo.id_documento_veiculo);
            
          if (updateError) throw updateError;
        } else {
          // Create new record
          const { error: insertError } = await supabase
            .from('documento_veiculo')
            .insert({
              veiculo_id: veiculo.veiculo_id,
              foto_crv: publicUrl
            });
            
          if (insertError) throw insertError;
        }
        
        // Update local state
        setDocumentoVeiculo(prev => ({
          ...prev,
          foto_crv: publicUrl
        }));
      }
      
      toast.success('Documento enviado com sucesso');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  const handleAddAjudante = () => {
    setIsAddAjudanteModalOpen(true);
  };

  const handleEditAjudante = (ajudante: any) => {
    setSelectedAjudante(ajudante);
    setIsEditAjudanteModalOpen(true);
  };

  const handleDeleteAjudante = async (ajudante: any) => {
    try {
      const { error } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', ajudante.id_ajudante);
      
      if (error) throw error;
      
      toast.success('Ajudante excluído com sucesso');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting ajudante:', error);
      toast.error('Erro ao excluir ajudante');
    }
  };

  if (!isOpen || !motorista) return null;

  // Ensure we have the agregado data
  const nome = motoristaData?.nome || '';
  const cpf = motoristaData?.cpf || '';

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
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'details'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Detalhes
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'documents'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Documentos
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('helpers')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'helpers'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Ajudantes
                  </div>
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Details Tab */}
                  {activeTab === 'details' && (
                    <div className="space-y-6">
                      {/* Personal Information */}
                      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                            Informações Pessoais
                          </h3>
                          <button
                            onClick={() => setIsEditMotoristaModalOpen(true)}
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
                                {motoristaData?.dt_nascimento ? formatDate(motoristaData.dt_nascimento) : 'Não informado'}
                              </dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                Telefone
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                {motoristaData?.telefone ? formatPhone(motoristaData.telefone.toString()) : 'Não informado'}
                              </dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                E-mail
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                {motoristaData?.email || 'Não informado'}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      {/* Address Information */}
                      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-gray-400" />
                            Endereço
                          </h3>
                          <button
                            onClick={() => setIsEditMotoristaModalOpen(true)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Editar
                          </button>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                          {endereco ? (
                            <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Logradouro
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {endereco.logradouro?.logradouro ? 
                                    `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                                    'Não informado'
                                  }
                                </dd>
                              </div>
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Complemento
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {endereco.ds_complemento_end || 'Não informado'}
                                </dd>
                              </div>
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  CEP
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {endereco.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                                </dd>
                              </div>
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Bairro
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {endereco.logradouro?.bairro?.bairro || 'Não informado'}
                                </dd>
                              </div>
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Cidade/Estado
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {endereco.logradouro?.bairro?.cidade?.cidade || 'Não informada'}/{endereco.logradouro?.bairro?.cidade?.estado?.sigla_estado || '-'}
                                </dd>
                              </div>
                            </dl>
                          ) : (
                            <div className="px-6 py-4">
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nenhum endereço cadastrado
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vehicle Information */}
                      {veiculo && (
                        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              <Truck className="w-5 h-5 text-gray-400" />
                              Veículo
                            </h3>
                            <button
                              onClick={() => setIsVehicleDocumentsModalOpen(true)}
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
                                  Placa
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {veiculo.placa.toUpperCase()}
                                </dd>
                              </div>
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Marca/Modelo
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {veiculo.marca} {veiculo.tipo}
                                </dd>
                              </div>
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Ano
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {veiculo.ano || 'Não informado'}
                                </dd>
                              </div>
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Tipologia
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {veiculo.tipologia || 'Não informada'}
                                </dd>
                              </div>
                              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Rastreador
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {veiculo.possui_rastreador ? 
                                    `Sim (${veiculo.marca_rastreador || 'Marca não informada'})` : 
                                    'Não possui'
                                  }
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Documents Tab */}
                  {activeTab === 'documents' && (
                    <div className="space-y-6">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setIsDocumentFormOpen(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                   transition-colors flex items-center gap-2"
                        >
                          <Edit2 className="w-5 h-5" />
                          Editar Documentos
                        </button>
                      </div>
                      
                      {/* CNH Document */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                          CNH
                        </h3>
                        
                        {documento?.foto_cnh ? (
                          <div className="relative aspect-[1.414] w-full max-w-md bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            {isPdf(documento.foto_cnh) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                <button
                                  onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                >
                                  <ExternalLink size={16} />
                                  Abrir PDF
                                </button>
                              </div>
                            ) : (
                              <img
                                src={documento.foto_cnh}
                                alt="CNH"
                                className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                onClick={() => setActiveDocument(documento.foto_cnh)}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type="file"
                              id="file-cnh"
                              onChange={(e) => handleFileUpload(e, 'cnh')}
                              className="sr-only"
                              ref={fileInputRef}
                              accept="image/jpeg,image/png,image/jpg,application/pdf"
                            />
                            <label
                              htmlFor="file-cnh"
                              className="flex flex-col items-center justify-center w-full max-w-md aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                        border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                        hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {uploading.cnh ? (
                                  <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
                                ) : (
                                  <Camera className="w-10 h-10 text-gray-400 mb-4" />
                                )}
                                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                                  <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  JPEG, PNG ou PDF (máx. 15MB)
                                </p>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                      
                      {/* Comprovante de Residência */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <Home className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                          Comprovante de Residência
                        </h3>
                        
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Comprovante Digital</p>
                          
                          {documento?.foto_comprovante_residencia ? (
                            <div className="relative aspect-[1.414] w-full max-w-md bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {isPdf(documento.foto_comprovante_residencia) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                  <button
                                    onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                  >
                                    <ExternalLink size={16} />
                                    Abrir PDF
                                  </button>
                                </div>
                              ) : (
                                <img
                                  src={documento.foto_comprovante_residencia}
                                  alt="Comprovante de Residência"
                                  className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                  onClick={() => setActiveDocument(documento.foto_comprovante_residencia)}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="file"
                                id="file-comprovante"
                                onChange={(e) => handleFileUpload(e, 'comprovante')}
                                className="sr-only"
                                ref={fileInputRef}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                              />
                              <label
                                htmlFor="file-comprovante"
                                className="flex flex-col items-center justify-center w-full max-w-md aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                          border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                          hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                              >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  {uploading.comprovante ? (
                                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
                                  ) : (
                                    <Camera className="w-10 h-10 text-gray-400 mb-4" />
                                  )}
                                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    JPEG, PNG ou PDF (máx. 15MB)
                                  </p>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* CRV Document */}
                      {veiculo && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            CRV do Veículo
                          </h3>
                          
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg mb-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</span>
                                
                                <p className="text-base font-semibold text-gray-900 dark:text-white uppercase">{veiculo.placa}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca</span>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">{veiculo.marca}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Modelo</span>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">{veiculo.tipo}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mb-2 flex justify-between items-center">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              CRV Digital
                            </label>
                            {documentoVeiculo?.foto_crv && (
                              <button
                                onClick={() => openDocumentInNewTab(documentoVeiculo.foto_crv)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                              >
                                <ExternalLink size={14} />
                                Abrir em nova aba
                              </button>
                            )}
                          </div>
                          
                          {documentoVeiculo?.foto_crv ? (
                            <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {isPdf(documentoVeiculo.foto_crv) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setActiveDocument(documentoVeiculo.foto_crv)}
                                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                                    >
                                      <FileText size={16} />
                                      Visualizar
                                    </button>
                                    <button
                                      onClick={() => setIsVehicleDocumentsModalOpen(true)}
                                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                                    >
                                      <Edit2 size={16} />
                                      Editar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <img
                                    src={documentoVeiculo.foto_crv}
                                    alt="CRV do veículo"
                                    className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                    onClick={() => setActiveDocument(documentoVeiculo.foto_crv)}
                                  />
                                  <div className="absolute bottom-2 right-2 flex gap-2">
                                    <button
                                      onClick={() => setIsVehicleDocumentsModalOpen(true)}
                                      className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="file"
                                id="file-crv"
                                onChange={(e) => handleFileUpload(e, 'crv')}
                                className="sr-only"
                                ref={fileInputRef}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                              />
                              <label
                                htmlFor="file-crv"
                                className="flex flex-col items-center justify-center w-full aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                          border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                          hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                              >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  {uploading.crv ? (
                                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
                                  ) : (
                                    <Camera className="w-10 h-10 text-gray-400 mb-4" />
                                  )}
                                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    JPEG, PNG ou PDF (máx. 15MB)
                                  </p>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Helpers Tab */}
                  {activeTab === 'helpers' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                          Ajudantes
                        </h3>
                        
                        <button
                          onClick={handleAddAjudante}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                          </svg>
                          Adicionar Ajudante
                        </button>
                      </div>
                      
                      {ajudantes.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                          {ajudantes.map((ajudante) => (
                            <div 
                              key={ajudante.id_ajudante}
                              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                              <div className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <h4 className="text-base font-medium text-gray-900 dark:text-white">
                                        {ajudante.nome}
                                      </h4>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        CPF: {formatCPF(ajudante.cpf)}
                                      </p>
                                      {ajudante.telefone && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                          Telefone: {formatPhone(ajudante.telefone)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditAjudante(ajudante)}
                                      className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                                               hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                      title="Editar ajudante"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    
                                    <button
                                      onClick={() => handleDeleteAjudante(ajudante)}
                                      className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                                               hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title="Excluir ajudante"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Document Previews */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  {/* CNH or RG Document */}
                                  <div className="space-y-2">
                                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {ajudante.cnh_ajudante && ajudante.cnh_ajudante.length > 0 ? 'CNH' : 
                                       ajudante.rg_ajudante && ajudante.rg_ajudante.length > 0 ? 'RG' : 'Documento'}
                                    </h5>
                                    
                                    {ajudante.cnh_ajudante && ajudante.cnh_ajudante.length > 0 ? (
                                      <div className="space-y-2">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          Nº {ajudante.cnh_ajudante[0].nr_registro || 'Não informado'} • 
                                          Categoria: {ajudante.cnh_ajudante[0].categoria || 'Não informada'}
                                        </div>
                                        
                                        {ajudante.cnh_ajudante[0].foto_cnh ? (
                                          <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group">
                                            {isPdf(ajudante.cnh_ajudante[0].foto_cnh) ? (
                                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <FileText className="w-8 h-8 text-gray-400 mb-2" />
                                                <p className="text-xs text-gray-500">Documento PDF</p>
                                                <button
                                                  onClick={() => openDocumentInNewTab(ajudante.cnh_ajudante[0].foto_cnh)}
                                                  className="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                                >
                                                  Abrir
                                                </button>
                                              </div>
                                            ) : (
                                              <>
                                                <img 
                                                  src={ajudante.cnh_ajudante[0].foto_cnh} 
                                                  alt="CNH" 
                                                  className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                  <button
                                                    onClick={() => openDocumentInNewTab(ajudante.cnh_ajudante[0].foto_cnh)}
                                                    className="p-1 bg-white rounded-full"
                                                  >
                                                    <ExternalLink size={16} className="text-blue-600" />
                                                  </button>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                            <p className="text-xs text-gray-500">Sem documento</p>
                                          </div>
                                        )}
                                      </div>
                                    ) : ajudante.rg_ajudante && ajudante.rg_ajudante.length > 0 ? (
                                      <div className="space-y-2">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          Nº {ajudante.rg_ajudante[0].nr_rg || 'Não informado'} • 
                                          Órgão: {ajudante.rg_ajudante[0].orgao_expedidor || 'Não informado'}
                                        </div>
                                        
                                        {ajudante.rg_ajudante[0].foto_rg ? (
                                          <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group">
                                            {isPdf(ajudante.rg_ajudante[0].foto_rg) ? (
                                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <FileText className="w-8 h-8 text-gray-400 mb-2" />
                                                <p className="text-xs text-gray-500">Documento PDF</p>
                                                <button
                                                  onClick={() => openDocumentInNewTab(ajudante.rg_ajudante[0].foto_rg)}
                                                  className="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                                >
                                                  Abrir
                                                </button>
                                              </div>
                                            ) : (
                                              <>
                                                <img 
                                                  src={ajudante.rg_ajudante[0].foto_rg} 
                                                  alt="RG" 
                                                  className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                  <button
                                                    onClick={() => openDocumentInNewTab(ajudante.rg_ajudante[0].foto_rg)}
                                                    className="p-1 bg-white rounded-full"
                                                  >
                                                    <ExternalLink size={16} className="text-blue-600" />
                                                  </button>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                            <p className="text-xs text-gray-500">Sem documento</p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                        <p className="text-xs text-gray-500">Sem documento</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Comprovante de Residência */}
                                  <div className="space-y-2">
                                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Comprovante de Residência
                                    </h5>
                                    
                                    {ajudante.comprovante_residencia ? (
                                      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group">
                                        {isPdf(ajudante.comprovante_residencia) ? (
                                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <FileText className="w-8 h-8 text-gray-400 mb-2" />
                                            <p className="text-xs text-gray-500">Documento PDF</p>
                                            <button
                                              onClick={() => openDocumentInNewTab(ajudante.comprovante_residencia)}
                                              className="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                            >
                                              Abrir
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <img 
                                              src={ajudante.comprovante_residencia} 
                                              alt="Comprovante de Residência" 
                                              className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                                              <button
                                                onClick={() => openDocumentInNewTab(ajudante.comprovante_residencia)}
                                                className="p-1 bg-white rounded-full"
                                              >
                                                <ExternalLink size={16} className="text-blue-600" />
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                        <p className="text-xs text-gray-500">Sem comprovante</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Address Information */}
                                {ajudante.end_ajudante && ajudante.end_ajudante.length > 0 && (
                                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                      <MapPin className="w-4 h-4 text-gray-400" />
                                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Endereço</h5>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      {ajudante.end_ajudante[0].logradouro?.logradouro}, {ajudante.end_ajudante[0].nr_end || 'S/N'}
                                      {ajudante.end_ajudante[0].ds_complemento_end && ` - ${ajudante.end_ajudante[0].ds_complemento_end}`}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      {ajudante.end_ajudante[0].logradouro?.bairro?.bairro}, {ajudante.end_ajudante[0].logradouro?.bairro?.cidade?.cidade}/{ajudante.end_ajudante[0].logradouro?.bairro?.cidade?.estado?.sigla_estado}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 dark:text-gray-400">
                            Nenhum ajudante cadastrado
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {/* Modals */}
      {isEditMotoristaModalOpen && (
        <EditMotoristaModal
          isOpen={isEditMotoristaModalOpen}
          onClose={() => setIsEditMotoristaModalOpen(false)}
          motorista={motoristaData}
          onUpdate={() => {
            setIsEditMotoristaModalOpen(false);
            fetchData();
            if (onSuccess) onSuccess();
          }}
        />
      )}

      <AddAjudanteModal
        isOpen={isAddAjudanteModalOpen}
        onClose={() => setIsAddAjudanteModalOpen(false)}
        motorista_id={motorista.motorista_id}
        veiculo_id={veiculo?.veiculo_id}
        onSuccess={() => {
          setIsAddAjudanteModalOpen(false);
          fetchData();
          if (onSuccess) onSuccess();
        }}
      />

      {isEditAjudanteModalOpen && selectedAjudante && (
        <EditAjudanteModal
          isOpen={isEditAjudanteModalOpen}
          onClose={() => setIsEditAjudanteModalOpen(false)}
          ajudante={selectedAjudante}
          onSuccess={() => {
            setIsEditAjudanteModalOpen(false);
            fetchData();
            if (onSuccess) onSuccess();
          }}
        />
      )}

      <DocumentoMotoristaForm
        isOpen={isDocumentFormOpen}
        onClose={() => setIsDocumentFormOpen(false)}
        motorista_id={motorista.motorista_id}
        onSuccess={() => {
          setIsDocumentFormOpen(false);
          fetchData();
          if (onSuccess) onSuccess();
        }}
      />

      <VehicleDocumentsModal
        isOpen={isVehicleDocumentsModalOpen}
        onClose={() => setIsVehicleDocumentsModalOpen(false)}
        documento={documentoVeiculo}
        placa={veiculo?.placa || ''}
        marca={veiculo?.marca || ''}
        tipo={veiculo?.tipo || ''}
        veiculo_id={veiculo?.veiculo_id}
        onUploadSuccess={() => {
          setIsVehicleDocumentsModalOpen(false);
          fetchData();
          if (onSuccess) onSuccess();
        }}
      />
    </div>
  );
};

export default UnifiedAgregadoModal;