import React, { useState, useEffect, useRef } from 'react';
import { X, Truck, MapPin, FileText, Camera, Loader2, ExternalLink, Upload, Phone, Mail, Calendar, CreditCard, Info, User, Home, Edit2, Save, Check } from 'lucide-react';
import type { DocumentoMotorista, Veiculo, DocumentoVeiculo, Motorista } from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface UnifiedMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista?: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedMotoristaModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedMotoristaModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details');
  const [loading, setLoading] = useState(true);
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [motoristaData, setMotoristaData] = useState<Motorista | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { companyId } = useAuth();
  
  // Form state for editing
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    dt_nascimento: '',
    genero: '',
    st_cadastro: 'cadastrado',
    
    // Address fields
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complemento: ''
  });

  // Document form state
  const [documentoForm, setDocumentoForm] = useState({
    nr_registro_cnh: '',
    categoria_cnh: '',
    validade_cnh: '',
    uf_cnh: '',
    nome_pai: '',
    nome_mae: '',
    foto_cnh: '',
    foto_comprovante_residencia: ''
  });

  // States
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const [loadingCep, setLoadingCep] = useState(false);

  useEffect(() => {
    if (isOpen && motorista) {
      setMotoristaData(motorista);
      fetchMotoristaDetails();
      fetchEstados();
    }
  }, [isOpen, motorista]);

  useEffect(() => {
    if (motoristaData) {
      setFormData({
        nome: motoristaData.nome || '',
        cpf: motoristaData.cpf || '',
        email: motoristaData.email || '',
        telefone: motoristaData.telefone?.toString() || '',
        dt_nascimento: motoristaData.dt_nascimento ? new Date(motoristaData.dt_nascimento).toISOString().split('T')[0] : '',
        genero: motoristaData.genero || '',
        st_cadastro: motoristaData.st_cadastro || 'cadastrado',
        
        // Address fields will be populated when endereco is loaded
        cep: '',
        estado: '',
        cidade: '',
        bairro: '',
        logradouro: '',
        numero: '',
        complemento: ''
      });
    }
  }, [motoristaData]);

  useEffect(() => {
    if (endereco) {
      setFormData(prev => ({
        ...prev,
        cep: endereco.logradouro?.nr_cep || '',
        estado: endereco.logradouro?.bairro?.cidade?.estado?.id_estado?.toString() || '',
        cidade: endereco.logradouro?.bairro?.cidade?.cidade || '',
        bairro: endereco.logradouro?.bairro?.bairro || '',
        logradouro: endereco.logradouro?.logradouro || '',
        numero: endereco.nr_end?.toString() || '',
        complemento: endereco.ds_complemento_end || ''
      }));
    }
  }, [endereco]);

  useEffect(() => {
    if (documento) {
      setDocumentoForm({
        nr_registro_cnh: documento.nr_registro_cnh?.toString() || '',
        categoria_cnh: documento.categoria_cnh || '',
        validade_cnh: documento.validade_cnh ? documento.validade_cnh.split('T')[0] : '',
        uf_cnh: documento.uf_cnh || '',
        nome_pai: documento.nome_pai || '',
        nome_mae: documento.nome_mae || '',
        foto_cnh: documento.foto_cnh || '',
        foto_comprovante_residencia: documento.foto_comprovante_residencia || ''
      });
    }
  }, [documento]);

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

  const fetchMotoristaDetails = async () => {
    if (!motorista) return;
    
    try {
      setLoading(true);
      
      // Fetch documento_motorista
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      if (documentoError && documentoError.code !== 'PGRST116') {
        throw documentoError;
      }

      setDocumento(documentoData);

      // Fetch endereco
      const { data: enderecoData, error: enderecoError } = await supabase
        .from('end_motorista')
        .select(`
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
        .eq('id_motorista', motorista.motorista_id)
        .eq('st_end', true)
        .maybeSingle();

      if (enderecoError && enderecoError.code !== 'PGRST116') {
        throw enderecoError;
      }

      setEndereco(enderecoData);
      
      // Fetch updated motorista data
      const { data: updatedMotorista, error: motoristaError } = await supabase
        .from('motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .single();
        
      if (motoristaError) {
        throw motoristaError;
      }
      
      setMotoristaData(updatedMotorista);
    } catch (error) {
      console.error('Error fetching motorista details:', error);
      toast.error('Erro ao carregar detalhes do motorista');
    } finally {
      setLoading(false);
    }
  };

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  const handleDocumentUpload = async (file: File, documentType: string) => {
    if (!motorista || !file) return;
    
    try {
      setUploading(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${motorista.motorista_id}_${documentType}_${Date.now()}.${fileExt}`;

      // For PDF files, we need to convert to base64 and then to blob to ensure proper MIME type
      let fileToUpload = file;
      if (fileExt?.toLowerCase() === 'pdf') {
        // Convert to base64 and back to blob to ensure proper MIME type
        const reader = new FileReader();
        const dataPromise = new Promise<Blob>((resolve, reject) => {
          reader.onload = () => {
            try {
              // Create a new blob with the correct MIME type
              const blob = new Blob([reader.result as ArrayBuffer], { type: 'application/pdf' });
              resolve(blob);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
        
        fileToUpload = await dataPromise;
      }

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileExt?.toLowerCase() === 'pdf' ? 'application/pdf' : undefined
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);

      // Update the appropriate document record
      if (documentType === 'cnh' || documentType === 'comprovante_residencia') {
        // Update documento_motorista
        const updateData: any = {};
        if (documentType === 'cnh') {
          updateData.foto_cnh = publicUrl;
          setDocumentoForm(prev => ({ ...prev, foto_cnh: publicUrl }));
        } else {
          updateData.foto_comprovante_residencia = publicUrl;
          setDocumentoForm(prev => ({ ...prev, foto_comprovante_residencia: publicUrl }));
        }

        if (documento) {
          // Update existing record
          const { error } = await supabase
            .from('documento_motorista')
            .update(updateData)
            .eq('id_documento_motorista', documento.id_documento_motorista);
            
          if (error) throw error;
        } else {
          // Create new record
          const { error } = await supabase
            .from('documento_motorista')
            .insert({ 
              motorista_id: motorista.motorista_id, 
              ...updateData 
            });
            
          if (error) throw error;
        }
      }
      
      toast.success('Documento enviado com sucesso');
      fetchMotoristaDetails(); // Refresh data
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  const consultarCep = async (cep: string) => {
    if (cep.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP não encontrado');
      }

      // Find estado_id based on UF
      const estado = estados.find(e => e.sigla_estado === data.uf);

      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: estado ? estado.id_estado.toString() : '',
        complemento: data.complemento || ''
      }));

      toast.success('CEP encontrado!');
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar CEP');
      
      // Clear address fields on error
      setFormData(prev => ({
        ...prev,
        logradouro: '',
        bairro: '',
        cidade: '',
        estado: '',
        complemento: ''
      }));
    } finally {
      setLoadingCep(false);
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

  const handleDocumentoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDocumentoForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveDocumento = async () => {
    if (!motorista) return;
    
    try {
      setSaving(true);
      
      // Prepare document data, ensuring numeric fields are properly handled
      const documentoData = {
        foto_cnh: documentoForm.foto_cnh,
        foto_comprovante_residencia: documentoForm.foto_comprovante_residencia,
        nr_registro_cnh: documentoForm.nr_registro_cnh ? parseFloat(documentoForm.nr_registro_cnh) : null,
        categoria_cnh: documentoForm.categoria_cnh,
        validade_cnh: documentoForm.validade_cnh || null,
        uf_cnh: documentoForm.uf_cnh,
        nome_pai: documentoForm.nome_pai,
        nome_mae: documentoForm.nome_mae,
        motorista_id: motorista.motorista_id
      };
      
      let response;
      
      if (documento) {
        // Update existing documento
        response = await supabase
          .from('documento_motorista')
          .update(documentoData)
          .eq('id_documento_motorista', documento.id_documento_motorista);
      } else {
        // Insert new documento
        response = await supabase
          .from('documento_motorista')
          .insert(documentoData);
      }
      
      const { error } = response;
      
      if (error) throw error;
      
      toast.success('Documentos salvos com sucesso');
      fetchMotoristaDetails();
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving documento:', error);
      toast.error('Erro ao salvar documentos');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePersonalInfo = async () => {
    if (!motorista) return;
    
    try {
      setSaving(true);
      
      // Update motorista data
      const { error: motoristaError } = await supabase
        .from('motorista')
        .update({
          nome: formData.nome,
          cpf: formData.cpf,
          email: formData.email || null,
          telefone: formData.telefone ? Number(formData.telefone.replace(/\D/g, '')) : null,
          dt_nascimento: formData.dt_nascimento || null,
          genero: formData.genero || null,
          st_cadastro: formData.st_cadastro
        })
        .eq('motorista_id', motorista.motorista_id);

      if (motoristaError) throw motoristaError;

      // Update or create address if all required fields are filled
      if (formData.logradouro && formData.cidade && formData.estado) {
        try {
          // First, check if cidade exists
          let cidadeId: number;
          const { data: cidade, error: cidadeError } = await supabase
            .from('cidade')
            .select('id_cidade')
            .eq('cidade', formData.cidade)
            .eq('id_estado', parseInt(formData.estado))
            .maybeSingle();

          if (cidadeError && cidadeError.code !== 'PGRST116') {
            throw cidadeError;
          }

          if (cidade) {
            cidadeId = cidade.id_cidade;
          } else {
            // Create cidade if it doesn't exist
            const { data: newCidade, error: newCidadeError } = await supabase
              .from('cidade')
              .insert({
                cidade: formData.cidade,
                id_estado: parseInt(formData.estado)
              })
              .select()
              .single();

            if (newCidadeError) throw newCidadeError;
            if (!newCidade) throw new Error('Erro ao criar cidade');
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

          if (bairroError && bairroError.code !== 'PGRST116') {
            throw bairroError;
          }
          
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
            if (!newBairro) throw new Error('Erro ao criar bairro');
            bairroId = newBairro.id_bairro;
          }

          // Check if logradouro exists
          let logradouroId: number;
          const { data: logradouro, error: logradouroError } = await supabase
            .from('logradouro')
            .select('id_logradouro')
            .eq('logradouro', formData.logradouro)
            .eq('nr_cep', formData.cep)
            .eq('id_bairro', bairroId)
            .maybeSingle();

          if (logradouroError && logradouroError.code !== 'PGRST116') {
            throw logradouroError;
          }
          
          if (logradouro) {
            logradouroId = logradouro.id_logradouro;
          } else {
            // Create logradouro if it doesn't exist
            const { data: newLogradouro, error: newLogradouroError } = await supabase
              .from('logradouro')
              .insert({
                logradouro: formData.logradouro,
                nr_cep: formData.cep,
                id_bairro: bairroId
              })
              .select()
              .single();

            if (newLogradouroError) throw newLogradouroError;
            if (!newLogradouro) throw new Error('Erro ao criar logradouro');
            logradouroId = newLogradouro.id_logradouro;
          }

          // Update or create end_motorista
          if (endereco) {
            // Update existing address
            const { error: enderecoError } = await supabase
              .from('end_motorista')
              .update({
                nr_end: formData.numero ? parseInt(formData.numero) : null,
                ds_complemento_end: formData.complemento || null,
                id_logradouro: logradouroId
              })
              .eq('id_motorista', motorista.motorista_id)
              .eq('st_end', true);

            if (enderecoError) throw enderecoError;
          } else {
            // Create new address
            const { error: enderecoError } = await supabase
              .from('end_motorista')
              .insert({
                nr_end: formData.numero ? parseInt(formData.numero) : null,
                ds_complemento_end: formData.complemento || null,
                id_motorista: motorista.motorista_id,
                id_logradouro: logradouroId,
                st_end: true
              });

            if (enderecoError) throw enderecoError;
          }
        } catch (error) {
          console.error('Erro ao atualizar endereço:', error);
          toast.error('Erro ao atualizar endereço');
        }
      }

      toast.success('Informações atualizadas com sucesso');
      setIsEditing(false);
      fetchMotoristaDetails();
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error updating motorista:', error);
      toast.error('Erro ao atualizar motorista');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !motorista) return null;

  // Use motoristaData for rendering to ensure we show the most up-to-date information
  const displayData = motoristaData || motorista;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {displayData.nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Motorista • {formatCPF(displayData.cpf)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                           rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'details'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <User className="w-5 h-5 mr-2" />
                  Detalhes
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'documents'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Documentos
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="p-6">
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    {/* Personal Information */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 relative">
                      <div className="absolute top-6 right-6">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsEditing(false)}
                              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 
                                       dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 
                                       rounded-lg transition-colors flex items-center gap-1 w-auto"
                            >
                              <X className="w-4 h-4" />
                              Cancelar
                            </button>
                            <button
                              onClick={handleSavePersonalInfo}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 
                                       dark:bg-blue-600 dark:hover:bg-blue-700 
                                       rounded-lg transition-colors flex items-center gap-1 w-auto"
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
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                                     dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                                     rounded-lg transition-colors flex items-center gap-1 w-auto"
                          >
                            <Edit2 className="w-4 h-4" />
                            Editar
                          </button>
                        )}
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
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
                              required
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
                              required
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
                              required
                            >
                              <option value="cadastrado">Cadastrado</option>
                              <option value="qualificado">Qualificado</option>
                              <option value="documentacao">Documentação</option>
                              <option value="contrato_enviado">Contrato Enviado</option>
                              <option value="contratado">Contratado</option>
                              <option value="repescagem">Repescagem</option>
                              <option value="rejeitado">Rejeitado</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {displayData.nome}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {formatCPF(displayData.cpf)}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {displayData.dt_nascimento ? formatDate(displayData.dt_nascimento) : 'Não informada'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {displayData.telefone ? formatPhone(displayData.telefone.toString()) : 'Não informado'}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {displayData.email || 'Não informado'}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                              <div className="text-base text-gray-900 dark:text-white break-words capitalize">
                                {displayData.st_cadastro.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                    
                    {/* Address */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-gray-400" />
                          Endereço
                        </h3>
                        {isEditing && (
                          <div className="text-sm text-blue-600 dark:text-blue-400">
                            Editando endereço
                          </div>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              CEP
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                name="cep"
                                value={formData.cep}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  if (value.length <= 8) {
                                    setFormData(prev => ({ ...prev, cep: value }));
                                    if (value.length === 8) {
                                      consultarCep(value);
                                    }
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                maxLength={8}
                                placeholder="00000-000"
                              />
                              {loadingCep && (
                                <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg">
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                </div>
                              )}
                            </div>
                            {formData.cep && formData.cep.length === 8 && (
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {formatCEP(formData.cep)}
                              </div>
                            )}
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
                              onChange={(e) => {
                                // Only allow numbers
                                const value = e.target.value.replace(/\D/g, '');
                                setFormData(prev => ({ ...prev, numero: value }));
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              placeholder="Digite apenas números"
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Logradouro</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.logradouro?.logradouro ? 
                                  `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                                  'Não informado'
                                }
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Complemento</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.ds_complemento_end || 'Não informado'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Bairro</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.logradouro?.bairro?.bairro || 'Não informado'}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CEP</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Cidade/Estado</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.logradouro?.bairro?.cidade?.cidade && endereco?.logradouro?.bairro?.cidade?.estado?.sigla_estado ? 
                                  `${endereco.logradouro.bairro.cidade.cidade}/${endereco.logradouro.bairro.cidade.estado.sigla_estado}` : 
                                  'Não informado'
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="space-y-6">                   
                    {/* CNH Section */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-gray-400" />
                          Carteira Nacional de Habilitação (CNH)
                        </h3>
                        <div className="flex gap-2">
                          {saving ? (
                            <div className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 
                                         dark:text-gray-300 dark:bg-gray-700 
                                         rounded-lg flex items-center gap-1">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Salvando...
                            </div>
                          ) : (
                            <button
                              onClick={handleSaveDocumento}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                                       dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                                       rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Save className="w-4 h-4" />
                              Salvar
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Número da CNH
                              </label>
                              <input
                                type="text"
                                name="nr_registro_cnh"
                                value={documentoForm.nr_registro_cnh}
                                onChange={handleDocumentoChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Categoria
                              </label>
                              <select
                                name="categoria_cnh"
                                value={documentoForm.categoria_cnh}
                                onChange={handleDocumentoChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              >
                                <option value="">Selecione</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                                <option value="E">E</option>
                                <option value="AB">AB</option>
                                <option value="AC">AC</option>
                                <option value="AD">AD</option>
                                <option value="AE">AE</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Validade
                              </label>
                              <input
                                type="date"
                                name="validade_cnh"
                                value={documentoForm.validade_cnh}
                                onChange={handleDocumentoChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                UF
                              </label>
                              <select
                                name="uf_cnh"
                                value={documentoForm.uf_cnh}
                                onChange={handleDocumentoChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              >
                                <option value="">Selecione</option>
                                <option value="AC">AC</option>
                                <option value="AL">AL</option>
                                <option value="AP">AP</option>
                                <option value="AM">AM</option>
                                <option value="BA">BA</option>
                                <option value="CE">CE</option>
                                <option value="DF">DF</option>
                                <option value="ES">ES</option>
                                <option value="GO">GO</option>
                                <option value="MA">MA</option>
                                <option value="MT">MT</option>
                                <option value="MS">MS</option>
                                <option value="MG">MG</option>
                                <option value="PA">PA</option>
                                <option value="PB">PB</option>
                                <option value="PR">PR</option>
                                <option value="PE">PE</option>
                                <option value="PI">PI</option>
                                <option value="RJ">RJ</option>
                                <option value="RN">RN</option>
                                <option value="RS">RS</option>
                                <option value="RO">RO</option>
                                <option value="RR">RR</option>
                                <option value="SC">SC</option>
                                <option value="SP">SP</option>
                                <option value="SE">SE</option>
                                <option value="TO">TO</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome do Pai
                              </label>
                              <input
                                type="text"
                                name="nome_pai"
                                value={documentoForm.nome_pai}
                                onChange={handleDocumentoChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome da Mãe
                              </label>
                              <input
                                type="text"
                                name="nome_mae"
                                value={documentoForm.nome_mae}
                                onChange={handleDocumentoChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* CNH Document */}
                        <div>
                          <div className="mb-2 flex justify-between items-center">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Foto da CNH
                            </label>
                            {documentoForm.foto_cnh && (
                              <button
                                onClick={() => openDocumentInNewTab(documentoForm.foto_cnh)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                              >
                                <ExternalLink size={14} />
                                Abrir em nova aba
                              </button>
                            )}
                          </div>
                          
                          {documentoForm.foto_cnh ? (
                            <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {isPdf(documentoForm.foto_cnh) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                  <button
                                    onClick={() => setActiveDocument(documentoForm.foto_cnh)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                  >
                                    <FileText size={16} />
                                    Visualizar PDF
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <img
                                    src={documentoForm.foto_cnh}
                                    alt="CNH"
                                    className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                    onClick={() => setActiveDocument(documentoForm.foto_cnh)}
                                  />
                                  <button
                                    onClick={() => setDocumentoForm(prev => ({ ...prev, foto_cnh: '' }))}
                                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                    title="Remover documento"
                                  >
                                    <X size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="file"
                                id="file-cnh"
                                className="hidden"
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleDocumentUpload(file, 'cnh');
                                  }
                                }}
                              />
                              <label
                                htmlFor="file-cnh"
                                className="flex flex-col items-center justify-center w-full aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                          border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                          hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                              >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  <Camera className="w-10 h-10 text-gray-400 mb-4" />
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
                    </section>
                    
                    {/* Comprovante de Residência Section */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Home className="w-5 h-5 text-gray-400" />
                        Comprovante de Residência
                      </h3>
                      
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Comprovante de Residência
                        </div>
                        {documentoForm.foto_comprovante_residencia && (
                          <button
                            onClick={() => openDocumentInNewTab(documentoForm.foto_comprovante_residencia)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                          >
                            <ExternalLink size={14} />
                            Abrir em nova aba
                          </button>
                        )}
                      </div>
                      
                      {documentoForm.foto_comprovante_residencia ? (
                        <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                          {isPdf(documentoForm.foto_comprovante_residencia) ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <FileText className="w-12 h-12 text-gray-400 mb-2" />
                              <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                              <button
                                onClick={() => setActiveDocument(documentoForm.foto_comprovante_residencia)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                              >
                                <FileText size={16} />
                                Visualizar PDF
                              </button>
                            </div>
                          ) : (
                            <>
                              <img
                                src={documentoForm.foto_comprovante_residencia}
                                alt="Comprovante de Residência"
                                className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                onClick={() => setActiveDocument(documentoForm.foto_comprovante_residencia)}
                              />
                              <button
                                onClick={() => setDocumentoForm(prev => ({ ...prev, foto_comprovante_residencia: '' }))}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                title="Remover documento"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="file"
                            id="file-comprovante"
                            className="hidden"
                            accept="image/jpeg,image/png,image/jpg,application/pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleDocumentUpload(file, 'comprovante_residencia');
                              }
                            }}
                          />
                          <label
                            htmlFor="file-comprovante"
                            className="flex flex-col items-center justify-center w-full aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                      border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                      hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Camera className="w-10 h-10 text-gray-400 mb-4" />
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
                    </section>
                  </div>
                )}
              </div>
            )}
            
            {/* Footer with standardized buttons */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-6">
              <div className="flex justify-end gap-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 
                           dark:border-gray-600 dark:hover:bg-gray-700"
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
    </div>
  );
};

export default UnifiedMotoristaModal;