import { useState, useEffect } from 'react';
import { X, Loader2, User, Phone, MapPin, Camera, Upload, Eye, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCEP } from '../utils/format';
import DocumentPreview from './DocumentPreview';
import { validateCnhNumber, formatCnhInput } from '../utils/cnhValidation';

interface UnifiedAjudanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  motorista_id: number;
  ajudante?: any; // Only required for edit mode
  onSuccess: () => void;
}

const UnifiedAjudanteModal = ({ 
  isOpen, 
  onClose, 
  mode, 
  motorista_id, 
  ajudante = null, 
  onSuccess 
}: UnifiedAjudanteModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const [documentType, setDocumentType] = useState<'cnh' | 'rg'>('cnh');
  const [uploading, setUploading] = useState<{cnh: boolean, rg: boolean, comprovante: boolean}>({
    cnh: false,
    rg: false,
    comprovante: false
  });
  const [previewDocument, setPreviewDocument] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [cnhData, setCnhData] = useState<any | null>(null);
  const [rgData, setRgData] = useState<any | null>(null);
  
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

  useEffect(() => {
    if (isOpen) {
      fetchEstados();
      if (mode === 'edit' && ajudante) {
        fetchAjudanteData();
      } else if (mode === 'add') {
        // Reset form for add mode
        resetForm();
      }
    }
  }, [isOpen, mode, ajudante]);

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      telefone: '',
      genero: '',
      nr_registro: '',
      categoria: '',
      nome_pai: '',
      nome_mae: '',
      foto_cnh: '',
      nr_rg: '',
      data_emissao: '',
      orgao_expedidor: '',
      filiacao: '',
      foto_rg: '',
      cep: '',
      estado: '',
      cidade: '',
      bairro: '',
      logradouro: '',
      numero: '',
      complemento: '',
      comprovante_residencia: ''
    });
    setDocumentType('cnh');
    setCnhData(null);
    setRgData(null);
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

  const fetchAjudanteData = async () => {
    if (!ajudante || !ajudante.id_ajudante) return;

    try {
      setLoading(true);
      
      // Set basic ajudante data
      setFormData(prev => ({
        ...prev,
        nome: ajudante.nome || '',
        cpf: ajudante.cpf ? String(ajudante.cpf) : '',
        telefone: ajudante.telefone || '',
        genero: ajudante.genero || '',
        comprovante_residencia: ajudante.comprovante_residencia || ''
      }));
      
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
        if (!cnhData) { // Only set RG as default if no CNH data
          setDocumentType('rg');
        }
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
        const logradouro = Array.isArray(enderecoData.logradouro) ? enderecoData.logradouro[0] : enderecoData.logradouro;
        const bairro = logradouro?.bairro?.[0] || {};
        const cidade = bairro?.cidade?.[0] || {};
        const estado = cidade?.estado?.[0] || {};
        
        const address = {
          cep: logradouro?.nr_cep || '',
          estado: estado?.sigla_estado || '',
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

      const estado = estados.find(e => e.sigla_estado === data.uf);

      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: estado ? estado.sigla_estado : '',
        complemento: data.complemento || ''
      }));

      toast.success('CEP encontrado!');
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar CEP');
      
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
      
      setFormData(prev => ({
        ...prev,
        nome: data.nome || prev.nome,
        telefone: data.telefone || prev.telefone,
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.cidade || prev.cidade,
        estado: data.estado || prev.estado,
        cep: data.cep || prev.cep
      }));
      
      toast.success('Dados do CPF preenchidos!');
    } catch (error) {
      console.error('Erro ao consultar CPF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar CPF');
    }
  };

  const handleFileUpload = async (file: File, field: 'foto_cnh' | 'foto_rg' | 'comprovante_residencia') => {
    if (!file) return;
    
    try {
      setUploading(prev => ({ ...prev, [field]: true }));
      
      const fileExt = file.name.split('.').pop();
      const fileName = `ajudante_${Date.now()}_${field}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, file);
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);
        
      setFormData(prev => ({ ...prev, [field]: publicUrl }));
      
      toast.success('Arquivo enviado com sucesso');
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handlePreviewDocument = (url: string) => {
    setPreviewDocument(url);
    setShowPreviewModal(true);
  };

  const handleRemoveDocument = (field: 'foto_cnh' | 'foto_rg' | 'comprovante_residencia') => {
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);

      // Validate CPF format
      if (!/^\d{11}$/.test(formData.cpf)) {
        throw new Error('CPF inválido. Digite 11 números.');
      }

      if (mode === 'add') {
        await handleAddAjudante();
      } else {
        await handleEditAjudante();
      }

      toast.success(`Ajudante ${mode === 'add' ? 'cadastrado' : 'atualizado'} com sucesso`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error(`Erro ao ${mode === 'add' ? 'cadastrar' : 'atualizar'} ajudante:`, error);
      toast.error(error instanceof Error ? error.message : `Erro ao ${mode === 'add' ? 'cadastrar' : 'atualizar'} ajudante`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAjudante = async () => {
    // Insert documento_ajudante
    const { data: ajudanteData, error: ajudanteError } = await supabase
      .from('documento_ajudante')
      .insert({
        nome: formData.nome,
        cpf: formData.cpf ? parseFloat(formData.cpf) : null,
        telefone: formData.telefone || null,
        genero: formData.genero || null,
        motorista_id: motorista_id,
        comprovante_residencia: formData.comprovante_residencia || null
      })
      .select()
      .single();

    if (ajudanteError) {
      if (ajudanteError.code === '23505') {
        throw new Error('CPF já cadastrado no sistema.');
      }
      throw new Error(`Erro ao cadastrar ajudante: ${ajudanteError.message}`);
    }

    if (!ajudanteData) {
      throw new Error('Erro ao cadastrar ajudante: nenhum dado retornado');
    }

    await handleDocumentInserts(ajudanteData.id_ajudante);
    await handleAddressInsert(ajudanteData.id_ajudante);
  };

  const handleEditAjudante = async () => {
    if (!ajudante?.id_ajudante) throw new Error('ID do ajudante não encontrado');

    // Update documento_ajudante
    const { error: ajudanteError } = await supabase
      .from('documento_ajudante')
      .update({
        nome: formData.nome,
        cpf: formData.cpf ? parseFloat(formData.cpf) : null,
        telefone: formData.telefone || null,
        genero: formData.genero || null,
        comprovante_residencia: formData.comprovante_residencia || null
      })
      .eq('id_ajudante', ajudante.id_ajudante);

    if (ajudanteError) throw ajudanteError;

    await handleDocumentUpdates(ajudante.id_ajudante);
    await handleAddressUpdate(ajudante.id_ajudante);
  };

  const handleDocumentInserts = async (ajudanteId: number) => {
    // Insert CNH if data is provided and document type is CNH
    if (documentType === 'cnh' && (formData.nr_registro || formData.categoria || formData.nome_pai || formData.nome_mae || formData.foto_cnh)) {
      const { error: cnhError } = await supabase
        .from('cnh_ajudante')
        .insert({
          nr_registro: formData.nr_registro ? parseFloat(formData.nr_registro) : null,
          categoria: formData.categoria || null,
          nome_pai: formData.nome_pai || null,
          nome_mae: formData.nome_mae || null,
          foto_cnh: formData.foto_cnh || null,
          id_ajudante: ajudanteId
        });

      if (cnhError) throw cnhError;
    }

    // Insert RG if data is provided and document type is RG
    if (documentType === 'rg' && (formData.nr_rg || formData.data_emissao || formData.orgao_expedidor || formData.filiacao || formData.foto_rg)) {
      const { error: rgError } = await supabase
        .from('rg_ajudante')
        .insert({
          nr_rg: formData.nr_rg ? parseFloat(formData.nr_rg) : null,
          data_emissao: formData.data_emissao || null,
          orgao_expedidor: formData.orgao_expedidor || null,
          filiacao: formData.filiacao || null,
          foto_rg: formData.foto_rg || null,
          id_ajudante: ajudanteId
        });

      if (rgError) throw rgError;
    }
  };

  const handleDocumentUpdates = async (ajudanteId: number) => {
    // Update or create CNH data
    if (documentType === 'cnh') {
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
          .eq('id_ajudante', ajudanteId);

        if (cnhError) throw cnhError;
      } else if (formData.nr_registro || formData.categoria || formData.nome_pai || formData.nome_mae || formData.foto_cnh) {
        // Create new CNH record
        const { error: cnhError } = await supabase
          .from('cnh_ajudante')
          .insert({
            nr_registro: formData.nr_registro ? parseFloat(formData.nr_registro) : null,
            categoria: formData.categoria || null,
            nome_pai: formData.nome_pai || null,
            nome_mae: formData.nome_mae || null,
            foto_cnh: formData.foto_cnh || null,
            id_ajudante: ajudanteId
          });

        if (cnhError) throw cnhError;
      }
    }

    // Update or create RG data
    if (documentType === 'rg') {
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
          .eq('id_ajudante', ajudanteId);

        if (rgError) throw rgError;
      } else if (formData.nr_rg || formData.data_emissao || formData.orgao_expedidor || formData.filiacao || formData.foto_rg) {
        // Create new RG record
        const { error: rgError } = await supabase
          .from('rg_ajudante')
          .insert({
            nr_rg: formData.nr_rg ? parseFloat(formData.nr_rg) : null,
            data_emissao: formData.data_emissao || null,
            orgao_expedidor: formData.orgao_expedidor || null,
            filiacao: formData.filiacao || null,
            foto_rg: formData.foto_rg || null,
            id_ajudante: ajudanteId
          });

        if (rgError) throw rgError;
      }
    }
  };

  const handleAddressInsert = async (ajudanteId: number) => {
    if (!formData.logradouro || !formData.cidade || !formData.estado) return;

    try {
      // Find the estado_id based on sigla_estado
      const { data: estadoData, error: estadoError } = await supabase
        .from('estado')
        .select('id_estado')
        .eq('sigla_estado', formData.estado)
        .single();

      if (estadoError) {
        throw new Error(`Estado "${formData.estado}" não encontrado. Use a sigla do estado (ex: SP, RJ).`);
      }
      
      // Check if cidade exists or create it
      let cidadeId = await getOrCreateCidade(formData.cidade, estadoData.id_estado);
      
      // Check if bairro exists or create it
      let bairroId = await getOrCreateBairro(formData.bairro || 'Centro', cidadeId);
      
      // Check if logradouro exists or create it
      let logradouroId = await getOrCreateLogradouro(formData.logradouro, formData.cep, bairroId);

      // Create end_ajudante
      const { error: enderecoError } = await supabase
        .from('end_ajudante')
        .insert({
          nr_end: formData.numero ? parseInt(formData.numero) : null,
          ds_complemento_end: formData.complemento || null,
          id_ajudante: ajudanteId,
          id_logradouro: logradouroId
        });

      if (enderecoError) throw enderecoError;
    } catch (error) {
      console.error('Erro ao cadastrar endereço:', error);
      toast.error('Erro ao cadastrar endereço, mas o ajudante foi salvo');
    }
  };

  const handleAddressUpdate = async (ajudanteId: number) => {
    if (!formData.logradouro || !formData.cidade || !formData.estado) return;

    try {
      // Similar logic to insert but update existing address if it exists
      const { data: estadoData, error: estadoError } = await supabase
        .from('estado')
        .select('id_estado')
        .eq('sigla_estado', formData.estado)
        .single();

      if (estadoError) {
        throw new Error(`Estado "${formData.estado}" não encontrado.`);
      }
      
      let cidadeId = await getOrCreateCidade(formData.cidade, estadoData.id_estado);
      let bairroId = await getOrCreateBairro(formData.bairro || 'Centro', cidadeId);
      let logradouroId = await getOrCreateLogradouro(formData.logradouro, formData.cep, bairroId);

      // Check if address exists
      const { data: existingAddress, error: addressError } = await supabase
        .from('end_ajudante')
        .select('*')
        .eq('id_ajudante', ajudanteId)
        .maybeSingle();

      if (addressError && addressError.code !== 'PGRST116') throw addressError;

      if (existingAddress) {
        // Update existing address
        const { error: updateError } = await supabase
          .from('end_ajudante')
          .update({
            nr_end: formData.numero ? parseInt(formData.numero) : null,
            ds_complemento_end: formData.complemento || null,
            id_logradouro: logradouroId
          })
          .eq('id_ajudante', ajudanteId);

        if (updateError) throw updateError;
      } else {
        // Create new address
        const { error: insertError } = await supabase
          .from('end_ajudante')
          .insert({
            nr_end: formData.numero ? parseInt(formData.numero) : null,
            ds_complemento_end: formData.complemento || null,
            id_ajudante: ajudanteId,
            id_logradouro: logradouroId
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Erro ao atualizar endereço:', error);
      toast.error('Erro ao atualizar endereço, mas o ajudante foi salvo');
    }
  };

  // Helper functions for address handling
  const getOrCreateCidade = async (cidade: string, estadoId: number): Promise<number> => {
    const { data: existing, error: findError } = await supabase
      .from('cidade')
      .select('id_cidade')
      .eq('cidade', cidade)
      .eq('id_estado', estadoId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') throw findError;

    if (existing) {
      return existing.id_cidade;
    }

    const { data: newCidade, error: createError } = await supabase
      .from('cidade')
      .insert({ cidade, id_estado: estadoId })
      .select()
      .single();

    if (createError) throw createError;
    return newCidade.id_cidade;
  };

  const getOrCreateBairro = async (bairro: string, cidadeId: number): Promise<number> => {
    const { data: existing, error: findError } = await supabase
      .from('bairro')
      .select('id_bairro')
      .eq('bairro', bairro)
      .eq('id_cidade', cidadeId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') throw findError;

    if (existing) {
      return existing.id_bairro;
    }

    const { data: newBairro, error: createError } = await supabase
      .from('bairro')
      .insert({ bairro, id_cidade: cidadeId })
      .select()
      .single();

    if (createError) throw createError;
    return newBairro.id_bairro;
  };

  const getOrCreateLogradouro = async (logradouro: string, cep: string | null, bairroId: number): Promise<number> => {
    const { data: existing, error: findError } = await supabase
      .from('logradouro')
      .select('id_logradouro')
      .eq('logradouro', logradouro)
      .eq('nr_cep', cep || null)
      .eq('id_bairro', bairroId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') throw findError;

    if (existing) {
      return existing.id_logradouro;
    }

    const { data: newLogradouro, error: createError } = await supabase
      .from('logradouro')
      .insert({ logradouro, nr_cep: cep || null, id_bairro: bairroId })
      .select()
      .single();

    if (createError) throw createError;
    return newLogradouro.id_logradouro;
  };

  if (!isOpen) return null;

  const isEditMode = mode === 'edit';
  const title = isEditMode ? 'Editar Ajudante' : 'Adicionar Ajudante';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            data-testid="button-close-modal"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando dados...</span>
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
                    data-testid="input-cpf"
                  />
                </div>

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
                    data-testid="input-nome"
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
                    data-testid="input-telefone"
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
                    data-testid="select-genero"
                  >
                    <option value="">Selecione</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Document Type Selection */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Tipo de Documento
              </h3>
              
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={documentType === 'cnh'}
                    onChange={() => setDocumentType('cnh')}
                    className="mr-2 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                    data-testid="radio-cnh"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CNH</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={documentType === 'rg'}
                    onChange={() => setDocumentType('rg')}
                    className="mr-2 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                    data-testid="radio-rg"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">RG</span>
                </label>
              </div>
            </div>

            {/* CNH Information */}
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
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, ''); // Remove não numéricos
                        if (value.length <= 11) { // Limita a 11 caracteres
                          setFormData(prev => ({ ...prev, nr_registro: value }));
                        }
                      }}
                      onBlur={(e) => {
                        const cnh = e.target.value.replace(/\D/g, '');
                        if (cnh.length === 11) {
                          const validation = validateCnhNumber(cnh);
                          if (!validation.isValid && validation.error) {
                            toast.error(validation.error);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Digite apenas números (ex: 12345678901)"
                      maxLength={11}
                      data-testid="input-cnh-numero"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Digite apenas números, de 8 a 11 dígitos
                    </p>
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
                      data-testid="select-categoria"
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
                      data-testid="input-nome-pai"
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
                      data-testid="input-nome-mae"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <DocumentPreview
                      documentUrl={formData.foto_cnh}
                      isUploading={uploading.cnh}
                      onUpload={(file) => handleFileUpload(file, 'foto_cnh')}
                      onPreview={handlePreviewDocument}
                      onRemove={() => handleRemoveDocument('foto_cnh')}
                      label="Foto da CNH"
                      data-testid="cnh-document-preview"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* RG Information */}
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
                      data-testid="input-rg-numero"
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
                      data-testid="input-data-emissao"
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
                      placeholder="Ex: SSP"
                      data-testid="input-orgao-expedidor"
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
                      data-testid="input-filiacao"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <DocumentPreview
                      documentUrl={formData.foto_rg}
                      isUploading={uploading.rg}
                      onUpload={(file) => handleFileUpload(file, 'foto_rg')}
                      onPreview={handlePreviewDocument}
                      onRemove={() => handleRemoveDocument('foto_rg')}
                      label="Foto do RG"
                      data-testid="rg-document-preview"
                    />
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
                  <div className="relative">
                    <input
                      type="text"
                      name="cep"
                      value={formData.cep}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 8) {
                          setFormData(prev => ({ ...prev, cep: value }));
                        }
                      }}
                      onBlur={(e) => {
                        const cep = e.target.value.replace(/\D/g, '');
                        if (cep.length === 8) {
                          consultarCepLocal(cep);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Digite o CEP"
                      maxLength={8}
                      data-testid="input-cep"
                    />
                    {loadingCep && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      </div>
                    )}
                  </div>
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
                    data-testid="select-estado"
                  >
                    <option value="">Selecione um estado</option>
                    {estados.map(estado => (
                      <option key={estado.id_estado} value={estado.sigla_estado}>
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
                    data-testid="input-cidade"
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
                    data-testid="input-bairro"
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
                    data-testid="input-logradouro"
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
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData(prev => ({ ...prev, numero: value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Digite apenas números"
                    data-testid="input-numero"
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
                    data-testid="input-complemento"
                  />
                </div>

                <div className="md:col-span-2">
                  <DocumentPreview
                    documentUrl={formData.comprovante_residencia}
                    isUploading={uploading.comprovante}
                    onUpload={(file) => handleFileUpload(file, 'comprovante_residencia')}
                    onPreview={handlePreviewDocument}
                    onRemove={() => handleRemoveDocument('comprovante_residencia')}
                    label="Comprovante de Residência"
                    data-testid="comprovante-document-preview"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                disabled={submitting}
                data-testid="button-cancel"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={submitting}
                data-testid="button-submit"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isEditMode ? 'Atualizando...' : 'Salvando...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {isEditMode ? 'Atualizar' : 'Salvar'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Document Preview Modal */}
        {showPreviewModal && previewDocument && (
          <div 
            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowPreviewModal(false)}
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
                    onClick={() => window.open(previewDocument, '_blank', 'noopener,noreferrer')}
                    className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Abrir em nova aba"
                  >
                    <Upload size={20} />
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 max-h-[80vh] overflow-auto">
                {previewDocument.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={previewDocument}
                    className="w-full h-[70vh] border-0"
                    title="Document Preview"
                  />
                ) : (
                  <img
                    src={previewDocument}
                    alt="Document Preview"
                    className="max-w-full h-auto mx-auto"
                    style={{ maxHeight: '70vh' }}
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

export default UnifiedAjudanteModal;