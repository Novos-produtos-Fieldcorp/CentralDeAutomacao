import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, CreditCard, Home, FileText, Camera, Upload, ExternalLink } from 'lucide-react';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';

interface DocumentoMotoristaFormProps {
  isOpen: boolean;
  onClose: () => void;
  motorista_id: number;
  onSuccess: () => void;
}

const DocumentoMotoristaForm: React.FC<DocumentoMotoristaFormProps> = ({
  isOpen,
  onClose,
  motorista_id,
  onSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingDocumento, setExistingDocumento] = useState<any | null>(null);
  const [veiculo, setVeiculo] = useState<any | null>(null);
  const [documentoVeiculo, setDocumentoVeiculo] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    foto_cnh: '',
    foto_comprovante_residencia: '',
    nr_registro_cnh: '',
    categoria_cnh: '',
    validade_cnh: '',
    uf_cnh: '',
    nome_pai: '',
    nome_mae: ''
  });

  const [veiculoData, setVeiculoData] = useState({
    foto_crv: ''
  });

  useEffect(() => {
    if (isOpen && motorista_id) {
      fetchExistingDocumento();
      fetchVeiculoInfo();
    }
  }, [isOpen, motorista_id]);

  const fetchExistingDocumento = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingDocumento(data);
        setFormData({
          foto_cnh: data.foto_cnh || '',
          foto_comprovante_residencia: data.foto_comprovante_residencia || '',
          nr_registro_cnh: data.nr_registro_cnh ? String(data.nr_registro_cnh) : '',
          categoria_cnh: data.categoria_cnh || '',
          validade_cnh: data.validade_cnh ? data.validade_cnh.split('T')[0] : '',
          uf_cnh: data.uf_cnh || '',
          nome_pai: data.nome_pai || '',
          nome_mae: data.nome_mae || ''
        });
      }
    } catch (error) {
      console.error('Error fetching documento:', error);
      toast.error('Erro ao carregar documento');
    } finally {
      setLoading(false);
    }
  };

  const fetchVeiculoInfo = async () => {
    try {
      // Get vehicle associated with this motorista
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculo')
        .select('*')
        .eq('motorista_id', motorista_id)
        .eq('status_veiculo', true)
        .maybeSingle();

      if (veiculoError) throw veiculoError;
      
      if (veiculoData) {
        setVeiculo(veiculoData);
        
        // Get vehicle document if it exists
        const { data: docData, error: docError } = await supabase
          .from('documento_veiculo')
          .select('*')
          .eq('veiculo_id', veiculoData.veiculo_id)
          .maybeSingle();
          
        if (docError) throw docError;
        
        if (docData) {
          setDocumentoVeiculo(docData);
          setVeiculoData({
            foto_crv: docData.foto_crv || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching vehicle info:', error);
      // Don't show error toast as vehicle might not exist
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Prepare document data, ensuring numeric fields are properly handled
      const documentoData = {
        foto_cnh: formData.foto_cnh,
        foto_comprovante_residencia: formData.foto_comprovante_residencia,
        nr_registro_cnh: formData.nr_registro_cnh ? parseFloat(formData.nr_registro_cnh) : null,
        categoria_cnh: formData.categoria_cnh,
        validade_cnh: formData.validade_cnh || null,
        uf_cnh: formData.uf_cnh,
        nome_pai: formData.nome_pai,
        nome_mae: formData.nome_mae,
        motorista_id
      };
      
      let response;
      
      if (existingDocumento) {
        // Update existing documento
        response = await supabase
          .from('documento_motorista')
          .update(documentoData)
          .eq('id_documento_motorista', existingDocumento.id_documento_motorista);
      } else {
        // Insert new documento
        response = await supabase
          .from('documento_motorista')
          .insert(documentoData);
      }
      
      const { error } = response;
      
      if (error) throw error;
      
      // Update vehicle document if vehicle exists
      if (veiculo && veiculoData.foto_crv) {
        if (documentoVeiculo) {
          // Update existing vehicle document
          const { error: veiculoError } = await supabase
            .from('documento_veiculo')
            .update({ foto_crv: veiculoData.foto_crv })
            .eq('id_documento_veiculo', documentoVeiculo.id_documento_veiculo);
            
          if (veiculoError) throw veiculoError;
        } else {
          // Create new vehicle document
          const { error: veiculoError } = await supabase
            .from('documento_veiculo')
            .insert({ 
              veiculo_id: veiculo.veiculo_id,
              foto_crv: veiculoData.foto_crv
            });
            
          if (veiculoError) throw veiculoError;
        }
      }
      
      toast.success('Documentos salvos com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving documento:', error);
      toast.error('Erro ao salvar documentos');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDocumentUpload = (field: string, url: string) => {
    setFormData(prev => ({ ...prev, [field]: url }));
  };

  const handleVeiculoDocumentUpload = (field: string, url: string) => {
    setVeiculoData(prev => ({ ...prev, [field]: url }));
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
            Documentos do Motorista
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
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CNH Information */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <CreditCard className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                    Informações da CNH
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número da CNH
                    </label>
                    <input
                      type="text"
                      name="nr_registro_cnh"
                      value={formData.nr_registro_cnh}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Categoria
                    </label>
                    <select
                      name="categoria_cnh"
                      value={formData.categoria_cnh}
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
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Validade
                    </label>
                    <input
                      type="date"
                      name="validade_cnh"
                      value={formData.validade_cnh}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      UF
                    </label>
                    <select
                      name="uf_cnh"
                      value={formData.uf_cnh}
                      onChange={handleInputChange}
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
              </div>
              
              {/* CNH Document */}
              <div>
                <div className="mb-2 flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Foto da CNH
                  </label>
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
                            onClick={() => openDocumentInNewTab(formData.foto_cnh)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                          >
                            <ExternalLink size={16} />
                            Abrir
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
                          onClick={() => openDocumentInNewTab(formData.foto_cnh)}
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
                        if (!file) return;
                        
                        // Check file size (max 15MB)
                        if (file.size > 15 * 1024 * 1024) {
                          toast.error('O arquivo é muito grande. Tamanho máximo: 15MB');
                          return;
                        }
                        
                        // Check file type
                        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
                        if (!validTypes.includes(file.type)) {
                          toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
                          return;
                        }
                        
                        // Upload file
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${motorista_id}_cnh_${Date.now()}.${fileExt}`;
                        
                        supabase.storage
                          .from('imagensdocs')
                          .upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: true,
                            contentType: fileExt?.toLowerCase() === 'pdf' ? 'application/pdf' : undefined
                          })
                          .then(({ data, error }) => {
                            if (error) {
                              toast.error('Erro ao enviar arquivo');
                              console.error(error);
                              return;
                            }
                            
                            const { data: { publicUrl } } = supabase.storage
                              .from('imagensdocs')
                              .getPublicUrl(fileName);
                              
                            setFormData(prev => ({ ...prev, foto_cnh: publicUrl }));
                            toast.success('Arquivo enviado com sucesso');
                          });
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

              {/* Comprovante de Residência */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Home className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                    Comprovante de Residência
                  </h3>
                </div>
                
                <div className="mb-2 flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Foto do Comprovante
                  </label>
                  {formData.foto_comprovante_residencia && (
                    <button
                      type="button"
                      onClick={() => openDocumentInNewTab(formData.foto_comprovante_residencia)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                    >
                      <ExternalLink size={14} />
                      Abrir em nova aba
                    </button>
                  )}
                </div>
                
                {formData.foto_comprovante_residencia ? (
                  <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    {isPdf(formData.foto_comprovante_residencia) ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openDocumentInNewTab(formData.foto_comprovante_residencia)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                          >
                            <ExternalLink size={16} />
                            Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, foto_comprovante_residencia: '' }))}
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
                          src={formData.foto_comprovante_residencia}
                          alt="Comprovante de Residência"
                          className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                          onClick={() => openDocumentInNewTab(formData.foto_comprovante_residencia)}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, foto_comprovante_residencia: '' }))}
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
                        if (!file) return;
                        
                        // Check file size (max 15MB)
                        if (file.size > 15 * 1024 * 1024) {
                          toast.error('O arquivo é muito grande. Tamanho máximo: 15MB');
                          return;
                        }
                        
                        // Check file type
                        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
                        if (!validTypes.includes(file.type)) {
                          toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
                          return;
                        }
                        
                        // Upload file
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${motorista_id}_comprovante_${Date.now()}.${fileExt}`;
                        
                        supabase.storage
                          .from('imagensdocs')
                          .upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: true,
                            contentType: fileExt?.toLowerCase() === 'pdf' ? 'application/pdf' : undefined
                          })
                          .then(({ data, error }) => {
                            if (error) {
                              toast.error('Erro ao enviar arquivo');
                              console.error(error);
                              return;
                            }
                            
                            const { data: { publicUrl } } = supabase.storage
                              .from('imagensdocs')
                              .getPublicUrl(fileName);
                              
                            setFormData(prev => ({ ...prev, foto_comprovante_residencia: publicUrl }));
                            toast.success('Arquivo enviado com sucesso');
                          });
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

              {/* CRV Section - Only show if vehicle exists */}
              {veiculo && (
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                      CRV do Veículo
                    </h3>
                  </div>
                  
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
                    {veiculoData.foto_crv && (
                      <button
                        type="button"
                        onClick={() => openDocumentInNewTab(veiculoData.foto_crv)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                      >
                        <ExternalLink size={14} />
                        Abrir em nova aba
                      </button>
                    )}
                  </div>
                  
                  {veiculoData.foto_crv ? (
                    <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {isPdf(veiculoData.foto_crv) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <FileText className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openDocumentInNewTab(veiculoData.foto_crv)}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                            >
                              <ExternalLink size={16} />
                              Abrir
                            </button>
                            <button
                              type="button"
                              onClick={() => setVeiculoData(prev => ({ ...prev, foto_crv: '' }))}
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
                            src={veiculoData.foto_crv}
                            alt="CRV do veículo"
                            className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                            onClick={() => openDocumentInNewTab(veiculoData.foto_crv)}
                          />
                          <button
                            type="button"
                            onClick={() => setVeiculoData(prev => ({ ...prev, foto_crv: '' }))}
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
                        id="file-crv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          // Check file size (max 15MB)
                          if (file.size > 15 * 1024 * 1024) {
                            toast.error('O arquivo é muito grande. Tamanho máximo: 15MB');
                            return;
                          }
                          
                          // Check file type
                          const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
                          if (!validTypes.includes(file.type)) {
                            toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
                            return;
                          }
                          
                          // Upload file
                          const fileExt = file.name.split('.').pop();
                          const fileName = `${veiculo.veiculo_id}_crv_${Date.now()}.${fileExt}`;
                          
                          supabase.storage
                            .from('imagensdocs')
                            .upload(fileName, file, {
                              cacheControl: '3600',
                              upsert: true,
                              contentType: fileExt?.toLowerCase() === 'pdf' ? 'application/pdf' : undefined
                            })
                            .then(({ data, error }) => {
                              if (error) {
                                toast.error('Erro ao enviar arquivo');
                                console.error(error);
                                return;
                              }
                              
                              const { data: { publicUrl } } = supabase.storage
                                .from('imagensdocs')
                                .getPublicUrl(fileName);
                                
                              setVeiculoData(prev => ({ ...prev, foto_crv: publicUrl }));
                              toast.success('Arquivo enviado com sucesso');
                            });
                        }}
                        className="sr-only"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                      />
                      <label
                        htmlFor="file-crv"
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
              )}
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
      </div>
    </div>
  );
};

export default DocumentoMotoristaForm;