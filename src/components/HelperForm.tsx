import React, { useState, useEffect } from 'react';
import { X, Loader2, User, CreditCard, FileText, Camera, Upload, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF } from '../utils/format';

interface HelperFormProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo_id: number;
  onSuccess: () => void;
  helper?: {
    id_ajudante: number;
    nome: string;
    cpf: string;
    telefone: string;
    genero: string;
    comprovante_residencia: string | null;
  } | null;
}

const HelperForm: React.FC<HelperFormProps> = ({
  isOpen,
  onClose,
  veiculo_id,
  onSuccess,
  helper = null
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    genero: '',
    comprovante_residencia: '',
    foto_cnh: '',
    nr_registro: '',
    categoria: '',
    nome_pai: '',
    nome_mae: '',
    foto_rg: '',
    nr_rg: '',
    orgao_expedidor: '',
    data_emissao: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (helper) {
        fetchHelperDetails();
      } else {
        setLoading(false);
      }
    }
  }, [isOpen, helper]);

  const fetchHelperDetails = async () => {
    if (!helper) return;
    
    try {
      setLoading(true);
      
      // Fetch helper details
      const [cnhResponse, rgResponse] = await Promise.all([
        supabase
          .from('cnh_ajudante')
          .select('*')
          .eq('id_ajudante', helper.id_ajudante)
          .maybeSingle(),
        supabase
          .from('rg_ajudante')
          .select('*')
          .eq('id_ajudante', helper.id_ajudante)
          .maybeSingle()
      ]);

      if (cnhResponse.error) throw cnhResponse.error;
      if (rgResponse.error) throw rgResponse.error;

      const cnhData = cnhResponse.data;
      const rgData = rgResponse.data;

      setFormData({
        nome: helper.nome || '',
        cpf: helper.cpf ? String(helper.cpf) : '',
        telefone: helper.telefone || '',
        genero: helper.genero || '',
        comprovante_residencia: helper.comprovante_residencia || '',
        
        // CNH data
        foto_cnh: cnhData?.foto_cnh || '',
        nr_registro: cnhData?.nr_registro ? String(cnhData.nr_registro) : '',
        categoria: cnhData?.categoria || '',
        nome_pai: cnhData?.nome_pai || '',
        nome_mae: cnhData?.nome_mae || '',
        
        // RG data
        foto_rg: rgData?.foto_rg || '',
        nr_rg: rgData?.nr_rg ? String(rgData.nr_rg) : '',
        orgao_expedidor: rgData?.orgao_expedidor || '',
        data_emissao: rgData?.data_emissao ? new Date(rgData.data_emissao).toISOString().split('T')[0] : ''
      });
    } catch (error) {
      console.error('Error fetching helper details:', error);
      toast.error('Erro ao carregar detalhes do ajudante');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Validate CPF format
      if (formData.cpf && !/^\d{11}$/.test(formData.cpf.replace(/\D/g, ''))) {
        throw new Error('CPF inválido. Digite 11 números.');
      }

      let ajudanteId: number;
      
      if (helper) {
        // Update existing helper
        const { error: updateError } = await supabase
          .from('documento_ajudante')
          .update({
            nome: formData.nome,
            cpf: formData.cpf ? parseFloat(formData.cpf.replace(/\D/g, '')) : null,
            telefone: formData.telefone,
            genero: formData.genero,
            comprovante_residencia: formData.comprovante_residencia
          })
          .eq('id_ajudante', helper.id_ajudante);
          
        if (updateError) throw updateError;
        
        ajudanteId = helper.id_ajudante;
      } else {
        // Create new helper
        const { data: newHelper, error: createError } = await supabase
          .from('documento_ajudante')
          .insert({
            nome: formData.nome,
            cpf: formData.cpf ? parseFloat(formData.cpf.replace(/\D/g, '')) : null,
            telefone: formData.telefone,
            genero: formData.genero,
            comprovante_residencia: formData.comprovante_residencia,
            veiculo_id
          })
          .select()
          .single();
          
        if (createError) throw createError;
        if (!newHelper) throw new Error('Erro ao criar ajudante');
        
        ajudanteId = newHelper.id_ajudante;
      }
      
      // Handle CNH data
      if (formData.nr_registro || formData.categoria || formData.nome_pai || formData.nome_mae || formData.foto_cnh) {
        const cnhData = {
          nr_registro: formData.nr_registro ? parseFloat(formData.nr_registro) : null,
          categoria: formData.categoria,
          nome_pai: formData.nome_pai,
          nome_mae: formData.nome_mae,
          foto_cnh: formData.foto_cnh,
          id_ajudante: ajudanteId
        };
        
        // Check if CNH record exists
        const { data: existingCnh } = await supabase
          .from('cnh_ajudante')
          .select('id_cnh_ajudante')
          .eq('id_ajudante', ajudanteId)
          .maybeSingle();
          
        if (existingCnh) {
          // Update existing CNH
          await supabase
            .from('cnh_ajudante')
            .update(cnhData)
            .eq('id_cnh_ajudante', existingCnh.id_cnh_ajudante);
        } else {
          // Create new CNH
          await supabase
            .from('cnh_ajudante')
            .insert(cnhData);
        }
      }
      
      // Handle RG data
      if (formData.nr_rg || formData.orgao_expedidor || formData.data_emissao || formData.foto_rg) {
        const rgData = {
          nr_rg: formData.nr_rg ? parseFloat(formData.nr_rg) : null,
          orgao_expedidor: formData.orgao_expedidor,
          data_emissao: formData.data_emissao || null,
          foto_rg: formData.foto_rg,
          id_ajudante: ajudanteId
        };
        
        // Check if RG record exists
        const { data: existingRg } = await supabase
          .from('rg_ajudante')
          .select('id_rg_ajudante')
          .eq('id_ajudante', ajudanteId)
          .maybeSingle();
          
        if (existingRg) {
          // Update existing RG
          await supabase
            .from('rg_ajudante')
            .update(rgData)
            .eq('id_rg_ajudante', existingRg.id_rg_ajudante);
        } else {
          // Create new RG
          await supabase
            .from('rg_ajudante')
            .insert(rgData);
        }
      }
      
      toast.success(helper ? 'Ajudante atualizado com sucesso' : 'Ajudante adicionado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving helper:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar ajudante');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDocumentUpload = async (file: File, documentType: string) => {
    if (!file) return;
    
    try {
      setUploading(documentType);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `ajudante_${documentType}_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileExt?.toLowerCase() === 'pdf' ? 'application/pdf' : undefined
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);

      // Update form data with the URL
      setFormData(prev => ({ ...prev, [documentType]: publicUrl }));
      
      toast.success('Documento enviado com sucesso');
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Erro ao enviar documento');
    } finally {
      setUploading(null);
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {helper ? 'Editar Ajudante' : 'Adicionar Ajudante'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                    Informações Pessoais
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome *
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
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 11) {
                          setFormData(prev => ({ ...prev, cpf: value }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      maxLength={11}
                      placeholder="Digite o CPF (somente números)"
                    />
                    {formData.cpf && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatCPF(formData.cpf)}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      name="telefone"
                      value={formData.telefone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setFormData(prev => ({ ...prev, telefone: value }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="(00) 00000-0000"
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
                </div>
              </div>
              
              {/* CNH Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                    Informações da CNH
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número da CNH
                    </label>
                    <input
                      type="text"
                      name="nr_registro"
                      value={formData.nr_registro}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Categoria
                    </label>
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleInputChange}
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome do Pai
                    </label>
                    <input
                      type="text"
                      name="nome_pai"
                      value={formData.nome_pai}
                      onChange={handleInputChange}
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
                      value={formData.nome_mae}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                
                {/* CNH Document Upload */}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      CNH Digital
                    </div>
                    {formData.foto_cnh && (
                      <button
                        type="button"
                        onClick={() => openDocumentInNewTab(formData.foto_cnh)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                      >
                        <ExternalLink size={14} />
                        Abrir em nova aba
                      </button>
                    )}
                  </div>
                  
                  {formData.foto_cnh ? (
                    <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {isPdf(formData.foto_cnh) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <FileText className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveDocument(formData.foto_cnh)}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                            >
                              <FileText size={16} />
                              Visualizar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, foto_cnh: '' }))}
                              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm flex items-center gap-1"
                            >
                              <X size={16} />
                              Remover
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <img
                            src={formData.foto_cnh}
                            alt="CNH"
                            className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                            onClick={() => setActiveDocument(formData.foto_cnh)}
                          />
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, foto_cnh: '' }))}
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
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocumentUpload(file, 'foto_cnh');
                        }}
                        className="sr-only"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                      />
                      <label
                        htmlFor="file-cnh"
                        className="flex flex-col items-center justify-center w-full aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                  border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                  hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        {uploading === 'foto_cnh' ? (
                          <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-10 h-10 text-gray-400 mb-4" />
                            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              JPEG, PNG ou PDF (máx. 15MB)
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              </div>
              
              {/* RG Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                    Informações do RG
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número do RG
                    </label>
                    <input
                      type="text"
                      name="nr_rg"
                      value={formData.nr_rg}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Órgão Expedidor
                    </label>
                    <input
                      type="text"
                      name="orgao_expedidor"
                      value={formData.orgao_expedidor}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Data de Emissão
                    </label>
                    <input
                      type="date"
                      name="data_emissao"
                      value={formData.data_emissao}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                
                {/* RG Document Upload */}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      RG Digital
                    </div>
                    {formData.foto_rg && (
                      <button
                        type="button"
                        onClick={() => openDocumentInNewTab(formData.foto_rg)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                      >
                        <ExternalLink size={14} />
                        Abrir em nova aba
                      </button>
                    )}
                  </div>
                  
                  {formData.foto_rg ? (
                    <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {isPdf(formData.foto_rg) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <FileText className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveDocument(formData.foto_rg)}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                            >
                              <FileText size={16} />
                              Visualizar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, foto_rg: '' }))}
                              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm flex items-center gap-1"
                            >
                              <X size={16} />
                              Remover
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <img
                            src={formData.foto_rg}
                            alt="RG"
                            className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                            onClick={() => setActiveDocument(formData.foto_rg)}
                          />
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, foto_rg: '' }))}
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
                        id="file-rg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocumentUpload(file, 'foto_rg');
                        }}
                        className="sr-only"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                      />
                      <label
                        htmlFor="file-rg"
                        className="flex flex-col items-center justify-center w-full aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                  border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                  hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        {uploading === 'foto_rg' ? (
                          <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-10 h-10 text-gray-400 mb-4" />
                            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              JPEG, PNG ou PDF (máx. 15MB)
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Comprovante de Residência */}
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                    Comprovante de Residência
                  </h3>
                </div>
                
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Comprovante Digital
                  </div>
                  {formData.comprovante_residencia && (
                    <button
                      type="button"
                      onClick={() => openDocumentInNewTab(formData.comprovante_residencia)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                    >
                      <ExternalLink size={14} />
                      Abrir em nova aba
                    </button>
                  )}
                </div>
                
                {formData.comprovante_residencia ? (
                  <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    {isPdf(formData.comprovante_residencia) ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveDocument(formData.comprovante_residencia)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                          >
                            <FileText size={16} />
                            Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, comprovante_residencia: '' }))}
                            className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm flex items-center gap-1"
                          >
                            <X size={16} />
                            Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <img
                          src={formData.comprovante_residencia}
                          alt="Comprovante de Residência"
                          className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                          onClick={() => setActiveDocument(formData.comprovante_residencia)}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, comprovante_residencia: '' }))}
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
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocumentUpload(file, 'comprovante_residencia');
                      }}
                      className="sr-only"
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                    />
                    <label
                      htmlFor="file-comprovante"
                      className="flex flex-col items-center justify-center w-full aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      {uploading === 'comprovante_residencia' ? (
                        <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-10 h-10 text-gray-400 mb-4" />
                          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            JPEG, PNG ou PDF (máx. 15MB)
                          </p>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </form>
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
    </div>
  );
};

export default HelperForm;