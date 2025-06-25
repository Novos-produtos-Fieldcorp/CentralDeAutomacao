import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  User, 
  MapPin, 
  FileText, 
  Camera, 
  Loader2, 
  ExternalLink, 
  Users, 
  Edit2, 
  Trash2, 
  UserPlus, 
  Calendar, 
  CheckCircle, 
  Phone, 
  Mail, 
  Home, 
  Mail as Mailbox,
  Navigation
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../utils/format';
import DocumentUploadModal from './DocumentUploadModal';
import EditMotoristaModal from './EditMotoristaModal';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import AddAjudanteModal from './AddAjudanteModal';
import EditAjudanteModal from './EditAjudanteModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface UnifiedMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: any;
  onSuccess?: () => void;
}

const UnifiedMotoristaModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedMotoristaModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'helpers'>('details');
  const [loading, setLoading] = useState(true);
  const [motoristaData, setMotoristaData] = useState<any | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [documento, setDocumento] = useState<any | null>(null);
  const [ajudantes, setAjudantes] = useState<any[]>([]);
  const [isDocumentUploadModalOpen, setIsDocumentUploadModalOpen] = useState(false);
  const [isEditMotoristaModalOpen, setIsEditMotoristaModalOpen] = useState(false);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const [uploading, setUploading] = useState<{cnh: boolean, comprovante: boolean}>({
    cnh: false,
    comprovante: false
  });
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [isEditAjudanteModalOpen, setIsEditAjudanteModalOpen] = useState(false);
  const [isDeleteAjudanteModalOpen, setIsDeleteAjudanteModalOpen] = useState(false);
  const [selectedAjudante, setSelectedAjudante] = useState<any | null>(null);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && motorista) {
      fetchMotoristaDetails();
    }
  }, [isOpen, motorista]);

  const fetchMotoristaDetails = async () => {
    if (!motorista) return;
    
    console.log('Fetching motorista details for ID:', motorista.motorista_id);
    
    try {
      setLoading(true);
      
      // Fetch motorista details
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
      
      // Fetch documents
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
      
      if (documentoError && documentoError.code !== 'PGRST116') throw documentoError;
      setDocumento(documentoData);
      
      // Fetch ajudantes
      console.log('Fetching ajudantes for motorista_id:', motorista.motorista_id);
      
      try {
        const { data: ajudantesData, error: ajudantesError } = await supabase
          .from('documento_ajudante')
          .select(`
            *,
            cnh_ajudante(*),
            rg_ajudante(*),
            end_ajudante(nr_end, ds_complemento_end, logradouro(logradouro, nr_cep, bairro(bairro, cidade(cidade, estado(sigla_estado)))))
          `)
          .eq('motorista_id', motorista.motorista_id);
        
        if (ajudantesError) {
          console.error('Error fetching ajudantes:', ajudantesError);
          throw ajudantesError;
        }
        
        console.log('Raw ajudantes data:', ajudantesData);
        
        // Transform the data to match the expected structure
        const formattedAjudantes = (ajudantesData || []).map(ajudante => {
          console.log('Processing ajudante:', ajudante);
          return {
            ...ajudante,
            nome: ajudante.nome || 'Ajudante sem nome',
            cpf: ajudante.cpf || '',
            telefone: ajudante.telefone || '',
            id_ajudante: ajudante.id_ajudante || Math.random().toString(36).substr(2, 9) // Fallback ID if not present
          };
        });
        
        console.log('Formatted ajudantes:', formattedAjudantes);
        setAjudantes(formattedAjudantes);
      } catch (ajudantesError) {
        console.error('Error in ajudantes fetch:', ajudantesError);
        setAjudantes([]); // Set empty array on error to prevent UI breakage
      }
      
    } catch (error) {
      console.error('Error fetching motorista details:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cnh' | 'comprovante') => {
    const file = e.target.files?.[0];
    if (!file || !motorista) return;
    
    try {
      setUploading((prev: { cnh: boolean; comprovante: boolean }) => ({
        ...prev,
        [type]: true
      }));
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${motorista.motorista_id}_${type}_${Date.now()}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, file);
        
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);
      
      // Update the appropriate document record
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
      setDocumento((prev: any) => ({
        ...prev,
        [type === 'cnh' ? 'foto_cnh' : 'foto_comprovante_residencia']: publicUrl
      }));
      
      toast.success('Documento enviado com sucesso');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading((prev: { cnh: boolean; comprovante: boolean }) => ({ ...prev, [type]: false }));
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

  // Ensure URL is a string before checking if it's a PDF
  const isPdf = (url: string | null | undefined) => {
    if (!url) return false;
    return String(url).toLowerCase().endsWith('.pdf');
  };

  const handleAddAjudante = () => {
    setIsAddAjudanteModalOpen(true);
  };

  const handleEditAjudante = (ajudante: any) => {
    setSelectedAjudante(ajudante);
    setIsEditAjudanteModalOpen(true);
  };

  const handleDeleteAjudante = (ajudante: any) => {
    setSelectedAjudante(ajudante);
    setIsDeleteAjudanteModalOpen(true);
  };

  const confirmDeleteAjudante = async () => {
    if (!selectedAjudante) return;
    
    try {
      const { error } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', selectedAjudante.id_ajudante);
      
      if (error) throw error;
      
      toast.success('Ajudante excluído com sucesso');
      fetchMotoristaDetails(); // Refresh data
      setIsDeleteAjudanteModalOpen(false);
    } catch (error) {
      console.error('Error deleting ajudante:', error);
      toast.error('Erro ao excluir ajudante');
    }
  };

  const handleDocumentUploadSuccess = () => {
    fetchMotoristaDetails();
    setIsDocumentUploadModalOpen(false);
  };

  if (!isOpen) return null;
  
  // Add null checks for motorista and motoristaData
  if (!motorista || !motoristaData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Carregando...</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // Use motoristaData if available, otherwise fall back to the original motorista prop
  const displayMotorista = motoristaData || motorista;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {displayMotorista?.nome || 'Detalhes do Motorista'}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Motorista • {displayMotorista?.cpf ? formatCPF(displayMotorista.cpf) : ''}
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
            
            {/* Content */}
            <div className="p-6">
              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'details'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <User className="w-5 h-5 mr-2 inline-block" />
                    Detalhes
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'documents'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <FileText className="w-5 h-5 mr-2 inline-block" />
                    Documentos
                  </button>
                  <button
                    onClick={() => setActiveTab('helpers')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'helpers'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Users className="w-5 h-5 mr-2 inline-block" />
                    Ajudantes
                  </button>
                </nav>
              </div>

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
                      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-500" />
                            Informações Pessoais
                          </h3>
                          <button
                            onClick={() => setIsEditMotoristaModalOpen(true)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Editar
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-400" />
                              Nome Completo
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                              {displayMotorista?.nome || '-'}
                            </dd>
                          </div>
                          
                          <div className="space-y-1">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-400" />
                              CPF
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                              {displayMotorista?.cpf ? formatCPF(displayMotorista.cpf) : '-'}
                            </dd>
                          </div>
                          
                          <div className="space-y-1">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-400" />
                              Data de Nascimento
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                              {displayMotorista?.dt_nascimento || '-'}
                            </dd>
                          </div>
                          
                          <div className="space-y-1">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-blue-400" />
                              Status
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6 capitalize">
                              {displayMotorista?.st_cadastro?.replace('_', ' ') || '-'}
                            </dd>
                          </div>
                          
                          <div className="space-y-1">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <Phone className="w-4 h-4 text-blue-400" />
                              Telefone
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                              {displayMotorista?.telefone ? formatPhone(displayMotorista.telefone.toString()) : 'Não informado'}
                            </dd>
                          </div>
                          
                          <div className="space-y-1">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <Mail className="w-4 h-4 text-blue-400" />
                              Email
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                              {displayMotorista?.email || 'Não informado'}
                            </dd>
                          </div>
                        </div>
                      </div>
                      
                      {/* Address Information */}
                      {endereco && (
                        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-6 border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-500" />
                            Endereço
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-400" />
                                Logradouro
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                                {endereco.logradouro?.logradouro ? 
                                  `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                                  'Não informado'}
                              </dd>
                            </div>
                            
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Home className="w-4 h-4 text-blue-400" />
                                Complemento
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                                {endereco.ds_complemento_end || 'Não informado'}
                              </dd>
                            </div>
                            
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Mailbox className="w-4 h-4 text-blue-400" />
                                CEP
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                                {endereco.logradouro?.nr_cep || 'Não informado'}
                              </dd>
                            </div>
                            
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Navigation className="w-4 h-4 text-blue-400" />
                                Bairro
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                                {endereco.logradouro?.bairro?.bairro || 'Não informado'}
                              </dd>
                            </div>
                            
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-400" />
                                Cidade/Estado
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 pl-6">
                                {endereco.logradouro?.bairro?.cidade?.cidade && endereco.logradouro?.bairro?.cidade?.estado?.sigla_estado ? 
                                  `${endereco.logradouro.bairro.cidade.cidade}/${endereco.logradouro.bairro.cidade.estado.sigla_estado}` : 
                                  'Não informado'}
                              </dd>
                            </div>
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
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Editar
                        </button>
                      </div>
                      
                      {/* CNH Document */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            CNH - Carteira Nacional de Habilitação
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Informações da CNH */}
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Número do Registro</dt>
                              <dd className="text-sm text-gray-900 dark:text-gray-100">
                                {documento?.nr_registro_cnh || 'Não informado'}
                              </dd>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoria</dt>
                                <dd className="text-sm text-gray-900 dark:text-gray-100">
                                  {documento?.categoria_cnh || 'Não informada'}
                                </dd>
                              </div>
                              <div className="space-y-1">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Validade</dt>
                                <dd className="text-sm text-gray-900 dark:text-gray-100">
                                  {documento?.validade_cnh ? new Date(documento.validade_cnh).toLocaleDateString('pt-BR') : 'Não informada'}
                                </dd>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">UF</dt>
                              <dd className="text-sm text-gray-900 dark:text-gray-100">
                                {documento?.uf_cnh || 'Não informado'}
                              </dd>
                            </div>
                          </div>
                          
                          {/* Imagem da CNH */}
                          <div className="flex justify-center">
                            {documento?.foto_cnh ? (
                              <div className="relative aspect-[1.414] w-full max-w-md bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                                {isPdf(documento.foto_cnh) ? (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                    <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500 text-center mb-4">Documento PDF</p>
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
                              <div className="w-full max-w-md aspect-[1.414] bg-gray-100 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center p-6 text-center">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500">Nenhum documento de CNH enviado</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Comprovante de Residência */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                          Comprovante de Residência
                        </h3>
                        
                        {documento?.foto_comprovante_residencia ? (
                          <div className="relative w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            {isPdf(documento.foto_comprovante_residencia) ? (
                              <div className="w-full p-8 flex flex-col items-center justify-center">
                                <FileText className="w-16 h-16 text-gray-400 mb-4" />
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
                              <div className="w-full flex justify-center">
                                <img
                                  src={documento.foto_comprovante_residencia}
                                  alt="Comprovante de Residência"
                                  className="max-w-full max-h-[70vh] object-contain cursor-pointer"
                                  onClick={() => setActiveDocument(documento.foto_comprovante_residencia)}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="relative w-full">
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
                              className="flex flex-col items-center justify-center w-full aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                        border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                        hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex flex-col items-center justify-center p-8 text-center">
                                {uploading.comprovante ? (
                                  <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
                                ) : (
                                  <Camera className="w-12 h-12 text-gray-400 mb-4" />
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
                  
                  {/* Helpers Tab */}
                  {activeTab === 'helpers' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          Ajudantes
                        </h3>
                        <button
                          onClick={handleAddAjudante}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Adicionar Ajudante
                        </button>
                      </div>
                      
                      {Array.isArray(ajudantes) && ajudantes.length > 0 ? (
                        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                            {ajudantes.map((ajudante) => {
                              try {
                                // Ensure we have a valid ajudante object
                                if (!ajudante || typeof ajudante !== 'object') {
                                  console.warn('Invalid ajudante data:', ajudante);
                                  return null;
                                }
                                
                                const ajudanteId = ajudante.id_ajudante || Math.random().toString(36).substr(2, 9);
                                const nome = ajudante.nome || 'Ajudante sem nome';
                                // Ensure CPF is a string before formatting
                                const cpf = ajudante.cpf ? String(ajudante.cpf) : '';
                                const telefone = ajudante.telefone || '';
                                
                                // Get document URLs
                                const cnhDoc = ajudante.cnh_ajudante?.[0]?.foto_cnh;
                                const rgDoc = ajudante.rg_ajudante?.[0]?.foto_rg;
                                const comprovanteDoc = ajudante.comprovante_residencia;
                                
                                return (
                                  <li key={ajudanteId} className="px-4 py-4 sm:px-6">
                                    <div className="flex flex-col space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                          </div>
                                          <div className="ml-4">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                              {nome}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                              CPF: {formatCPF(cpf)}
                                            </p>
                                            {telefone && (
                                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                                Telefone: {formatPhone(telefone)}
                                              </p>
                                            )}
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
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Excluir
                                          </button>
                                        </div>
                                      </div>
                                      
                                      {/* Document Thumbnails */}
                                      {(cnhDoc || rgDoc || comprovanteDoc) && (
                                        <div className="mt-2 flex items-center space-x-3 ml-14">
                                          <div className="text-xs text-gray-500 dark:text-gray-400 mr-1">
                                            Documentos:
                                          </div>
                                          <div className="flex -space-x-2">
                                            {cnhDoc && (
                                              <div 
                                                className="h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                                                onClick={() => openDocumentInNewTab(cnhDoc)}
                                                title="CNH"
                                              >
                                                {isPdf(cnhDoc) ? (
                                                  <div className="h-full w-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                                                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                  </div>
                                                ) : (
                                                  <img 
                                                    src={cnhDoc} 
                                                    alt="CNH" 
                                                    className="h-full w-full object-cover"
                                                  />
                                                )}
                                              </div>
                                            )}
                                            
                                            {rgDoc && (
                                              <div 
                                                className="h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                                                onClick={() => openDocumentInNewTab(rgDoc)}
                                                title="RG"
                                              >
                                                {isPdf(rgDoc) ? (
                                                  <div className="h-full w-full flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                                                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                  </div>
                                                ) : (
                                                  <img 
                                                    src={rgDoc} 
                                                    alt="RG" 
                                                    className="h-full w-full object-cover"
                                                  />
                                                )}
                                              </div>
                                            )}
                                            
                                            {comprovanteDoc && (
                                              <div 
                                                className="h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                                                onClick={() => openDocumentInNewTab(comprovanteDoc)}
                                                title="Comprovante de Residência"
                                              >
                                                {isPdf(comprovanteDoc) ? (
                                                  <div className="h-full w-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                                                    <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                  </div>
                                                ) : (
                                                  <img 
                                                    src={comprovanteDoc} 
                                                    alt="Comprovante" 
                                                    className="h-full w-full object-cover"
                                                  />
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                );
                              } catch (error) {
                                console.error('Error rendering ajudante:', error, ajudante);
                                return null; // Skip this item if there's an error
                              }
                            })}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
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
            className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700"
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
      
      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isDocumentUploadModalOpen}
        onClose={() => setIsDocumentUploadModalOpen(false)}
        motorista_id={motorista?.motorista_id}
        nome={displayMotorista?.nome || ''}
        onUploadSuccess={handleDocumentUploadSuccess}
      />

      {/* Edit Motorista Modal */}
      <EditMotoristaModal
        isOpen={isEditMotoristaModalOpen}
        onClose={() => setIsEditMotoristaModalOpen(false)}
        motorista={motoristaData || motorista}
        onUpdate={() => {
          fetchMotoristaDetails();
          if (onSuccess) onSuccess();
          setIsEditMotoristaModalOpen(false);
        }}
      />

      {/* Document Form Modal */}
      <DocumentoMotoristaForm
        isOpen={isDocumentFormOpen}
        onClose={() => setIsDocumentFormOpen(false)}
        motorista_id={motorista?.motorista_id}
        onSuccess={() => {
          fetchMotoristaDetails();
          if (onSuccess) onSuccess();
          setIsDocumentFormOpen(false);
        }}
      />

      {/* Add Ajudante Modal */}
      <AddAjudanteModal
        isOpen={isAddAjudanteModalOpen}
        onClose={() => {
          setIsAddAjudanteModalOpen(false);
          fetchMotoristaDetails();
        }}
        motorista_id={motorista?.motorista_id}
        veiculo_id={motorista?.veiculo_id}
        onSuccess={() => {
          fetchMotoristaDetails();
          setIsAddAjudanteModalOpen(false);
        }}
      />

      {/* Edit Ajudante Modal */}
      <EditAjudanteModal
        isOpen={isEditAjudanteModalOpen}
        onClose={() => setIsEditAjudanteModalOpen(false)}
        ajudante={selectedAjudante}
        onSuccess={() => {
          fetchMotoristaDetails();
          setIsEditAjudanteModalOpen(false);
        }}
      />

      {/* Delete Ajudante Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteAjudanteModalOpen}
        onClose={() => setIsDeleteAjudanteModalOpen(false)}
        onConfirm={confirmDeleteAjudante}
        title="Excluir Ajudante"
        message={`Tem certeza que deseja excluir o ajudante "${selectedAjudante?.nome}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
};

export default UnifiedMotoristaModal;