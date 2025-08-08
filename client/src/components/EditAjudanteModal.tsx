import { useState, useEffect } from 'react';
import { X, Loader2, Camera, Upload, Eye, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCEP } from '../utils/format';

// Using any type for the address data to avoid complex type definitions
// This is a temporary solution to fix TypeScript errors

interface EditAjudanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  ajudante: any;
  onSuccess: () => void;
}

const EditAjudanteModal = ({ isOpen, onClose, ajudante, onSuccess }: EditAjudanteModalProps) => {
  // Move all hooks to the top of the component
  const [submitting, setSubmitting] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const [documentType, setDocumentType] = useState<'cnh' | 'rg'>('cnh');
  const [uploading, setUploading] = useState<{cnh: boolean, rg: boolean, comprovante: boolean}>({
    cnh: false,
    rg: false,
    comprovante: false
  });
  
  const [showPreview, setShowPreview] = useState<{[key: string]: boolean}>({
    foto_cnh: false,
    foto_rg: false,
    comprovante_residencia: false
  });
  
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    genero: '',
    
    // CNH
    nr_registro: '',
    categoria: '',
    nome_pai: '',
    nome_mae: '',
    foto_cnh: '',
    
    // RG
    nr_rg: '',
    data_emissao: '',
    orgao_expedidor: '',
    filiacao: '',
    foto_rg: '',
    
    // Endereço
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complemento: '',
    comprovante_residencia: ''
  });

  // Remove unused state since we're not using it elsewhere
  // const [endereco, setEndereco] = useState<EnderecoAjudante | null>(null);
  const [cnhData, setCnhData] = useState<any | null>(null);
  const [rgData, setRgData] = useState<any | null>(null);

  // useEffect hooks
  useEffect(() => {
    if (isOpen) {
      fetchEstados();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && ajudante) {
      fetchAjudanteData();
    }
  }, [isOpen, ajudante]);

  // Early return after all hooks
  if (!isOpen) return null;
  
  // Check for valid ajudante ID
  if (!ajudante || !ajudante.id_ajudante) {
    console.error('Invalid ajudante ID:', ajudante);
    return null;
  }

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

  const fetchAjudanteData = async () => {
    try {
      setLoading(true);
      
      // Fetch ajudante details
      setFormData({
        nome: ajudante.nome || '',
        cpf: ajudante.cpf ? String(ajudante.cpf) : '',
        telefone: ajudante.telefone || '',
        genero: ajudante.genero || '',
        
        // CNH
        nr_registro: '',
        categoria: '',
        nome_pai: '',
        nome_mae: '',
        foto_cnh: '',
        
        // RG
        nr_rg: '',
        data_emissao: '',
        orgao_expedidor: '',
        filiacao: '',
        foto_rg: '',
        
        // Endereço
        cep: '',
        estado: '',
        cidade: '',
        bairro: '',
        logradouro: '',
        numero: '',
        complemento: '',
        comprovante_residencia: ajudante.comprovante_residencia || ''
      });
      
      // Fetch CNH data
      const { data: cnhData, error: cnhError } = await supabase
        .from('cnh_ajudante')
        .select('*')
        .eq('id_ajudante', ajudante.id_ajudante)
        .maybeSingle();
      
      if (cnhError && cnhError.code !== 'PGRST116') throw cnhError;
      
      if (cnhData) {
        setCnhData(cnhData);
        setDocumentType('cnh');
        setFormData(prev => ({
          ...prev,
          nr_registro: cnhData.nr_registro ? String(cnhData.nr_registro) : '',
          categoria: cnhData.categoria || '',
          nome_pai: cnhData.nome_pai || '',
          nome_mae: cnhData.nome_mae || '',
          foto_cnh: cnhData.foto_cnh || ''
        }));
      }
      
      // Fetch RG data
      const { data: rgData, error: rgError } = await supabase
        .from('rg_ajudante')
        .select('*')
        .eq('id_ajudante', ajudante.id_ajudante)
        .maybeSingle();
      
      if (rgError && rgError.code !== 'PGRST116') throw rgError;
      
      if (rgData) {
        setRgData(rgData);
        setDocumentType('rg');
        setFormData(prev => ({
          ...prev,
          nr_rg: rgData.nr_rg ? String(rgData.nr_rg) : '',
          data_emissao: rgData.data_emissao || '',
          orgao_expedidor: rgData.orgao_expedidor || '',
          filiacao: rgData.filiacao || '',
          foto_rg: rgData.foto_rg || ''
        }));
      }
      
      // Fetch address data
      const { data: enderecoData, error: enderecoError } = await supabase
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
                  id_estado,
                  sigla_estado
                )
              )
            )
          )
        `)
        .eq('id_ajudante', ajudante.id_ajudante)
        .maybeSingle();
      
      if (enderecoError && enderecoError.code !== 'PGRST116') throw enderecoError;
      
      if (enderecoData) {
        // Simplify the address data handling
        const logradouro = Array.isArray(enderecoData.logradouro) ? enderecoData.logradouro[0] : enderecoData.logradouro;
        const bairro = logradouro?.bairro?.[0] || {};
        const cidade = bairro?.cidade?.[0] || {};
        const estado = cidade?.estado?.[0] || {};
        
        // Create a safe address object with fallbacks
        const address = {
          cep: logradouro?.nr_cep || '',
          estado: estado?.id_estado?.toString() || '',
          cidade: cidade?.cidade || '',
          bairro: bairro?.bairro || '',
          logradouro: logradouro?.logradouro || '',
          numero: enderecoData.nr_end?.toString() || '',
          complemento: enderecoData.ds_complemento_end || ''
        };
        
        setFormData(prev => ({
          ...prev,
          ...address
        }));
      }
    } catch (error) {
      console.error('Error fetching ajudante data:', error);
      toast.error('Erro ao carregar dados do ajudante');
    } finally {
      setLoading(false);
    }
  };

  const consultarCepLocal = async (cep: string) => {
    if (cep.length !== 8) return;

    setLoadingCep(true);
    try {
      const { consultarCep } = await import('../utils/cepService');
      const data = await consultarCep(cep);

      const estadoId = estados.find(e => e.sigla_estado === data.uf)?.id_estado.toString() || '';
      
      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: estadoId,
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

  const consultarCpfLocal = async (cpf: string) => {
    if (!cpf || cpf.length !== 11) return;
    
    try {
      const { consultarCpfApi } = await import('../utils/cpfService');
      const data = await consultarCpfApi(cpf);
      
      const estadoId = estados.find(e => e.sigla_estado === data.estado)?.id_estado.toString() || '';
      
      setFormData(prev => ({
        ...prev,
        nome: data.nome || prev.nome,
        telefone: data.telefone || prev.telefone,
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.cidade || prev.cidade,
        estado: estadoId || prev.estado,
        cep: data.cep || prev.cep
      }));
      
      toast.success('Dados do CPF preenchidos!');
    } catch (error) {
      console.error('Erro ao consultar CPF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar CPF');
    }
  };

  const consultarCpfApi = async (cpf: string) => {
    if (!cpf || cpf.length !== 11) return;
    
    try {
      const { consultarCpfApi } = await import('../utils/cpfService');
      const data = await consultarCpfApi(cpf);
      
      const estadoId = estados.find(e => e.sigla_estado === data.estado)?.id_estado.toString() || '';
      
      setFormData(prev => ({
        ...prev,
        nome: data.nome || prev.nome,
        telefone: data.telefone || prev.telefone,
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.cidade || prev.cidade,
        estado: estadoId || prev.estado,
        cep: data.cep || prev.cep
      }));
      
      toast.success('Dados do CPF preenchidos!');
    } catch (error) {
      console.error('Erro ao consultar CPF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar CPF');
    }
  };

  const togglePreview = (field: string) => {
    setShowPreview(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const isImageFile = (url: string) => {
    return url.toLowerCase().match(/\.(jpeg|jpg|png|gif)$/);
  };

  const isPDFFile = (url: string) => {
    return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'foto_cnh' | 'foto_rg' | 'comprovante_residencia') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. Tamanho máximo: 5MB');
      return;
    }
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
      return;
    }
    
    try {
      setUploading(prev => ({ ...prev, [field]: true }));
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `ajudante_${ajudante.id_ajudante}_${field}_${Date.now()}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, file);
        
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);
        
      // Update form data with the URL
      setFormData(prev => ({ ...prev, [field]: publicUrl }));
      
      toast.success('Arquivo enviado com sucesso');
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);

      // Update ajudante basic info using the standard Supabase client
      const { error: ajudanteError } = await supabase
        .from('documento_ajudante')
        .update({
          nome: formData.nome,
          cpf: formData.cpf ? parseFloat(formData.cpf) : null,
          telefone: formData.telefone || null,
          genero: formData.genero || null,
          comprovante_residencia: formData.comprovante_residencia || null,
          updated_at: new Date().toISOString()
        })
        .eq('id_ajudante', ajudante.id_ajudante);

      if (ajudanteError) throw ajudanteError;

      // Handle document type (CNH or RG)
      if (documentType === 'cnh') {
        // Check if CNH record exists
        if (cnhData) {
          // Update existing CNH
          const { error: cnhError } = await supabase
            .from('cnh_ajudante')
            .update({
              nr_registro: formData.nr_registro ? parseFloat(formData.nr_registro) : null,
              categoria: formData.categoria || null,
              nome_pai: formData.nome_pai || null,
              nome_mae: formData.nome_mae || null,
              foto_cnh: formData.foto_cnh || null
            })
            .eq('id_cnh_ajudante', cnhData.id_cnh_ajudante);

          if (cnhError) throw cnhError;
        } else {
          // Create new CNH record
          const { error: cnhError } = await supabase
            .from('cnh_ajudante')
            .insert({
              nr_registro: formData.nr_registro ? parseFloat(formData.nr_registro) : null,
              categoria: formData.categoria || null,
              nome_pai: formData.nome_pai || null,
              nome_mae: formData.nome_mae || null,
              foto_cnh: formData.foto_cnh || null,
              id_ajudante: ajudante.id_ajudante
            });

          if (cnhError) throw cnhError;
        }
        
        // Delete RG if it exists and we're switching to CNH
        if (rgData) {
          const { error: deleteRgError } = await supabase
            .from('rg_ajudante')
            .delete()
            .eq('id_rg_ajudante', rgData.id_rg_ajudante);
            
          if (deleteRgError) throw deleteRgError;
        }
      } else if (documentType === 'rg') {
        // Check if RG record exists
        if (rgData) {
          // Update existing RG
          const { error: rgError } = await supabase
            .from('rg_ajudante')
            .update({
              nr_rg: formData.nr_rg ? parseFloat(formData.nr_rg) : null,
              data_emissao: formData.data_emissao || null,
              orgao_expedidor: formData.orgao_expedidor || null,
              filiacao: formData.filiacao || null,
              foto_rg: formData.foto_rg || null
            })
            .eq('id_rg_ajudante', rgData.id_rg_ajudante);

          if (rgError) throw rgError;
        } else {
          // Create new RG record
          const { error: rgError } = await supabase
            .from('rg_ajudante')
            .insert({
              nr_rg: formData.nr_rg ? parseFloat(formData.nr_rg) : null,
              data_emissao: formData.data_emissao || null,
              orgao_expedidor: formData.orgao_expedidor || null,
              filiacao: formData.filiacao || null,
              foto_rg: formData.foto_rg || null,
              id_ajudante: ajudante.id_ajudante
            });

          if (rgError) throw rgError;
        }
        
        // Delete CNH if it exists and we're switching to RG
        if (cnhData) {
          const { error: deleteCnhError } = await supabase
            .from('cnh_ajudante')
            .delete()
            .eq('id_cnh_ajudante', cnhData.id_cnh_ajudante);
            
          if (deleteCnhError) throw deleteCnhError;
        }
      }

      // Handle address
      if (formData.logradouro && formData.cidade && formData.estado) {
        try {
          // First, find the estado_id based on sigla_estado
          const estadoId = parseInt(formData.estado);
          
          // Check if cidade exists
          let cidadeId: number;
          const { data: cidade, error: cidadeError } = await supabase
            .from('cidade')
            .select('id_cidade')
            .eq('cidade', formData.cidade)
            .eq('id_estado', estadoId)
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
                id_estado: estadoId
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
            .eq('bairro', formData.bairro || 'Centro')
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
                bairro: formData.bairro || 'Centro',
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
            .eq('nr_cep', formData.cep || null)
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
                nr_cep: formData.cep || null,
                id_bairro: bairroId
              })
              .select()
              .single();

            if (newLogradouroError) throw newLogradouroError;
            if (!newLogradouro) throw new Error('Erro ao criar logradouro');
            logradouroId = newLogradouro.id_logradouro;
          }

          // Check if endereco exists
          const { data: existingEndereco, error: enderecoCheckError } = await supabase
            .from('end_ajudante')
            .select('id_end_ajudante')
            .eq('id_ajudante', ajudante.id_ajudante)
            .maybeSingle();
            
          if (enderecoCheckError && enderecoCheckError.code !== 'PGRST116') {
            throw enderecoCheckError;
          }
          
          if (existingEndereco) {
            // Update existing endereco
            const { error: updateEnderecoError } = await supabase
              .from('end_ajudante')
              .update({
                nr_end: formData.numero ? parseInt(formData.numero) : null,
                ds_complemento_end: formData.complemento || null,
                id_logradouro: logradouroId
              })
              .eq('id_end_ajudante', existingEndereco.id_end_ajudante);

            if (updateEnderecoError) throw updateEnderecoError;
          } else {
            // Create new endereco
            const { error: newEnderecoError } = await supabase
              .from('end_ajudante')
              .insert({
                nr_end: formData.numero ? parseInt(formData.numero) : null,
                ds_complemento_end: formData.complemento || null,
                id_ajudante: ajudante.id_ajudante,
                id_logradouro: logradouroId
              });

            if (newEnderecoError) throw newEnderecoError;
          }
        } catch (error) {
          console.error('Erro ao atualizar endereço:', error);
          toast.error('Erro ao atualizar endereço');
        }
      }

      toast.success('Ajudante atualizado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating ajudante:', error);
      toast.error('Erro ao atualizar ajudante');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Editar Ajudante
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
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Personal Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Informações Pessoais
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CPF *
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
                    onBlur={(e) => {
                      const cpf = e.target.value.replace(/\D/g, '');
                      if (cpf.length === 11) {
                        consultarCpfLocal(cpf);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                    maxLength={11}
                    placeholder="Digite o CPF (somente números)"
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
                    onChange={(e) => setFormData(prev => ({ ...prev, genero: e.target.value }))}
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

            {/* Document Type Selection */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Tipo de Documento
              </h3>
              
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={documentType === 'cnh'}
                    onChange={() => setDocumentType('cnh')}
                    className="mr-2 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CNH</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={documentType === 'rg'}
                    onChange={() => setDocumentType('rg')}
                    className="mr-2 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">RG</span>
                </label>
              </div>
            </div>

            {/* CNH Information - Only show if CNH is selected */}
            {documentType === 'cnh' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  Informações da CNH
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número da CNH
                    </label>
                    <input
                      type="text"
                      name="nr_registro"
                      value={formData.nr_registro}
                      onChange={(e) => setFormData(prev => ({ ...prev, nr_registro: e.target.value }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, nome_pai: e.target.value }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, nome_mae: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Foto da CNH
                    </label>
                    <div className="mt-1 flex items-center">
                      <div className="flex-1">
                        <label className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <div className="space-y-1 text-center">
                            <Camera className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600 dark:text-gray-400">
                              <span className="relative rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                {formData.foto_cnh ? 'Trocar arquivo' : 'Enviar arquivo'}
                              </span>
                              <input 
                                id="foto_cnh" 
                                name="foto_cnh" 
                                type="file" 
                                className="sr-only"
                                onChange={(e) => handleFileUpload(e, 'foto_cnh')}
                                accept="image/jpeg,image/png,application/pdf"
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              PNG, JPG ou PDF até 5MB
                            </p>
                          </div>
                        </label>
                      </div>
                      {uploading.cnh && (
                        <div className="ml-4">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                      )}
                      {formData.foto_cnh && !uploading.cnh && (
                        <div className="ml-4 flex items-center gap-2">
                          <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Documento enviado
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePreview('foto_cnh')}
                            className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            {showPreview.foto_cnh ? 'Ocultar' : 'Ver'}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Inline CNH Preview */}
                    {formData.foto_cnh && showPreview.foto_cnh && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Foto da CNH</h4>
                          <div className="flex items-center gap-2">
                            <a
                              href={formData.foto_cnh}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Abrir em nova aba
                            </a>
                            <button
                              type="button"
                              onClick={() => togglePreview('foto_cnh')}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {isImageFile(formData.foto_cnh) ? (
                          <img
                            src={formData.foto_cnh}
                            alt="Foto da CNH"
                            className="max-w-full h-auto max-h-64 rounded-md mx-auto block"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <div className="text-center">
                              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-500 dark:text-gray-400">PDF Document</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RG Information - Only show if RG is selected */}
            {documentType === 'rg' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  Informações do RG
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número do RG
                    </label>
                    <input
                      type="text"
                      name="nr_rg"
                      value={formData.nr_rg}
                      onChange={(e) => setFormData(prev => ({ ...prev, nr_rg: e.target.value }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, data_emissao: e.target.value }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, orgao_expedidor: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Filiação
                    </label>
                    <input
                      type="text"
                      name="filiacao"
                      value={formData.filiacao}
                      onChange={(e) => setFormData(prev => ({ ...prev, filiacao: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Foto do RG
                    </label>
                    <div className="mt-1 flex items-center">
                      <div className="flex-1">
                        <label className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <div className="space-y-1 text-center">
                            <Camera className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600 dark:text-gray-400">
                              <span className="relative rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                {formData.foto_rg ? 'Trocar arquivo' : 'Enviar arquivo'}
                              </span>
                              <input 
                                id="foto_rg" 
                                name="foto_rg" 
                                type="file" 
                                className="sr-only"
                                onChange={(e) => handleFileUpload(e, 'foto_rg')}
                                accept="image/jpeg,image/png,application/pdf"
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              PNG, JPG ou PDF até 5MB
                            </p>
                          </div>
                        </label>
                      </div>
                      {uploading.rg && (
                        <div className="ml-4">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                      )}
                      {formData.foto_rg && !uploading.rg && (
                        <div className="ml-4 flex items-center gap-2">
                          <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Documento enviado
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePreview('foto_rg')}
                            className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            {showPreview.foto_rg ? 'Ocultar' : 'Ver'}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Inline RG Preview */}
                    {formData.foto_rg && showPreview.foto_rg && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Foto do RG</h4>
                          <div className="flex items-center gap-2">
                            <a
                              href={formData.foto_rg}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Abrir em nova aba
                            </a>
                            <button
                              type="button"
                              onClick={() => togglePreview('foto_rg')}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {isImageFile(formData.foto_rg) ? (
                          <img
                            src={formData.foto_rg}
                            alt="Foto do RG"
                            className="max-w-full h-auto max-h-64 rounded-md mx-auto block"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <div className="text-center">
                              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-500 dark:text-gray-400">PDF Document</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Address Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Endereço
              </h3>
              
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
                        setFormData(prev => ({ ...prev, cep: value }));
                        if (value.length === 8) {
                          consultarCepLocal(value);
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
                    onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Comprovante de Residência
                  </label>
                  <div className="mt-1 flex items-center">
                    <div className="flex-1">
                      <label className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <div className="space-y-1 text-center">
                          <Camera className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="flex text-sm text-gray-600 dark:text-gray-400">
                            <span className="relative rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                              {formData.comprovante_residencia ? 'Trocar arquivo' : 'Enviar arquivo'}
                            </span>
                            <input 
                              id="comprovante_residencia" 
                              name="comprovante_residencia" 
                              type="file" 
                              className="sr-only"
                              onChange={(e) => handleFileUpload(e, 'comprovante_residencia')}
                              accept="image/jpeg,image/png,application/pdf"
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            PNG, JPG ou PDF até 5MB
                          </p>
                        </div>
                      </label>
                    </div>
                    {uploading.comprovante && (
                      <div className="ml-4">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                    {formData.comprovante_residencia && !uploading.comprovante && (
                      <div className="ml-4 flex items-center gap-2">
                        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                          <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Documento enviado
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePreview('comprovante_residencia')}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          {showPreview.comprovante_residencia ? 'Ocultar' : 'Ver'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Inline Address Proof Preview */}
                  {formData.comprovante_residencia && showPreview.comprovante_residencia && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Comprovante de Residência</h4>
                        <div className="flex items-center gap-2">
                          <a
                            href={formData.comprovante_residencia}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Abrir em nova aba
                          </a>
                          <button
                            type="button"
                            onClick={() => togglePreview('comprovante_residencia')}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {isImageFile(formData.comprovante_residencia) ? (
                        <img
                          src={formData.comprovante_residencia}
                          alt="Comprovante de Residência"
                          className="max-w-full h-auto max-h-64 rounded-md mx-auto block"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-700 rounded-md">
                          <div className="text-center">
                            <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">PDF Document</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
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

export default EditAjudanteModal;