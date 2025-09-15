import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Motorista, MotoristaWithAddress, Veiculo } from '../types/database';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { formatCEP } from '../utils/format';
import WhatsAppAvatar from './WhatsAppAvatar';
import { 
  validateCep, 
  validateAddressField, 
  validateAddressForSubmission,
  useCepLookup,
  type AddressFormData 
} from '../utils/addressValidation';
import { validateCpfNumber } from '../utils/cpfValidation';
import { validateCompleteCnh, CNH_CATEGORIES, formatCnhInput } from '../utils/cnhValidation';

interface EditMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: MotoristaWithAddress | null;
  onUpdate: () => void;
}

const EditMotoristaModal = ({ isOpen, onClose, motorista, onUpdate }: EditMotoristaModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addressWarnings, setAddressWarnings] = useState<string[]>([]);
  const { companyId } = useAuth();
  const { lookupCep } = useCepLookup();
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    dt_nascimento: '',
    genero: '',
    st_cadastro: 'cadastrado'
  });

  const [veiculoData, setVeiculoData] = useState<Partial<Veiculo>>({
    placa: '',
    marca: '',
    tipologia: '',
    ano: '',
    cor: '',
    tipo: '',
    combustivel: '',
    peso: '',
    cubagem: '',
    possui_rastreador: false,
    marca_rastreador: '',
    motorista_id: 0
  });

  interface EnderecoFormData {
    cep: string;
    estado: string;
    cidade: string;
    bairro: string;
    logradouro: string;
    numero: string;
    complemento: string;
  }

  const [enderecoData, setEnderecoData] = useState<EnderecoFormData>({
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complemento: ''
  });

  const [cnhData, setCnhData] = useState({
    nr_registro_cnh: '',
    categoria_cnh: '',
    validade_cnh: '',
    uf_cnh: ''
  });

  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  
  interface EnderecoMotorista {
    id_end_motorista: number;
    nr_end: number | null;
    ds_complemento_end: string | null;
    st_end: boolean | null;
    logradouro: string | null;
    nr_cep: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    sigla_estado: string | null;
  }

  // Estado para armazenar os dados do endereço formatados para o formulário

  useEffect(() => {
    if (isOpen) {
      fetchEstados();
    }
  }, [isOpen]);

  useEffect(() => {
    if (motorista && motorista.motorista_id) {
      // Use nome_motorista if available (from the view), otherwise fall back to nome
      setFormData({
        nome: motorista.nome || '',
        cpf: motorista.cpf || '',
        email: motorista.email || '',
        telefone: motorista.telefone?.toString() || '',
        dt_nascimento: motorista.dt_nascimento ? new Date(motorista.dt_nascimento).toISOString().split('T')[0] : '',
        genero: motorista.genero || '',
        st_cadastro: motorista.st_cadastro || 'cadastrado'
      });

      // Fetch vehicle data if it's an agregado
      if (motorista.funcao === 'Agregado') {
        fetchVeiculo(motorista.motorista_id);
      }

      // Fetch address data
      fetchEndereco();
      
      // Fetch CNH data
      fetchCnhData();
    }
  }, [motorista]);

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

  const fetchVeiculo = async (motorista_id: number) => {
    try {
      const { data, error } = await supabase
        .from('veiculo')
        .select('*')
        .eq('motorista_id', motorista_id)
        .eq('status_veiculo', true)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setVeiculo(data);
        setVeiculoData({
          placa: data.placa || '',
          marca: data.marca || '',
          tipo: data.tipo || '',
          ano: data.ano || '',
          cor: data.cor || '',
          tipologia: data.tipologia || '',
          combustivel: data.combustivel || '',
          peso: data.peso || '',
          cubagem: data.cubagem || '',
          possui_rastreador: data.possui_rastreador || false,
          marca_rastreador: data.marca_rastreador || '',
          motorista_id: data.motorista_id || 0
        });
      }
    } catch (error) {
      console.error('Erro ao buscar veículo:', error);
      toast.error('Erro ao carregar dados do veículo');
    }
  };

  const fetchCnhData = async () => {
    if (!motorista?.motorista_id) return;

    try {
      const { data, error } = await supabase
        .from('documento_motorista')
        .select('nr_registro_cnh, categoria_cnh, validade_cnh, uf_cnh')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching CNH data:', error);
        return;
      }

      if (data) {
        setCnhData({
          nr_registro_cnh: data.nr_registro_cnh || '',
          categoria_cnh: data.categoria_cnh || '',
          validade_cnh: data.validade_cnh || '',
          uf_cnh: data.uf_cnh || ''
        });
      }
    } catch (error) {
      console.error('Error fetching CNH data:', error);
    }
  };

  const fetchEndereco = async () => {
    if (!motorista?.motorista_id) return;

    try {
      const { data, error } = await supabase
        .from('end_motorista')
        .select(`
          *,
          logradouro:logradouro(
            id_logradouro,
            logradouro,
            nr_cep,
            bairro:bairro(
              id_bairro,
              bairro,
              cidade:cidade(
                id_cidade,
                cidade,
                estado:estado(
                  id_estado,
                  sigla_estado
                )
              )
            )
          )
        `)
        .eq('id_motorista', motorista.motorista_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Extrai os dados aninhados, lidando com arrays ou objetos
        const logradouroData = data.logradouro ? 
          (Array.isArray(data.logradouro) ? data.logradouro[0] : data.logradouro) : 
          null;
        
        const bairroData = logradouroData?.bairro ? 
          (Array.isArray(logradouroData.bairro) ? logradouroData.bairro[0] : logradouroData.bairro) : 
          null;
          
        const cidadeData = bairroData?.cidade ? 
          (Array.isArray(bairroData.cidade) ? bairroData.cidade[0] : bairroData.cidade) : 
          null;
          
        const estadoData = cidadeData?.estado ? 
          (Array.isArray(cidadeData.estado) ? cidadeData.estado[0] : cidadeData.estado) : 
          null;

        // Cria o objeto de endereço formatado
        const enderecoFormatado: EnderecoMotorista = {
          id_end_motorista: data.id_end_motorista,
          nr_end: data.nr_end,
          ds_complemento_end: data.ds_complemento_end,
          st_end: data.st_end || null,
          logradouro: logradouroData?.logradouro || null,
          nr_cep: logradouroData?.nr_cep || null,
          bairro: bairroData?.bairro || null,
          cidade: cidadeData?.cidade || null,
          estado: estadoData?.id_estado?.toString() || null,
          sigla_estado: estadoData?.sigla_estado || null
        };
        
        // Atualiza o estado do formulário de endereço
        setEnderecoData({
          cep: enderecoFormatado.nr_cep || '',
          estado: enderecoFormatado.estado || '',
          cidade: enderecoFormatado.cidade || '',
          bairro: enderecoFormatado.bairro || '',
          logradouro: enderecoFormatado.logradouro || '',
          numero: enderecoFormatado.nr_end?.toString() || '',
          complemento: enderecoFormatado.ds_complemento_end || ''
        });
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      toast.error('Erro ao carregar dados de endereço');
    }
  };

  // Use standardized CEP lookup approach
  const handleCepLookup = async (cep: string) => {
    if (cep.length !== 8) return;
    
    // Clear previous CEP validation errors
    setFieldErrors(prev => {
      const { cep: _, ...rest } = prev;
      return rest;
    });
    
    const success = await lookupCep(cep, estados, (data) => {
      setEnderecoData(prev => ({
        ...prev,
        cep: data.cep || prev.cep,
        estado: data.estado || prev.estado,
        cidade: data.cidade || prev.cidade,
        bairro: data.bairro || prev.bairro,
        logradouro: data.logradouro || prev.logradouro,
        complemento: data.complemento || prev.complemento
      }));
    }, setLoadingCep);
    
    if (success) {
      setAddressWarnings([]);
    }
  };

  // CPF lookup has been disabled due to security concerns
  const consultarCpfLocal = async (cpf: string) => {
    toast.error('Consulta de CPF temporariamente desabilitada por segurança. Entre em contato com o administrador se necessário.');
  };

  const saveEndereco = async (motorista_id: number) => {
    try {
      // Verifica se temos dados de endereço suficientes
      if (!enderecoData.logradouro || !enderecoData.cidade || !enderecoData.estado) {
        console.log('Dados de endereço insuficientes para salvar');
        return;
      }
      
      // Primeiro, encontrar o estado pelo ID
      const estadoId = parseInt(enderecoData.estado);
      
      // Verificar se a cidade existe
      let cidadeId: number;
      const { data: cidadeData, error: cidadeError } = await supabase
        .from('cidade')
        .select('id_cidade')
        .eq('cidade', enderecoData.cidade)
        .eq('id_estado', estadoId)
        .maybeSingle();

      if (cidadeError && cidadeError.code !== 'PGRST116') {
        throw cidadeError;
      }

      if (cidadeData) {
        cidadeId = cidadeData.id_cidade;
      } else {
        // Criar cidade se não existir
        const { data: newCidade, error: newCidadeError } = await supabase
          .from('cidade')
          .insert({
            cidade: enderecoData.cidade,
            id_estado: estadoId
          })
          .select('id_cidade')
          .single();

        if (newCidadeError) throw newCidadeError;
        cidadeId = newCidade.id_cidade;
      }

      // Verificar se o bairro existe
      let bairroId: number;
      const { data: bairroData, error: bairroError } = await supabase
        .from('bairro')
        .select('id_bairro')
        .eq('bairro', enderecoData.bairro || 'Centro')
        .eq('id_cidade', cidadeId)
        .maybeSingle();

      if (bairroError && bairroError.code !== 'PGRST116') {
        throw bairroError;
      }
      
      if (bairroData) {
        bairroId = bairroData.id_bairro;
      } else {
        // Criar bairro se não existir
        const { data: newBairro, error: newBairroError } = await supabase
          .from('bairro')
          .insert({
            bairro: enderecoData.bairro || 'Centro',
            id_cidade: cidadeId
          })
          .select('id_bairro')
          .single();

        if (newBairroError) throw newBairroError;
        bairroId = newBairro.id_bairro;
      }

      // Verificar se o logradouro existe
      let logradouroId: number;
      const { data: logradouroData, error: logradouroError } = await supabase
        .from('logradouro')
        .select('id_logradouro')
        .eq('logradouro', enderecoData.logradouro)
        .eq('nr_cep', enderecoData.cep || null)
        .eq('id_bairro', bairroId)
        .maybeSingle();

      if (logradouroError && logradouroError.code !== 'PGRST116') {
        throw logradouroError;
      }
      
      if (logradouroData) {
        logradouroId = logradouroData.id_logradouro;
      } else {
        // Criar logradouro se não existir
        const { data: newLogradouro, error: newLogradouroError } = await supabase
          .from('logradouro')
          .insert({
            logradouro: enderecoData.logradouro,
            nr_cep: enderecoData.cep || null,
            id_bairro: bairroId
          })
          .select('id_logradouro')
          .single();

        if (newLogradouroError) throw newLogradouroError;
        logradouroId = newLogradouro.id_logradouro;
      }

      // Verificar se já existe um endereço para o motorista
      const { data: existingEndereco, error: enderecoCheckError } = await supabase
        .from('end_motorista')
        .select('id_end_motorista')
        .eq('id_motorista', motorista_id)
        .maybeSingle();
        
      if (enderecoCheckError && enderecoCheckError.code !== 'PGRST116') {
        throw enderecoCheckError;
      }
      
      const enderecoPayload = {
        nr_end: enderecoData.numero ? parseInt(enderecoData.numero) : null,
        ds_complemento_end: enderecoData.complemento || null,
        id_motorista: motorista_id,
        id_logradouro: logradouroId,
        st_end: true
      };

      if (existingEndereco) {
        // Atualizar endereço existente
        const { error: updateError } = await supabase
          .from('end_motorista')
          .update(enderecoPayload)
          .eq('id_end_motorista', existingEndereco.id_end_motorista);

        if (updateError) throw updateError;
      } else {
        // Criar novo endereço
        const { error: insertError } = await supabase
          .from('end_motorista')
          .insert(enderecoPayload);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Erro ao salvar endereço:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!motorista) return;

    try {
      setSubmitting(true);

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

      // Update motorista data
      const { error: motoristaError } = await supabase
        .from('motorista')
        .update({
          ...formData,
          telefone: formData.telefone ? Number(formData.telefone.replace(/\D/g, '')) : null
        })
        .eq('motorista_id', motorista.motorista_id);

      if (motoristaError) throw motoristaError;

      // Save address data
      if (enderecoData.cep) {
        await saveEndereco(motorista.motorista_id);
      }

      // Save or update CNH data if provided
      if (cnhData.nr_registro_cnh || cnhData.categoria_cnh || cnhData.validade_cnh) {
        try {
          // Check if document exists
          const { data: existingDoc } = await supabase
            .from('documento_motorista')
            .select('id_documento_motorista')
            .eq('motorista_id', motorista.motorista_id)
            .maybeSingle();

          if (existingDoc) {
            // Update existing document
            const { error: updateError } = await supabase
              .from('documento_motorista')
              .update({
                nr_registro_cnh: cnhData.nr_registro_cnh || null,
                categoria_cnh: cnhData.categoria_cnh || null,
                validade_cnh: cnhData.validade_cnh || null,
                uf_cnh: cnhData.uf_cnh || null
              })
              .eq('motorista_id', motorista.motorista_id);

            if (updateError) throw updateError;
          } else {
            // Create new document
            const { error: insertError } = await supabase
              .from('documento_motorista')
              .insert({
                motorista_id: motorista.motorista_id,
                nr_registro_cnh: cnhData.nr_registro_cnh || null,
                categoria_cnh: cnhData.categoria_cnh || null,
                validade_cnh: cnhData.validade_cnh || null,
                uf_cnh: cnhData.uf_cnh || null
              });

            if (insertError) throw insertError;
          }
        } catch (error) {
          console.error('Erro ao salvar dados da CNH:', error);
          toast.error('Erro ao salvar dados da CNH, mas o cadastro foi atualizado');
        }
      }

      // Update or create vehicle data if it's an agregado
      if (motorista.funcao === 'Agregado') {
        if (veiculo) {
          // Update existing vehicle
          const { error: veiculoError } = await supabase
            .from('veiculo')
            .update({
              ...veiculoData,
              motorista_id: motorista.motorista_id,
              status_veiculo: true
            })
            .eq('veiculo_id', veiculo.veiculo_id);

          if (veiculoError) throw veiculoError;
        } else {
          // Create new vehicle
          const { error: veiculoError } = await supabase
            .from('veiculo')
            .insert({
              ...veiculoData,
              motorista_id: motorista.motorista_id,
              status_veiculo: true
            });

          if (veiculoError) throw veiculoError;
        }
      }

      toast.success('Motorista atualizado com sucesso');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar motorista:', error);
      toast.error('Erro ao atualizar motorista');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVeiculoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Define os campos que devem ser tratados como números
    const numericFields = ['ano', 'peso', 'cubagem'];
    
    setVeiculoData((prev: Partial<Veiculo>) => {
      let processedValue: string | number | boolean = value;
      
      // Converte para booleano se for um checkbox
      if (type === 'checkbox') {
        processedValue = (e.target as HTMLInputElement).checked;
      } 
      // Converte para número se for um campo numérico
      else if (numericFields.includes(name)) {
        processedValue = value === '' ? '' : Number(value);
      }
      
      return {
        ...prev,
        [name]: processedValue
      };
    });
  };

  const handleEnderecoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEnderecoData(prev => ({ ...prev, [name]: value }));
    
    // If CEP is being changed and has 8 digits, trigger CEP lookup
    if (name === 'cep' && value.length === 8) {
      handleCepLookup(value);
    }
  };

  const statusOptions = [
    { value: 'cadastrado', label: 'Cadastrado' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'documentacao', label: 'Documentação' },
    { value: 'gr', label: 'GR' },
    { value: 'contrato_enviado', label: 'Contrato Enviado' },
    { value: 'contratado', label: 'Contratado' },
    { value: 'repescagem', label: 'Repescagem' },
    { value: 'rejeitado', label: 'Rejeitado' }
  ];

  if (!isOpen || !motorista) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center gap-4">
            <WhatsAppAvatar 
              photoUrl={motorista?.foto_whatsapp}
              name={motorista.nome}
              size="md"
            />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Editar {motorista.funcao}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {motorista.nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Informações Pessoais
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
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
                  onChange={handleChange}
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
                  onChange={handleChange}
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
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  name="st_cadastro"
                  value={formData.st_cadastro}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Address Information Section */}
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
                    value={enderecoData.cep}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 8) {
                        handleEnderecoChange({
                          target: { name: 'cep', value }
                        } as React.ChangeEvent<HTMLInputElement>);
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
                {enderecoData.cep && enderecoData.cep.length === 8 && (
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {formatCEP(enderecoData.cep)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estado
                </label>
                <select
                  name="estado"
                  value={enderecoData.estado}
                  onChange={handleEnderecoChange}
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
                  value={enderecoData.cidade}
                  onChange={handleEnderecoChange}
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
                  value={enderecoData.bairro}
                  onChange={handleEnderecoChange}
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
                  value={enderecoData.logradouro}
                  onChange={handleEnderecoChange}
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
                  value={enderecoData.numero}
                  onChange={(e) => {
                    // Only allow numbers
                    const value = e.target.value.replace(/\D/g, '');
                    handleEnderecoChange({
                      target: { name: 'numero', value }
                    } as React.ChangeEvent<HTMLInputElement>);
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
                  value={enderecoData.complemento}
                  onChange={handleEnderecoChange}
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
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Digite os 11 dígitos"
                  maxLength={11}
                  data-testid="input-cnh-numero"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Categoria da CNH
                </label>
                <select
                  name="categoria_cnh"
                  value={cnhData.categoria_cnh}
                  onChange={(e) => setCnhData(prev => ({ ...prev, categoria_cnh: e.target.value }))}
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Validade da CNH
                </label>
                <input
                  type="date"
                  name="validade_cnh"
                  value={cnhData.validade_cnh}
                  onChange={(e) => setCnhData(prev => ({ ...prev, validade_cnh: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  data-testid="input-cnh-validade"
                />
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

          {/* Vehicle Information Section (Only for Agregados) */}
          {motorista.funcao === 'Agregado' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Informações do Veículo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Placa *
                  </label>
                  <input
                    type="text"
                    name="placa"
                    value={veiculoData.placa}
                    onChange={handleVeiculoChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                    maxLength={7}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    name="marca"
                    value={veiculoData.marca}
                    onChange={handleVeiculoChange}
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
                    value={veiculoData.tipo}
                    onChange={handleVeiculoChange}
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
                    value={veiculoData.ano}
                    onChange={handleVeiculoChange}
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
                    value={veiculoData.cor}
                    onChange={handleVeiculoChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipologia *
                  </label>
                  <input
                    type="text"
                    name="tipologia"
                    value={veiculoData.tipologia}
                    onChange={handleVeiculoChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Combustível
                  </label>
                  <input
                    type="text"
                    name="combustivel"
                    value={veiculoData.combustivel}
                    onChange={handleVeiculoChange}
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
                    value={veiculoData.peso}
                    onChange={handleVeiculoChange}
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
                    value={veiculoData.cubagem}
                    onChange={handleVeiculoChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <input
                      type="checkbox"
                      name="possui_rastreador"
                      checked={veiculoData.possui_rastreador}
                      onChange={handleVeiculoChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Possui Rastreador</span>
                  </label>
                </div>

                {veiculoData.possui_rastreador && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Marca do Rastreador
                    </label>
                    <input
                      type="text"
                      name="marca_rastreador"
                      value={veiculoData.marca_rastreador}
                      onChange={handleVeiculoChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
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

export default EditMotoristaModal;
