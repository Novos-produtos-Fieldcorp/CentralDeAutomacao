import React, { useState, useEffect, useRef } from 'react';
import { X, User, MapPin, Truck, FileText, Camera, Loader2, ExternalLink, Upload, Save, Edit2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import { useCompanyData } from '../hooks/useCompanyData';
import { useAuth } from '../context/AuthContext';
import AddAjudanteModal from './AddAjudanteModal';
import { VEHICLE_TYPES } from '../constants/vehicleTypes';

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista_id: number;
  onUpdate: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, motorista_id, onUpdate }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'helpers'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [motorista, setMotorista] = useState<any>(null);
  const [veiculo, setVeiculo] = useState<any>(null);
  const [endereco, setEndereco] = useState<any>(null);
  const [documento, setDocumento] = useState<any>(null);
  const [documentoVeiculo, setDocumentoVeiculo] = useState<any>(null);
  const [ajudantes, setAjudantes] = useState<any[]>([]);
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form state for editing
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    dt_nascimento: '',
    genero: '',
    st_cadastro: '',
    
    // Endereço
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complemento: '',
    
    // Veículo
    placa: '',
    marca: '',
    tipo: '',
    ano: '',
    cor: '',
    tipologia: '',
    combustivel: '',
    peso: '',
    cubagem: '',
    possui_rastreador: false,
    marca_rastreador: ''
  });

  useEffect(() => {
    if (isOpen && motorista_id) {
      fetchAgregadoDetails();
      fetchEstados();
    }
  }, [isOpen, motorista_id]);

  useEffect(() => {
    if (motorista && veiculo) {
      setFormData({
        nome: motorista.nome || '',
        cpf: motorista.cpf || '',
        email: motorista.email || '',
        telefone: motorista.telefone?.toString() || '',
        dt_nascimento: motorista.dt_nascimento ? new Date(motorista.dt_nascimento).toISOString().split('T')[0] : '',
        genero: motorista.genero || '',
        st_cadastro: motorista.st_cadastro || '',
        
        // Endereço
        cep: endereco?.logradouro?.nr_cep || '',
        estado: endereco?.logradouro?.bairro?.cidade?.estado?.id_estado?.toString() || '',
        cidade: endereco?.logradouro?.bairro?.cidade?.cidade || '',
        bairro: endereco?.logradouro?.bairro?.bairro || '',
        logradouro: endereco?.logradouro?.logradouro || '',
        numero: endereco?.nr_end?.toString() || '',
        complemento: endereco?.ds_complemento_end || '',
        
        // Veículo
        placa: veiculo.placa || '',
        marca: veiculo.marca || '',
        tipo: veiculo.tipo || '',
        ano: veiculo.ano || '',
        cor: veiculo.cor || '',
        tipologia: veiculo.tipologia || '',
        combustivel: veiculo.combustivel || '',
        peso: veiculo.peso || '',
        cubagem: veiculo.cubagem || '',
        possui_rastreador: veiculo.possui_rastreador || false,
        marca_rastreador: veiculo.marca_rastreador || ''
      });

      // Set preview URL for document
      if (documentoVeiculo?.foto_crv) {
        setPreviewUrl(documentoVeiculo.foto_crv);
      }
    }
  }, [motorista, veiculo, endereco, documentoVeiculo]);

  const fetchAgregadoDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch motorista details
      const { data: motoristaData, error: motoristaError } = await supabase
        .from('motorista')
        .select('*')
        .eq('motorista_id', motorista_id)
        .single();
      
      if (motoristaError) throw motoristaError;
      setMotorista(motoristaData);
      
      // Fetch vehicle details
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculo')
        .select('*')
        .eq('motorista_id', motorista_id)
        .eq('status_veiculo', true)
        .maybeSingle();
      
      if (veiculoError && veiculoError.code !== 'PGRST116') throw veiculoError;
      setVeiculo(veiculoData || null);
      
      // Fetch address details
      const { data: enderecoData, error: enderecoError } = await supabase
        .from('end_motorista')
        .select(`
          id_end_motorista,
          nr_end,
          ds_complemento_end,
          logradouro (
            id_logradouro,
            logradouro,
            nr_cep,
            bairro (
              id_bairro,
              bairro,
              cidade (
                id_cidade,
                cidade,
                estado (
                  id_estado,
                  sigla_estado
                )
              )
            )
          )
        `)
        .eq('id_motorista', motorista_id)
        .eq('st_end', true)
        .maybeSingle();
      
      if (enderecoError && enderecoError.code !== 'PGRST116') throw enderecoError;
      setEndereco(enderecoData || null);
      
      // Fetch document details
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista_id)
        .maybeSingle();
      
      if (documentoError && documentoError.code !== 'PGRST116') throw documentoError;
      setDocumento(documentoData || null);
      
      // Fetch vehicle document details if vehicle exists
      if (veiculoData) {
        const { data: docVeiculoData, error: docVeiculoError } = await supabase
          .from('documento_veiculo')
          .select('*')
          .eq('veiculo_id', veiculoData.veiculo_id)
          .maybeSingle();
        
        if (docVeiculoError && docVeiculoError.code !== 'PGRST116') throw docVeiculoError;
        setDocumentoVeiculo(docVeiculoData || null);
      }
      
      // Fetch ajudantes
      const { data: ajudantesData, error: ajudantesError } = await supabase
        .from('documento_ajudante')
        .select(`
          *,
          cnh_ajudante(*),
          rg_ajudante(*),
          end_ajudante(
            *,
            logradouro(
              logradouro,
              nr_cep,
              bairro(
                bairro,
                cidade(
                  cidade,
                  estado(
                    sigla_estado
                  )
                )
              )
            )
          )
        `)
        .eq('motorista_id', motorista_id);
      
      if (ajudantesError) throw ajudantesError;
      setAjudantes(ajudantesData || []);
      
    } catch (error) {
      console.error('Error fetching agregado details:', error);
      setError('Erro ao carregar detalhes do agregado');
      toast.error('Erro ao carregar detalhes do agregado');
    } finally {
      setLoading(false);
    }
  };

  const fetchEstados = async () => {
    try {
      const { data, error } = await supabase
        .from('estado')
        .select('id_estado, sigla_estado')
        .order('sigla_estado');

      if (error) throw error;
      setEstados(data || []);
    } catch (error) {
      console.error('Erro ao carregar estados:', error);
      toast.error('Erro ao carregar estados');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!motorista) return;
    
    try {
      setSaving(true);
      
      // Update motorista data
      const { error: motoristaError } = await supabase
        .from('motorista')
        .update({
          nome: formData.nome,
          email: formData.email || null,
          telefone: formData.telefone ? Number(formData.telefone.replace(/\D/g, '')) : null,
          dt_nascimento: formData.dt_nascimento || null,
          genero: formData.genero || null,
          st_cadastro: formData.st_cadastro
        })
        .eq('motorista_id', motorista_id);
      
      if (motoristaError) throw motoristaError;
      
      // Update vehicle data if it exists
      if (veiculo) {
        const { error: veiculoError } = await supabase
          .from('veiculo')
          .update({
            placa: formData.placa.toUpperCase(),
            marca: formData.marca,
            tipo: formData.tipo,
            ano: formData.ano,
            cor: formData.cor,
            tipologia: formData.tipologia,
            combustivel: formData.combustivel,
            peso: formData.peso,
            cubagem: formData.cubagem,
            possui_rastreador: formData.possui_rastreador,
            marca_rastreador: formData.marca_rastreador
          })
          .eq('veiculo_id', veiculo.veiculo_id);
        
        if (veiculoError) throw veiculoError;
      }
      
      // Update address if it exists
      if (endereco) {
        // First, check if we need to update the logradouro
        if (formData.logradouro && formData.cidade && formData.estado && formData.bairro) {
          // Get the estado_id
          const estadoId = parseInt(formData.estado);
          
          // Check if cidade exists
          let cidadeId: number;
          const { data: cidade, error: cidadeError } = await supabase
            .from('cidade')
            .select('id_cidade')
            .eq('cidade', formData.cidade)
            .eq('id_estado', estadoId)
            .maybeSingle();
          
          if (cidadeError && cidadeError.code !== 'PGRST116') throw cidadeError;
          
          if (cidade) {
            cidadeId = cidade.id_cidade;
          } else {
            // Create cidade if it doesn't exist
            const { data: newCidade, error: newCidadeError } = await supabase
              .from('cidade')
              .insert({
                cidade: formData.cidade,
                id_estado: estadoId
              })
              .select()
              .single();
            
            if (newCidadeError) throw newCidadeError;
            cidadeId = newCidade.id_cidade;
          }
          
          // Check if bairro exists
          let bairroId: number;
          const { data: bairro, error: bairroError } = await supabase
            .from('bairro')
            .select('id_bairro')
            .eq('bairro', formData.bairro)
            .eq('id_cidade', cidadeId)
            .maybeSingle();
          
          if (bairroError && bairroError.code !== 'PGRST116') throw bairroError;
          
          if (bairro) {
            bairroId = bairro.id_bairro;
          } else {
            // Create bairro if it doesn't exist
            const { data: newBairro, error: newBairroError } = await supabase
              .from('bairro')
              .insert({
                bairro: formData.bairro,
                id_cidade: cidadeId
              })
              .select()
              .single();
            
            if (newBairroError) throw newBairroError;
            bairroId = newBairro.id_bairro;
          }
          
          // Check if logradouro exists
          let logradouroId: number;
          const { data: logradouro, error: logradouroError } = await supabase
            .from('logradouro')
            .select('id_logradouro')
            .eq('logradouro', formData.logradouro)
            .eq('nr_cep', formData.cep || null)
            .eq('id_bairro', bairroId)
            .maybeSingle();
          
          if (logradouroError && logradouroError.code !== 'PGRST116') throw logradouroError;
          
          if (logradouro) {
            logradouroId = logradouro.id_logradouro;
          } else {
            // Create logradouro if it doesn't exist
            const { data: newLogradouro, error: newLogradouroError } = await supabase
              .from('logradouro')
              .insert({
                logradouro: formData.logradouro,
                nr_cep: formData.cep || null,
                id_bairro: bairroId
              })
              .select()
              .single();
            
            if (newLogradouroError) throw newLogradouroError;
            logradouroId = newLogradouro.id_logradouro;
          }
          
          // Update end_motorista
          const { error: enderecoError } = await supabase
            .from('end_motorista')
            .update({
              nr_end: formData.numero ? parseInt(formData.numero) : null,
              ds_complemento_end: formData.complemento || null,
              id_logradouro: logradouroId
            })
            .eq('id_end_motorista', endereco.id_end_motorista);
          
          if (enderecoError) throw enderecoError;
        }
      } else if (formData.logradouro && formData.cidade && formData.estado && formData.bairro) {
        // Create new address if it doesn't exist
        // Get the estado_id
        const estadoId = parseInt(formData.estado);
        
        // Check if cidade exists
        let cidadeId: number;
        const { data: cidade, error: cidadeError } = await supabase
          .from('cidade')
          .select('id_cidade')
          .eq('cidade', formData.cidade)
          .eq('id_estado', estadoId)
          .maybeSingle();
        
        if (cidadeError && cidadeError.code !== 'PGRST116') throw cidadeError;
        
        if (cidade) {
          cidadeId = cidade.id_cidade;
        } else {
          // Create cidade if it doesn't exist
          const { data: newCidade, error: newCidadeError } = await supabase
            .from('cidade')
            .insert({
              cidade: formData.cidade,
              id_estado: estadoId
            })
            .select()
            .single();
          
          if (newCidadeError) throw newCidadeError;
          cidadeId = newCidade.id_cidade;
        }
        
        // Check if bairro exists
        let bairroId: number;
        const { data: bairro, error: bairroError } = await supabase
          .from('bairro')
          .select('id_bairro')
          .eq('bairro', formData.bairro)
          .eq('id_cidade', cidadeId)
          .maybeSingle();
        
        if (bairroError && bairroError.code !== 'PGRST116') throw bairroError;
        
        if (bairro) {
          bairroId = bairro.id_bairro;
        } else {
          // Create bairro if it doesn't exist
          const { data: newBairro, error: newBairroError } = await supabase
            .from('bairro')
            .insert({
              bairro: formData.bairro,
              id_cidade: cidadeId
            })
            .select()
            .single();
          
          if (newBairroError) throw newBairroError;
          bairroId = newBairro.id_bairro;
        }
        
        // Create logradouro
        const { data: newLogradouro, error: newLogradouroError } = await supabase
          .from('logradouro')
          .insert({
            logradouro: formData.logradouro,
            nr_cep: formData.cep || null,
            id_bairro: bairroId
          })
          .select()
          .single();
        
        if (newLogradouroError) throw newLogradouroError;
        
        // Create end_motorista
        const { error: enderecoError } = await supabase
          .from('end_motorista')
          .insert({
            nr_end: formData.numero ? parseInt(formData.numero) : null,
            ds_complemento_end: formData.complemento || null,
            id_motorista: motorista_id,
            id_logradouro: newLogradouro.id_logradouro,
            st_end: true
          });
        
        if (enderecoError) throw enderecoError;
      }
      
      toast.success('Dados atualizados com sucesso');
      fetchAgregadoDetails();
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving agregado details:', error);
      toast.error('Erro ao salvar dados do agregado');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size (max 15MB)
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. Tamanho máximo: 15MB');
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
      return;
    }

    setFile(selectedFile);
  };

  const uploadDocument = async (file: File, type: 'crv' | 'cnh' | 'comprovante') => {
    if (!veiculo && type === 'crv') {
      toast.error('Nenhum veículo associado');
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${motorista_id}_${type}_${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);

      if (type === 'crv' && veiculo) {
        // Check if document exists
        const { data: existingDoc } = await supabase
          .from('documento_veiculo')
          .select('*')
          .eq('veiculo_id', veiculo.veiculo_id)
          .single();

        if (existingDoc) {
          // Update existing document
          const { error: updateError } = await supabase
            .from('documento_veiculo')
            .update({
              foto_crv: publicUrl
            })
            .eq('id_documento_veiculo', existingDoc.id_documento_veiculo);

          if (updateError) throw updateError;
        } else {
          // Create new document
          const { error: insertError } = await supabase
            .from('documento_veiculo')
            .insert({
              veiculo_id: veiculo.veiculo_id,
              foto_crv: publicUrl
            });

          if (insertError) throw insertError;
        }
      } else if (type === 'cnh' || type === 'comprovante') {
        // Check if document exists
        const { data: existingDoc } = await supabase
          .from('documento_motorista')
          .select('*')
          .eq('motorista_id', motorista_id)
          .maybeSingle();

        const updateData = type === 'cnh' 
          ? { foto_cnh: publicUrl }
          : { foto_comprovante_residencia: publicUrl };

        if (existingDoc) {
          // Update existing document
          const { error: updateError } = await supabase
            .from('documento_motorista')
            .update(updateData)
            .eq('id_documento_motorista', existingDoc.id_documento_motorista);

          if (updateError) throw updateError;
        } else {
          // Create new document
          const { error: insertError } = await supabase
            .from('documento_motorista')
            .insert({
              motorista_id,
              ...updateData
            });

          if (insertError) throw insertError;
        }
      }

      // Update preview URL
      setPreviewUrl(publicUrl);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast.success('Documento enviado com sucesso');
      fetchAgregadoDetails();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full shadow-xl">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {motorista?.nome || 'Carregando...'}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Salvar
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                             rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
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
              </nav>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-8 text-red-500">{error}</div>
              ) : (
                <>
                  {/* Details Tab */}
                  {activeTab === 'details' && (
                    <div className="space-y-8">
                      {/* Personal Information */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <User className="w-5 h-5 text-gray-400" />
                          Informações Pessoais
                        </h3>
                        
                        {isEditing ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome
                              </label>
                              <input
                                type="text"
                                name="nome"
                                value={formData.nome}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                CPF
                              </label>
                              <input
                                type="text"
                                name="cpf"
                                value={formData.cpf}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email
                              </label>
                              <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Telefone
                              </label>
                              <input
                                type="tel"
                                name="telefone"
                                value={formData.telefone}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Data de Nascimento
                              </label>
                              <input
                                type="date"
                                name="dt_nascimento"
                                value={formData.dt_nascimento}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Gênero
                              </label>
                              <select
                                name="genero"
                                value={formData.genero}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              >
                                <option value="">Selecione</option>
                                <option value="M">Masculino</option>
                                <option value="F">Feminino</option>
                                <option value="O">Outro</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Status
                              </label>
                              <select
                                name="st_cadastro"
                                value={formData.st_cadastro}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              >
                                <option value="cadastrado">Cadastrado</option>
                                <option value="qualificado">Qualificado</option>
                                <option value="documentacao">Documentação</option>
                                <option value="gr">GR</option>
                                <option value="contrato_enviado">Contrato Enviado</option>
                                <option value="contratado">Contratado</option>
                                <option value="repescagem">Repescagem</option>
                                <option value="rejeitado">Rejeitado</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</span>
                              <p className="text-base text-gray-900 dark:text-white">{motorista?.nome}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</span>
                              <p className="text-base text-gray-900 dark:text-white">{motorista?.cpf ? formatCPF(motorista.cpf) : '-'}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</span>
                              <p className="text-base text-gray-900 dark:text-white">{motorista?.email || '-'}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</span>
                              <p className="text-base text-gray-900 dark:text-white">{motorista?.telefone ? formatPhone(motorista.telefone.toString()) : '-'}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</span>
                              <p className="text-base text-gray-900 dark:text-white">{motorista?.dt_nascimento ? formatDate(motorista.dt_nascimento) : '-'}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Gênero</span>
                              <p className="text-base text-gray-900 dark:text-white">
                                {motorista?.genero === 'M' ? 'Masculino' : 
                                 motorista?.genero === 'F' ? 'Feminino' : 
                                 motorista?.genero === 'O' ? 'Outro' : '-'}
                              </p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</span>
                              <p className="text-base text-gray-900 dark:text-white capitalize">
                                {motorista?.st_cadastro?.replace('_', ' ') || '-'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Address Information */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-gray-400" />
                          Endereço
                        </h3>
                        
                        {isEditing ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                CEP
                              </label>
                              <input
                                type="text"
                                name="cep"
                                value={formData.cep}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Estado
                              </label>
                              <select
                                name="estado"
                                value={formData.estado}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              >
                                <option value="">Selecione um estado</option>
                                {estados.map(estado => (
                                  <option key={estado.id_estado} value={estado.id_estado}>
                                    {estado.sigla_estado}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Cidade
                              </label>
                              <input
                                type="text"
                                name="cidade"
                                value={formData.cidade}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Bairro
                              </label>
                              <input
                                type="text"
                                name="bairro"
                                value={formData.bairro}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Logradouro
                              </label>
                              <input
                                type="text"
                                name="logradouro"
                                value={formData.logradouro}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Número
                              </label>
                              <input
                                type="text"
                                name="numero"
                                value={formData.numero}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Complemento
                              </label>
                              <input
                                type="text"
                                name="complemento"
                                value={formData.complemento}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            {endereco ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Logradouro</span>
                                    <p className="text-base text-gray-900 dark:text-white">
                                      {endereco.logradouro?.logradouro}, {endereco.nr_end || 'S/N'}
                                      {endereco.ds_complemento_end && ` - ${endereco.ds_complemento_end}`}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">CEP</span>
                                    <p className="text-base text-gray-900 dark:text-white">
                                      {endereco.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : '-'}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Bairro</span>
                                    <p className="text-base text-gray-900 dark:text-white">
                                      {endereco.logradouro?.bairro?.bairro || '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cidade</span>
                                    <p className="text-base text-gray-900 dark:text-white">
                                      {endereco.logradouro?.bairro?.cidade?.cidade || '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Estado</span>
                                    <p className="text-base text-gray-900 dark:text-white">
                                      {endereco.logradouro?.bairro?.cidade?.estado?.sigla_estado || '-'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400">Nenhum endereço cadastrado</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Comprovante de Residência */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-gray-400" />
                            Comprovante de Residência
                          </h3>
                          {documento?.foto_comprovante_residencia && (
                            <button
                              onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                            >
                              <ExternalLink size={16} />
                              Abrir em nova aba
                            </button>
                          )}
                        </div>
                        
                        {documento?.foto_comprovante_residencia ? (
                          <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            {isPdf(documento.foto_comprovante_residencia) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                <button
                                  onClick={() => setActiveDocument(documento.foto_comprovante_residencia)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                >
                                  <FileText size={16} />
                                  Visualizar PDF
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
                          <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                            <div className="text-center">
                              <p className="text-gray-500 dark:text-gray-400 font-medium">Comprovante não cadastrado</p>
                              <p className="text-sm text-gray-400 dark:text-gray-500">
                                Faça o upload do comprovante para visualizá-lo aqui
                              </p>
                            </div>
                          </div>
                        )}

                        {isEditing && (
                          <div className="mt-4">
                            <div className="flex items-center gap-4">
                              <input
                                type="file"
                                id="comprovante"
                                onChange={handleFileChange}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                                className="hidden"
                                ref={fileInputRef}
                              />
                              <label
                                htmlFor="comprovante"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2"
                              >
                                <Upload className="w-5 h-5" />
                                Selecionar Arquivo
                              </label>
                              {file && (
                                <button
                                  onClick={() => uploadDocument(file, 'comprovante')}
                                  disabled={uploading}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {uploading ? (
                                    <>
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-5 h-5" />
                                      Enviar
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              Formatos aceitos: JPEG, PNG, PDF (máx. 15MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Documents Tab */}
                  {activeTab === 'documents' && (
                    <div className="space-y-8">
                      {/* Vehicle Information */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <Truck className="w-5 h-5 text-gray-400" />
                          Informações do Veículo
                        </h3>
                        
                        {isEditing ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Placa
                              </label>
                              <input
                                type="text"
                                name="placa"
                                value={formData.placa}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Marca
                              </label>
                              <input
                                type="text"
                                name="marca"
                                value={formData.marca}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Modelo
                              </label>
                              <input
                                type="text"
                                name="tipo"
                                value={formData.tipo}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Ano
                              </label>
                              <input
                                type="text"
                                name="ano"
                                value={formData.ano}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Cor
                              </label>
                              <input
                                type="text"
                                name="cor"
                                value={formData.cor}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tipologia
                              </label>
                              <select
                                name="tipologia"
                                value={formData.tipologia}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              >
                                <option value="">Selecione um tipo</option>
                                {VEHICLE_TYPES.map(type => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Combustível
                              </label>
                              <input
                                type="text"
                                name="combustivel"
                                value={formData.combustivel}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Peso (kg)
                              </label>
                              <input
                                type="text"
                                name="peso"
                                value={formData.peso}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Cubagem (m³)
                              </label>
                              <input
                                type="text"
                                name="cubagem"
                                value={formData.cubagem}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                <input
                                  type="checkbox"
                                  name="possui_rastreador"
                                  checked={formData.possui_rastreador}
                                  onChange={(e) => setFormData(prev => ({ ...prev, possui_rastreador: e.target.checked }))}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Possui Rastreador</span>
                              </label>
                            </div>
                            {formData.possui_rastreador && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Marca do Rastreador
                                </label>
                                <input
                                  type="text"
                                  name="marca_rastreador"
                                  value={formData.marca_rastreador}
                                  onChange={handleInputChange}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            {veiculo ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</span>
                                  <p className="text-base text-gray-900 dark:text-white uppercase">{veiculo.placa}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca/Modelo</span>
                                  <p className="text-base text-gray-900 dark:text-white">{veiculo.marca} {veiculo.tipo}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ano</span>
                                  <p className="text-base text-gray-900 dark:text-white">{veiculo.ano || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cor</span>
                                  <p className="text-base text-gray-900 dark:text-white">{veiculo.cor || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipologia</span>
                                  <p className="text-base text-gray-900 dark:text-white">{veiculo.tipologia || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Combustível</span>
                                  <p className="text-base text-gray-900 dark:text-white">{veiculo.combustivel || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Peso</span>
                                  <p className="text-base text-gray-900 dark:text-white">{veiculo.peso ? `${veiculo.peso} kg` : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cubagem</span>
                                  <p className="text-base text-gray-900 dark:text-white">{veiculo.cubagem ? `${veiculo.cubagem} m³` : '-'}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Rastreador</span>
                                  <p className="text-base text-gray-900 dark:text-white">{veiculo.possui_rastreador ? 'Sim' : 'Não'}</p>
                                </div>
                                {veiculo.possui_rastreador && (
                                  <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca do Rastreador</span>
                                    <p className="text-base text-gray-900 dark:text-white">{veiculo.marca_rastreador || '-'}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400">Nenhum veículo cadastrado</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* CNH Document */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-gray-400" />
                            Carteira Nacional de Habilitação (CNH)
                          </h3>
                          {documento?.foto_cnh && (
                            <button
                              onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                            >
                              <ExternalLink size={16} />
                              Abrir em nova aba
                            </button>
                          )}
                        </div>
                        
                        {documento?.foto_cnh ? (
                          <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            {isPdf(documento.foto_cnh) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                <button
                                  onClick={() => setActiveDocument(documento.foto_cnh)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                >
                                  <FileText size={16} />
                                  Visualizar PDF
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
                          <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                            <div className="text-center">
                              <p className="text-gray-500 dark:text-gray-400 font-medium">CNH não cadastrada</p>
                              <p className="text-sm text-gray-400 dark:text-gray-500">
                                Faça o upload da CNH para visualizá-la aqui
                              </p>
                            </div>
                          </div>
                        )}

                        {isEditing && (
                          <div className="mt-4">
                            <div className="flex items-center gap-4">
                              <input
                                type="file"
                                id="cnh"
                                onChange={handleFileChange}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                                className="hidden"
                                ref={fileInputRef}
                              />
                              <label
                                htmlFor="cnh"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2"
                              >
                                <Upload className="w-5 h-5" />
                                Selecionar Arquivo
                              </label>
                              {file && (
                                <button
                                  onClick={() => uploadDocument(file, 'cnh')}
                                  disabled={uploading}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {uploading ? (
                                    <>
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-5 h-5" />
                                      Enviar
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              Formatos aceitos: JPEG, PNG, PDF (máx. 15MB)
                            </p>
                          </div>
                        )}
                      </div>

                      {/* CRV Document */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-gray-400" />
                            CRV do Veículo
                          </h3>
                          {documentoVeiculo?.foto_crv && (
                            <button
                              onClick={() => openDocumentInNewTab(documentoVeiculo.foto_crv)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                            >
                              <ExternalLink size={16} />
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
                                <button
                                  onClick={() => setActiveDocument(documentoVeiculo.foto_crv)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                >
                                  <FileText size={16} />
                                  Visualizar PDF
                                </button>
                              </div>
                            ) : (
                              <img
                                src={documentoVeiculo.foto_crv}
                                alt="CRV do veículo"
                                className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                onClick={() => setActiveDocument(documentoVeiculo.foto_crv)}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                            <div className="text-center">
                              <p className="text-gray-500 dark:text-gray-400 font-medium">CRV não cadastrado</p>
                              <p className="text-sm text-gray-400 dark:text-gray-500">
                                Faça o upload do CRV para visualizá-lo aqui
                              </p>
                            </div>
                          </div>
                        )}

                        {isEditing && veiculo && (
                          <div className="mt-4">
                            <div className="flex items-center gap-4">
                              <input
                                type="file"
                                id="crv"
                                onChange={handleFileChange}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                                className="hidden"
                                ref={fileInputRef}
                              />
                              <label
                                htmlFor="crv"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2"
                              >
                                <Upload className="w-5 h-5" />
                                Selecionar Arquivo
                              </label>
                              {file && (
                                <button
                                  onClick={() => uploadDocument(file, 'crv')}
                                  disabled={uploading}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {uploading ? (
                                    <>
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-5 h-5" />
                                      Enviar
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              Formatos aceitos: JPEG, PNG, PDF (máx. 15MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Helpers Tab */}
                  {activeTab === 'helpers' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Users className="w-5 h-5 text-gray-400" />
                          Ajudantes
                        </h3>
                        <button
                          onClick={() => setIsAddAjudanteModalOpen(true)}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 flex items-center gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Adicionar Ajudante
                        </button>
                      </div>
                      
                      {ajudantes.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 dark:text-gray-400">
                            Nenhum ajudante cadastrado
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {ajudantes.map((ajudante) => (
                            <div 
                              key={ajudante.id_ajudante}
                              className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
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
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      // Handle edit ajudante
                                    }}
                                    className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
                                    title="Editar ajudante"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Handle delete ajudante
                                    }}
                                    className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                                    title="Excluir ajudante"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Telefone</span>
                                  <p className="text-sm text-gray-900 dark:text-white">
                                    {ajudante.telefone ? formatPhone(ajudante.telefone) : 'Não informado'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Gênero</span>
                                  <p className="text-sm text-gray-900 dark:text-white">
                                    {ajudante.genero === 'M' ? 'Masculino' : 
                                     ajudante.genero === 'F' ? 'Feminino' : 
                                     ajudante.genero === 'O' ? 'Outro' : 'Não informado'}
                                  </p>
                                </div>
                                
                                {/* Documento */}
                                <div className="md:col-span-2">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Documento</span>
                                  <p className="text-sm text-gray-900 dark:text-white">
                                    {ajudante.cnh_ajudante && ajudante.cnh_ajudante.length > 0 ? (
                                      <>CNH: {ajudante.cnh_ajudante[0].nr_registro || 'Não informado'}</>
                                    ) : ajudante.rg_ajudante && ajudante.rg_ajudante.length > 0 ? (
                                      <>RG: {ajudante.rg_ajudante[0].nr_rg || 'Não informado'}</>
                                    ) : (
                                      'Nenhum documento cadastrado'
                                    )}
                                  </p>
                                </div>
                                
                                {/* Endereço */}
                                {ajudante.end_ajudante && ajudante.end_ajudante.length > 0 && ajudante.end_ajudante[0].logradouro && (
                                  <div className="md:col-span-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Endereço</span>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                      {ajudante.end_ajudante[0].logradouro.logradouro}, {ajudante.end_ajudante[0].nr_end || 'S/N'}
                                      {ajudante.end_ajudante[0].ds_complemento_end && ` - ${ajudante.end_ajudante[0].ds_complemento_end}`}
                                      {ajudante.end_ajudante[0].logradouro.bairro && `, ${ajudante.end_ajudante[0].logradouro.bairro.bairro}`}
                                      {ajudante.end_ajudante[0].logradouro.bairro?.cidade && `, ${ajudante.end_ajudante[0].logradouro.bairro.cidade.cidade}`}
                                      {ajudante.end_ajudante[0].logradouro.bairro?.cidade?.estado && `/${ajudante.end_ajudante[0].logradouro.bairro.cidade.estado.sigla_estado}`}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
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

      {/* Add Ajudante Modal */}
      <AddAjudanteModal
        isOpen={isAddAjudanteModalOpen}
        onClose={() => setIsAddAjudanteModalOpen(false)}
        onSuccess={() => {
          fetchAgregadoDetails();
          toast.success('Ajudante adicionado com sucesso');
        }}
        motorista_id={motorista_id}
        veiculo_id={veiculo?.veiculo_id}
      />
    </div>
  );
};

export default UnifiedAgregadoModal;