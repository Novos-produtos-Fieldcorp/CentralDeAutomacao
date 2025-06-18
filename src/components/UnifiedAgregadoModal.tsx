import React, { useState, useRef, useEffect } from 'react';
import { X, Truck, MapPin, FileText, Camera, Loader2, ExternalLink, Users, User, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import AddAjudanteModal from './AddAjudanteModal';
import EditAjudanteModal from './EditAjudanteModal';

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: any;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'helpers'>('details');
  const [loading, setLoading] = useState(true);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [veiculo, setVeiculo] = useState<any | null>(null);
  const [documento, setDocumento] = useState<any | null>(null);
  const [documentoVeiculo, setDocumentoVeiculo] = useState<any | null>(null);
  const [ajudantes, setAjudantes] = useState<any[]>([]);
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [isEditAjudanteModalOpen, setIsEditAjudanteModalOpen] = useState(false);
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
      
      // Fetch address
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
          rg_ajudante(*)
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {motorista?.nome || 'Detalhes do Agregado'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                           rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                          ${activeTab === 'details'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
              >
                <User className="w-5 h-5 mr-2" />
                Detalhes
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                          ${activeTab === 'documents'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
              >
                <FileText className="w-5 h-5 mr-2" />
                Documentos
              </button>
              <button
                onClick={() => setActiveTab('helpers')}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                          ${activeTab === 'helpers'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
              >
                <Users className="w-5 h-5 mr-2" />
                Ajudantes
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
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
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <User className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                          Informações Pessoais
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</p>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.nome}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</p>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.cpf ? motorista.cpf : '-'}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.email || '-'}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</p>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.telefone ? motorista.telefone : '-'}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</p>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.dt_nascimento ? motorista.dt_nascimento : '-'}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                            <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{motorista?.st_cadastro?.replace('_', ' ') || '-'}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Address Information */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                          Endereço
                        </h3>
                        
                        {endereco ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Logradouro</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {endereco.logradouro?.logradouro}, {endereco.nr_end || 'S/N'}
                                {endereco.ds_complemento_end && ` - ${endereco.ds_complemento_end}`}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CEP</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {endereco.logradouro?.nr_cep ? endereco.logradouro.nr_cep : '-'}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bairro</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {endereco.logradouro?.bairro?.bairro || '-'}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cidade/Estado</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {endereco.logradouro?.bairro?.cidade?.cidade || '-'}/{endereco.logradouro?.bairro?.cidade?.estado?.sigla_estado || '-'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum endereço cadastrado</p>
                        )}
                      </div>
                      
                      {/* Comprovante de Residência */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <Home className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                          Comprovante de Residência
                        </h3>
                        
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
                  )}
                  
                  {/* Documents Tab */}
                  {activeTab === 'documents' && (
                    <div className="space-y-6">
                      {/* Vehicle Information */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <Truck className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                          Informações do Veículo
                        </h3>
                        
                        {veiculo ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white uppercase">{veiculo.placa}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca/Modelo</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{veiculo.marca} {veiculo.tipo}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ano</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{veiculo.ano || '-'}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipologia</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{veiculo.tipologia || '-'}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Peso</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{veiculo.peso || '-'}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cubagem</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{veiculo.cubagem || '-'}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Rastreador</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {veiculo.possui_rastreador ? `Sim (${veiculo.marca_rastreador || 'Não informado'})` : 'Não'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum veículo cadastrado</p>
                        )}
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
                      
                      {/* CRV Document */}
                      {veiculo && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            CRV do Veículo
                          </h3>
                          
                          {documentoVeiculo?.foto_crv ? (
                            <div className="relative aspect-[1.414] w-full max-w-md bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {isPdf(documentoVeiculo.foto_crv) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                  <button
                                    onClick={() => openDocumentInNewTab(documentoVeiculo.foto_crv)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                  >
                                    <ExternalLink size={16} />
                                    Abrir PDF
                                  </button>
                                </div>
                              ) : (
                                <img
                                  src={documentoVeiculo.foto_crv}
                                  alt="CRV"
                                  className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                  onClick={() => setActiveDocument(documentoVeiculo.foto_crv)}
                                />
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
                                className="flex flex-col items-center justify-center w-full max-w-md aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
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
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                 transition-colors flex items-center gap-2 text-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14"></path>
                            <path d="M12 5v14"></path>
                          </svg>
                          Adicionar Ajudante
                        </button>
                      </div>
                      
                      {ajudantes.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {ajudantes.map((ajudante) => (
                            <div 
                              key={ajudante.id_ajudante}
                              className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-600"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="text-base font-medium text-gray-900 dark:text-white">
                                    {ajudante.nome}
                                  </h4>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    CPF: {ajudante.cpf}
                                  </p>
                                  {ajudante.telefone && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      Telefone: {ajudante.telefone}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditAjudante(ajudante)}
                                    className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                                           hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                    title="Editar ajudante"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                                      <path d="m15 5 4 4"></path>
                                    </svg>
                                  </button>
                                  
                                  <button
                                    onClick={() => handleDeleteAjudante(ajudante)}
                                    className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                                           hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    title="Excluir ajudante"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 6h18"></path>
                                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Document Type */}
                                <div>
                                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Tipo de Documento</p>
                                  <p className="text-sm text-gray-900 dark:text-white">
                                    {ajudante.cnh_ajudante && ajudante.cnh_ajudante.length > 0 ? 'CNH' : 
                                     ajudante.rg_ajudante && ajudante.rg_ajudante.length > 0 ? 'RG' : 'Não informado'}
                                  </p>
                                </div>
                                
                                {/* Document Details */}
                                {ajudante.cnh_ajudante && ajudante.cnh_ajudante.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Número da CNH</p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                      {ajudante.cnh_ajudante[0].nr_registro || 'Não informado'}
                                    </p>
                                  </div>
                                )}
                                
                                {ajudante.rg_ajudante && ajudante.rg_ajudante.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Número do RG</p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                      {ajudante.rg_ajudante[0].nr_rg || 'Não informado'}
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
            
            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 sm:px-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                         rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200
                         hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 
                         focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                  onClick={onClose}
                >
                  Fechar
                </button>
              </div>
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
      
      {/* Add Ajudante Modal */}
      <AddAjudanteModal
        isOpen={isAddAjudanteModalOpen}
        onClose={() => setIsAddAjudanteModalOpen(false)}
        onSuccess={() => {
          fetchData();
          setIsAddAjudanteModalOpen(false);
        }}
        motorista_id={motorista?.motorista_id}
        veiculo_id={veiculo?.veiculo_id}
      />
      
      {/* Edit Ajudante Modal */}
      {selectedAjudante && (
        <EditAjudanteModal
          isOpen={isEditAjudanteModalOpen}
          onClose={() => setIsEditAjudanteModalOpen(false)}
          onSuccess={() => {
            fetchData();
            setIsEditAjudanteModalOpen(false);
          }}
          ajudante={selectedAjudante}
        />
      )}
    </div>
  );
};

export default UnifiedAgregadoModal;