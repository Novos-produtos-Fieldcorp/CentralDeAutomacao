import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { getCurrentDate, formatCEP } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { saveUserEmail, getUserEmail } from '../utils/cookies';
import { 
  validateCep, 
  validateAddressField, 
  validateAddressForSubmission,
  useCepLookup,
  type AddressFormData 
} from '../utils/addressValidation';
import { validateCpfNumber } from '../utils/cpfValidation';
import { validateCompleteCnh, CNH_CATEGORIES, formatCnhInput } from '../utils/cnhValidation';

interface AddMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddMotoristaModal = ({ isOpen, onClose, onSuccess }: AddMotoristaModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const { companyId } = useAuth();
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addressWarnings, setAddressWarnings] = useState<string[]>([]);
  const { lookupCep } = useCepLookup();
  
  const [formData, setFormData] = useState({
    cpf: '',
    nome: '',
    email: '',
    telefone: '',
    dt_nascimento: '',
    genero: '',
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complemento: '',
    funcao: 'Motorista',
    st_cadastro: 'cadastrado',
    data_cadastro: getCurrentDate()
  });

  const [cnhData, setCnhData] = useState({
    nr_registro_cnh: '',
    categoria_cnh: '',
    validade_cnh: '',
    uf_cnh: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchEstados();
      // Load email from cookies when modal opens
      const savedEmail = getUserEmail();
      if (savedEmail) {
        setFormData(prev => ({ ...prev, email: savedEmail }));
      }
    }
  }, [isOpen]);

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

  // Enhanced CEP lookup using our validation utility
  const handleCepLookup = async (cep: string) => {
    if (cep.length !== 8) return;
    
    // Clear previous CEP validation errors
    setFieldErrors(prev => {
      const { cep: _, ...rest } = prev;
      return rest;
    });
    
    const success = await lookupCep(cep, estados, setFormData, setLoadingCep);
    
    if (success) {
      // Clear address warnings when CEP lookup succeeds
      setAddressWarnings([]);
    }
  };

  // Consulta CPF via rota direta API Cellereit
  const consultarCpfApi = async (cpf: string) => {
    if (!cpf || cpf.length !== 11) return;
    try {
      const response = await fetch(`https://api.gw.cellereit.com.br/bg-check/cpf-completo?cpf=${cpf}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIzS1dxVWt4U2pTSDc5OUxnc3cyX0htRFozZDlkVzZoNmtsVGx2Q2t2dkdzIn0.eyJleHAiOjE3MzE5MzcwMzEsImlhdCI6MTczMTkzNjczMSwianRpIjoiNzU2NGU1ZTgtNzdiNC00YmE3LWI0YjMtZmZiYTgwNDQ3Y2NiIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5jZWxsZXJlaXQuY29tLmJyL2F1dGgvcmVhbG1zL3BvcnRhbC1jbGllbnRlcy1hcGkiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiNDY0ZTUwOTYtZDJlZi00ZmIxLTk4M2EtNzczYjM5ZGYyOWI4IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoicGRjYS1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiZjJiMWU3NmQtMDNhMy00ZWE0LWI4YzQtZmUwNjQ1NDI0N2M1IiwiYWNyIjoiMSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJvcmdhbml6YXRpb24iLCJvZmZsaW5lX2FjY2VzcyIsImRlZmF1bHQtcm9sZXMtcG9ydGFsLWNsaWVudGVzLWFwaSIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJlbWFpbCBwbGFucyBwcm9maWxlIiwic2lkIjoiZjJiMWU3NmQtMDNhMy00ZWE0LWI4YzQtZmUwNjQ1NDI0N2M1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImdyb3VwcyI6WyJhY2NvdW50QWRtaW5zIiwib3JnYW5pemF0aW9ucyJdLCJiaWxsaW5nQWNjb3VudElkIjoiNjczYjNlYTUyMDE0Y2I5OGQxNGMxM2Y0IiwicHJlZmVycmVkX3VzZXJuYW1lIjoiaW5mb0BmaWVsZGNvcnAuY29tLmJyIiwiZ2l2ZW5fbmFtZSI6IiIsImxvY2FsZSI6InB0LUJSIiwiZmFtaWx5X25hbWUiOiIiLCJlbWFpbCI6ImluZm9AZmllbGRjb3JwLmNvbS5iciJ9.nuykYiaqFUPpvGc59H-m5uI_bKbqfz1KwEKGObTN0OPsVxEJ5Oyt2h919nhZ4HjPC5i8hgvCS9BKphombNddPPGmyVTJWKSDQh-ZhcM1qUZvAf1RKZGfWeebnue3bKQA32EEboAzzyDg4Mkk_q9vsFzpBMfM6G2ol5SZIJannTPA2uT7fHMvE52clBFkSc4bGRM5p5osyct0aYhX3B2P2sj3_0DCZsbDKMeMG6UqT-px10dQFvMZGACBKsftCXqtsTSjThz--S2cbpWsDu-b5oe4fVwxcwF712n63A8Z-NCn112csIxXWlPbKHKCbOT0oKeNAxuTeiIRkJ05L_tANA'
        }
      });
      if (!response.ok) throw new Error('Erro ao consultar CPF');
      const data = await response.json();
      const pessoa = data.CadastroPessoaFisica;
      if (!pessoa || !pessoa.Nome || !pessoa.DataNascimento) throw new Error('Dados não encontrados para este CPF');
      setFormData(prev => ({
        ...prev,
        nome: pessoa.Nome,
        dt_nascimento: pessoa.DataNascimento.split('T')[0],
        telefone: pessoa.Telefones?.[0]?.TelefoneComDDD?.replace(/\D/g, '') || '',
        cep: pessoa.Enderecos?.[0]?.CEP || '',
        estado: pessoa.Enderecos?.[0]?.UF || '',
        cidade: pessoa.Enderecos?.[0]?.Cidade || '',
        bairro: pessoa.Enderecos?.[0]?.Bairro || '',
        logradouro: pessoa.Enderecos?.[0]?.Logradouro || '',
        numero: pessoa.Enderecos?.[0]?.Numero || '',
        complemento: pessoa.Enderecos?.[0]?.Complemento || ''
      }));
      toast.success('Dados do CPF preenchidos automaticamente!');
    } catch (error) {
      console.error('❌ Erro ao consultar CPF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar CPF');
    }
  };

  // Real-time field validation
  const validateField = (fieldName: string, value: string) => {
    let error = '';
    
    switch (fieldName) {
      case 'cpf':
        if (value && value.length === 11) {
          const cpfValidation = validateCpfNumber(value);
          if (!cpfValidation.isValid) {
            error = cpfValidation.error || 'CPF inválido';
          }
        } else if (value && value.length > 0) {
          error = 'CPF deve ter 11 dígitos';
        }
        break;
        
      case 'nr_registro_cnh':
      case 'categoria_cnh':
      case 'validade_cnh':
        // CNH validation will be done on submit for complete validation
        break;
        
      case 'telefone':
        if (!value) {
          error = 'Telefone é obrigatório';
        } else if (value.length < 10) {
          error = 'Telefone deve ter pelo menos 10 dígitos';
        }
        break;
        
      case 'dt_nascimento':
        if (!value) {
          error = 'Data de nascimento é obrigatória';
        } else {
          const birthDate = new Date(value);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          if (age < 18 || age > 100) {
            error = 'Idade deve estar entre 18 e 100 anos';
          }
        }
        break;
        
      case 'cep':
      case 'logradouro':
      case 'cidade':
      case 'bairro':
      case 'numero':
        if (value) {
          const validation = validateAddressField(fieldName as keyof AddressFormData, value);
          if (!validation.isValid) {
            error = validation.error || '';
          }
        }
        break;
    }
    
    setFieldErrors(prev => {
      if (error) {
        return { ...prev, [fieldName]: error };
      } else {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      }
    });
    
    return !error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setFieldErrors({});
      setAddressWarnings([]);

      // Comprehensive validation before submission
      const validationErrors: string[] = [];
      
      // Validate CPF
      if (!formData.cpf || formData.cpf.length !== 11) {
        validationErrors.push('CPF é obrigatório e deve ter 11 dígitos');
      } else {
        const cpfValidation = validateCpfNumber(formData.cpf);
        if (!cpfValidation.isValid) {
          validationErrors.push(cpfValidation.error || 'CPF inválido');
        }
      }

      // Validate required fields
      if (!formData.nome?.trim()) {
        validationErrors.push('Nome é obrigatório');
      }
      
      if (!formData.telefone) {
        validationErrors.push('Telefone é obrigatório');
      } else if (formData.telefone.length < 10) {
        validationErrors.push('Telefone deve ter pelo menos 10 dígitos');
      }

      if (!formData.dt_nascimento) {
        validationErrors.push('Data de nascimento é obrigatória');
      } else {
        const birthDate = new Date(formData.dt_nascimento);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (age < 18 || age > 100) {
          validationErrors.push('Motorista deve ter entre 18 e 100 anos');
        }
      }
      
      // Validate address if provided
      if (formData.cep || formData.logradouro || formData.cidade) {
        const addressValidation = validateAddressForSubmission({
          cep: formData.cep,
          logradouro: formData.logradouro,
          cidade: formData.cidade,
          bairro: formData.bairro,
          estado: formData.estado,
          numero: formData.numero,
          complemento: formData.complemento
        });
        
        if (!addressValidation.canProceed) {
          validationErrors.push(...addressValidation.errors);
        }
      }
      
      // Validate CNH if any field is provided
      if (cnhData.nr_registro_cnh || cnhData.categoria_cnh || cnhData.validade_cnh) {
        const cnhValidation = validateCompleteCnh(
          cnhData.nr_registro_cnh,
          cnhData.categoria_cnh,
          cnhData.validade_cnh
        );
        
        if (!cnhValidation.isValid) {
          validationErrors.push(...cnhValidation.errors);
        }
      }
      
      // Stop submission if there are validation errors
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('\n'));
      }

      // Insert motorista data
      const { data: motorista, error: motoristaError } = await supabase
        .from('motorista')
        .insert({
          cpf: formData.cpf,
          nome: formData.nome,
          email: formData.email || null,
          telefone: formData.telefone ? parseInt(formData.telefone) : null,
          dt_nascimento: formData.dt_nascimento,
          genero: formData.genero || null,
          funcao: formData.funcao,
          st_cadastro: formData.st_cadastro,
          data_cadastro: formData.data_cadastro,
          company_id: companyId
        })
        .select()
        .single();

      if (motoristaError) throw motoristaError;

      // Save email to cookies for future use
      if (formData.email) {
        saveUserEmail(formData.email);
      }

      // If address is provided, save it
      if (formData.cep && motorista) {
        try {
          // Check if bairro exists
          let bairroId: number;
          const { data: bairro, error: bairroError } = await supabase
            .from('bairro')
            .select('id_bairro')
            .eq('bairro', formData.bairro)
            .eq('id_cidade', 1) // You might need to adjust this
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
                id_cidade: 1 // You might need to adjust this
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

          // Create end_motorista with proper handling of empty number
          const { error: enderecoError } = await supabase
            .from('end_motorista')
            .insert({
              nr_end: formData.numero ? parseInt(formData.numero) : null,
              ds_complemento_end: formData.complemento || null,
              id_motorista: motorista.motorista_id,
              id_logradouro: logradouroId
            });

          if (enderecoError) throw enderecoError;
        } catch (error) {
          console.error('Erro ao cadastrar endereço:', error);
          // Don't throw here, as address is optional
          toast.error('Erro ao cadastrar endereço, mas o cadastro foi realizado');
        }
      }

      // If CNH data is provided, save it to documento_motorista
      if (cnhData.nr_registro_cnh || cnhData.categoria_cnh || cnhData.validade_cnh) {
        try {
          const { error: cnhError } = await supabase
            .from('documento_motorista')
            .insert({
              motorista_id: motorista.motorista_id,
              nr_registro_cnh: cnhData.nr_registro_cnh || null,
              categoria_cnh: cnhData.categoria_cnh || null,
              validade_cnh: cnhData.validade_cnh || null,
              uf_cnh: cnhData.uf_cnh || null
            });

          if (cnhError) throw cnhError;
        } catch (error) {
          console.error('Erro ao cadastrar dados da CNH:', error);
          // Don't throw here, as CNH is optional
          toast.error('Erro ao cadastrar dados da CNH, mas o cadastro foi realizado');
        }
      }

      toast.success('Motorista cadastrado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating motorista:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar motorista');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Adicionar Motorista
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

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
                      if (value.length === 11) {
                        validateField('cpf', value);
                      }
                    }
                  }}
                  onBlur={() => {
                    validateField('cpf', formData.cpf);
                    if (formData.cpf.length === 11) {
                      consultarCpfApi(formData.cpf);
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                    fieldErrors.cpf 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  required
                  maxLength={11}
                  placeholder="Digite o CPF (somente números)"
                  data-testid="input-cpf"
                />
                {fieldErrors.cpf && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {fieldErrors.cpf}
                  </div>
                )}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telefone *
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
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  name="dt_nascimento"
                  value={formData.dt_nascimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, dt_nascimento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  name="st_cadastro"
                  value={formData.st_cadastro}
                  onChange={(e) => setFormData(prev => ({ ...prev, st_cadastro: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
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
                      validateField('cep', value);
                      if (value.length === 8) {
                        handleCepLookup(value);
                      }
                    }}
                    onBlur={() => validateField('cep', formData.cep)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                      fieldErrors.cep 
                        ? 'border-red-300 dark:border-red-600' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    maxLength={8}
                    placeholder="00000-000"
                    data-testid="input-cep"
                  />
                  {loadingCep && (
                    <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  )}
                </div>
                {fieldErrors.cep && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {fieldErrors.cep}
                  </div>
                )}
                {!fieldErrors.cep && formData.cep && formData.cep.length === 8 && (
                  <div className="mt-1 text-sm text-green-600 dark:text-green-400">
                    ✓ {formatCEP(formData.cep)}
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
            </div>
          </div>

          {/* CNH Information Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Informações da CNH (Opcional)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Número da CNH
                </label>
                <input
                  type="text"
                  name="nr_registro_cnh"
                  value={cnhData.nr_registro_cnh}
                  onChange={(e) => {
                    const value = formatCnhInput(e.target.value);
                    setCnhData(prev => ({ ...prev, nr_registro_cnh: value }));
                    validateField('nr_registro_cnh', value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Digite os 11 dígitos"
                  maxLength={11}
                  data-testid="input-cnh-numero"
                />
                {fieldErrors.nr_registro_cnh && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {fieldErrors.nr_registro_cnh}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Categoria da CNH
                </label>
                <select
                  name="categoria_cnh"
                  value={cnhData.categoria_cnh}
                  onChange={(e) => {
                    setCnhData(prev => ({ ...prev, categoria_cnh: e.target.value }));
                    validateField('categoria_cnh', e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  data-testid="select-cnh-categoria"
                >
                  <option value="">Selecione a categoria</option>
                  {CNH_CATEGORIES.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoria_cnh && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {fieldErrors.categoria_cnh}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Validade da CNH
                </label>
                <input
                  type="date"
                  name="validade_cnh"
                  value={cnhData.validade_cnh}
                  onChange={(e) => {
                    setCnhData(prev => ({ ...prev, validade_cnh: e.target.value }));
                    validateField('validade_cnh', e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  data-testid="input-cnh-validade"
                />
                {fieldErrors.validade_cnh && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {fieldErrors.validade_cnh}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  UF da CNH
                </label>
                <select
                  name="uf_cnh"
                  value={cnhData.uf_cnh}
                  onChange={(e) => setCnhData(prev => ({ ...prev, uf_cnh: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  data-testid="select-cnh-uf"
                >
                  <option value="">Selecione o estado</option>
                  {estados.map(estado => (
                    <option key={estado.id_estado} value={estado.sigla_estado}>
                      {estado.sigla_estado}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Address validation warnings */}
          {addressWarnings.length > 0 && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Atenção:</span>
              </div>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {addressWarnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Validation errors summary */}
          {Object.keys(fieldErrors).length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Corrija os seguintes erros:</span>
              </div>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {Object.entries(fieldErrors).map(([field, error]) => (
                  <li key={field}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

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
              disabled={submitting || Object.keys(fieldErrors).length > 0}
              data-testid="button-submit"
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
      </div>
    </div>
  );
};

export default AddMotoristaModal;