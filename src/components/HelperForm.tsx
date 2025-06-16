import React, { useState, useEffect } from 'react';
import { X, Loader2, User, Phone, FileText, Camera, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCEP } from '../utils/format';

interface HelperFormProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo_id: number;
  helper_id?: number;
  onSuccess: () => void;
}

const HelperForm: React.FC<HelperFormProps> = ({
  isOpen,
  onClose,
  veiculo_id,
  helper_id,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    genero: '',
    comprovante_residencia: '',
    
    // CNH data
    nr_registro_cnh: '',
    categoria_cnh: '',
    nome_pai: '',
    nome_mae: '',
    foto_cnh: '',
    
    // RG data
    nr_rg: '',
    data_emissao: '',
    orgao_expedidor: '',
    filiacao: '',
    foto_rg: '',
    
    // Address data
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complemento: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchEstados();
      if (helper_id) {
        fetchHelperData();
      } else {
        resetForm();
      }
    }
  }, [isOpen, helper_id]);

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      telefone: '',
      genero: '',
      comprovante_residencia: '',
      
      nr_registro_cnh: '',
      categoria_cnh: '',
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
      complemento: ''
    });
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

  const fetchHelperData = async () => {
    if (!helper_id) return;
    
    try {
      setLoading(true);
      
      // Fetch basic helper data
      const { data: helperData, error: helperError } = await supabase
        .from('documento_ajudante')
        .select('*')
        .eq('id_ajudante', helper_id)
        .single();
        
      if (helperError) throw helperError;
      
      // Fetch CNH data
      const { data: cnhData, error: cnhError } = await supabase
        .from('cnh_ajudante')
        .select('*')
        .eq('id_ajudante', helper_id)
        .maybeSingle();
        
      // Fetch RG data
      const { data: rgData, error: rgError } = await supabase
        .from('rg_ajudante')
        .select('*')
        .eq('id_ajudante', helper_id)
        .maybeSingle();
        
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
        .eq('id_ajudante', helper_id)
        .maybeSingle();
      
      // Update form data with fetched data
      setFormData({
        nome: helperData.nome || '',
        cpf: helperData.cpf ? helperData.cpf.toString() : '',
        telefone: helperData.telefone || '',
        genero: helperData.genero || '',
        comprovante_residencia: helperData.comprovante_residencia || '',
        
        nr_registro_cnh: cnhData?.nr_registro ? cnhData.nr_registro.toString() : '',
        categoria_cnh: cnhData?.categoria || '',
        nome_pai: cnhData?.nome_pai || '',
        nome_mae: cnhData?.nome_mae || '',
        foto_cnh: cnhData?.foto_cnh || '',
        
        nr_rg: rgData?.nr_rg ? rgData.nr_rg.toString() : '',
        data_emissao: rgData?.data_emissao ? rgData.data_emissao.split('T')[0] : '',
        orgao_expedidor: rgData?.orgao_expedidor || '',
        filiacao: rgData?.filiacao || '',
        foto_rg: rgData?.foto_rg || '',
        
        cep: enderecoData?.logradouro?.nr_cep || '',
        estado: enderecoData?.logradouro?.bairro?.cidade?.estado?.id_estado.toString() || '',
        cidade: enderecoData?.logradouro?.bairro?.cidade?.cidade || '',
        bairro: enderecoData?.logradouro?.bairro?.bairro || '',
        logradouro: enderecoData?.logradouro?.logradouro || '',
        numero: enderecoData?.nr_end ? enderecoData.nr_end.toString() : '',
        complemento: enderecoData?.ds_complemento_end || ''
      });
      
    } catch (error) {
      console.error('Error fetching helper data:', error);
      toast.error('Erro ao carregar dados do ajudante');
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Validate CPF format if provided
      if (formData.cpf && !/^\d{11}$/.test(formData.cpf.replace(/\D/g, ''))) {
        throw new Error('CPF inválido. Digite 11 números.');
      }
      
      // 1. Insert or update documento_ajudante
      let ajudanteId = helper_id;
      
      if (ajudanteId) {
        // Update existing helper
        const { error: updateError } = await supabase
          .from('documento_ajudante')
          .update({
            nome: formData.nome,
            cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null,
            telefone: formData.telefone || null,
            genero: formData.genero || null,
            comprovante_residencia: formData.comprovante_residencia || null,
            veiculo_id: veiculo_id
          })
          .eq('id_ajudante', ajudanteId);
          
        if (updateError) throw updateError;
      } else {
        // Insert new helper
        const { data: newHelper, error: insertError } = await supabase
          .from('documento_ajudante')
          .insert({
            nome: formData.nome,
            cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null,
            telefone: formData.telefone || null,
            genero: formData.genero || null,
            comprovante_residencia: formData.comprovante_residencia || null,
            veiculo_id: veiculo_id
          })
          .select()
          .single();
          
        if (insertError) throw insertError;
        ajudanteId = newHelper.id_ajudante;
      }
      
      // 2. Handle CNH data if provided
      if (formData.nr_registro_cnh || formData.categoria_cnh || formData.nome_pai || formData.nome_mae || formData.foto_cnh) {
        const { data: existingCnh } = await supabase
          .from('cnh_ajudante')
          .select('id_cnh_ajudante')
          .eq('id_ajudante', ajudanteId)
          .maybeSingle();
          
        if (existingCnh) {
          // Update existing CNH
          const { error: cnhUpdateError } = await supabase
            .from('cnh_ajudante')
            .update({
              nr_registro: formData.nr_registro_cnh ? parseFloat(formData.nr_registro_cnh) : null,
              categoria: formData.categoria_cnh || null,
              nome_pai: formData.nome_pai || null,
              nome_mae: formData.nome_mae || null,
              foto_cnh: formData.foto_cnh || null
            })
            .eq('id_cnh_ajudante', existingCnh.id_cnh_ajudante);
            
          if (cnhUpdateError) throw cnhUpdateError;
        } else {
          // Insert new CNH
          const { error: cnhInsertError } = await supabase
            .from('cnh_ajudante')
            .insert({
              nr_registro: formData.nr_registro_cnh ? parseFloat(formData.nr_registro_cnh) : null,
              categoria: formData.categoria_cnh || null,
              nome_pai: formData.nome_pai || null,
              nome_mae: formData.nome_mae || null,
              foto_cnh: formData.foto_cnh || null,
              id_ajudante: ajudanteId
            });
            
          if (cnhInsertError) throw cnhInsertError;
        }
      }
      
      // 3. Handle RG data if provided
      if (formData.nr_rg || formData.data_emissao || formData.orgao_expedidor || formData.filiacao || formData.foto_rg) {
        const { data: existingRg } = await supabase
          .from('rg_ajudante')
          .select('id_rg_ajudante')
          .eq('id_ajudante', ajudanteId)
          .maybeSingle();
          
        if (existingRg) {
          // Update existing RG
          const { error: rgUpdateError } = await supabase
            .from('rg_ajudante')
            .update({
              nr_rg: formData.nr_rg ? parseFloat(formData.nr_rg) : null,
              data_emissao: formData.data_emissao || null,
              orgao_expedidor: formData.orgao_expedidor || null,
              filiacao: formData.filiacao || null,
              foto_rg: formData.foto_rg || null
            })
            .eq('id_rg_ajudante', existingRg.id_rg_ajudante);
            
          if (rgUpdateError) throw rgUpdateError;
        } else {
          // Insert new RG
          const { error: rgInsertError } = await supabase
            .from('rg_ajudante')
            .insert({
              nr_rg: formData.nr_rg ? parseFloat(formData.nr_rg) : null,
              data_emissao: formData.data_emissao || null,
              orgao_expedidor: formData.orgao_expedidor || null,
              filiacao: formData.filiacao || null,
              foto_rg: formData.foto_rg || null,
              id_ajudante: ajudanteId
            });
            
          if (rgInsertError) throw rgInsertError;
        }
      }
      
      // 4. Handle address data if provided
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

          // Check if end_ajudante exists
          const { data: existingEndereco } = await supabase
            .from('end_ajudante')
            .select('id_end_ajudante')
            .eq('id_ajudante', ajudanteId)
            .maybeSingle();
            
          if (existingEndereco) {
            // Update existing endereco
            const { error: enderecoUpdateError } = await supabase
              .from('end_ajudante')
              .update({
                nr_end: formData.numero ? parseInt(formData.numero) : null,
                ds_complemento_end: formData.complemento || null,
                id_logradouro: logradouroId
              })
              .eq('id_end_ajudante', existingEndereco.id_end_ajudante);
              
            if (enderecoUpdateError) throw enderecoUpdateError;
          } else {
            // Create new endereco
            const { error: enderecoInsertError } = await supabase
              .from('end_ajudante')
              .insert({
                nr_end: formData.numero ? parseInt(formData.numero) : null,
                ds_complemento_end: formData.complemento || null,
                id_ajudante: ajudanteId,
                id_logradouro: logradouroId
              });
              
            if (enderecoInsertError) throw enderecoInsertError;
          }
        } catch (error) {
          console.error('Erro ao cadastrar endereço:', error);
          // Don't throw here, as address is optional
          toast.error('Erro ao cadastrar endereço, mas o cadastro foi realizado');
        }
      }
      
      toast.success(helper_id ? 'Ajudante atualizado com sucesso' : 'Ajudante cadastrado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving helper:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar ajudante');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'comprovante_residencia' | 'foto_cnh' | 'foto_rg') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
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
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `ajudante_${field}_${Date.now()}.${fileExt}`;
      
      // Upload file to storage
      const { error: uploadError, data } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileExt?.toLowerCase() === 'pdf' ? 'application/pdf' : undefined
        });
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);
        
      // Update form data with the URL
      setFormData(prev => ({ ...prev, [field]: publicUrl }));
      
      toast.success('Arquivo enviado com sucesso');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao enviar arquivo');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {helper_id ? 'Editar Ajudante' : 'Adicionar Ajudante'}
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
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Comprovante de Residência
                  </label>
                  <div className="mt-1 flex items-center">
                    <input
                      type="file"
                      id="comprovante_residencia"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'comprovante_residencia')}
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                    />
                    <label
                      htmlFor="comprovante_residencia"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      {formData.comprovante_residencia ? 'Alterar Comprovante' : 'Enviar Comprovante'}
                    </label>
                    {formData.comprovante_residencia && (
                      <span className="ml-3 text-sm text-green-600 dark:text-green-400">
                        Comprovante enviado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* CNH Information */}
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
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Foto da CNH
                  </label>
                  <div className="mt-1 flex items-center">
                    <input
                      type="file"
                      id="foto_cnh"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'foto_cnh')}
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                    />
                    <label
                      htmlFor="foto_cnh"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      {formData.foto_cnh ? 'Alterar Foto da CNH' : 'Enviar Foto da CNH'}
                    </label>
                    {formData.foto_cnh && (
                      <span className="ml-3 text-sm text-green-600 dark:text-green-400">
                        Foto da CNH enviada
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RG Information */}
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
                    Filiação
                  </label>
                  <input
                    type="text"
                    name="filiacao"
                    value={formData.filiacao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Foto do RG
                  </label>
                  <div className="mt-1 flex items-center">
                    <input
                      type="file"
                      id="foto_rg"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'foto_rg')}
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                    />
                    <label
                      htmlFor="foto_rg"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      {formData.foto_rg ? 'Alterar Foto do RG' : 'Enviar Foto do RG'}
                    </label>
                    {formData.foto_rg && (
                      <span className="ml-3 text-sm text-green-600 dark:text-green-400">
                        Foto do RG enviada
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

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
                          consultarCep(value);
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
                  'Salvar'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default HelperForm;