import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Motorista, Veiculo } from '../types/database';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { formatCEP } from '../utils/format';

interface EditMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: Motorista | null;
  onUpdate: () => void;
}

const EditMotoristaModal = ({ isOpen, onClose, motorista, onUpdate }: EditMotoristaModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const { companyId } = useAuth();
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
    tipo: '',
    ano: '',
    cor: '',
    tipologia: '',
    combustivel: '',
    peso: '',
    cubagem: '',
    possui_rastreador: false,
    marca_rastreador: '',
    motorista_id: ''
  });

  const [enderecoData, setEnderecoData] = useState({
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complemento: ''
  });

  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchEstados();
    }
  }, [isOpen]);

  useEffect(() => {
    if (motorista && motorista.motorista_id) {
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
      fetchEndereco(motorista.motorista_id);
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
          motorista_id: String(data.motorista_id) || ''
        });
      }
    } catch (error) {
      console.error('Erro ao buscar veículo:', error);
      toast.error('Erro ao carregar dados do veículo');
    }
  };

  const fetchEndereco = async (motorista_id: number) => {
    if (!motorista_id) {
      console.error('motorista_id is undefined');
      return;
    }
    
    try {
      const { data, error } = await supabase
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
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setEndereco(data);
        setEnderecoData({
          cep: data.logradouro?.nr_cep || '',
          estado: data.logradouro?.bairro?.cidade?.estado?.id_estado?.toString() || '',
          cidade: data.logradouro?.bairro?.cidade?.cidade || '',
          bairro: data.logradouro?.bairro?.bairro || '',
          logradouro: data.logradouro?.logradouro || '',
          numero: data.nr_end?.toString() || '',
          complemento: data.ds_complemento_end || ''
        });
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      toast.error('Erro ao carregar dados de endereço');
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

      setEnderecoData(prev => ({
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
      setEnderecoData(prev => ({
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
    
    if (!motorista) return;

    try {
      setSubmitting(true);

      // Update motorista data
      const { error: motoristaError } = await supabase
        .from('motorista')
        .update(formData)
        .eq('motorista_id', motorista.motorista_id);

      if (motoristaError) throw motoristaError;

      // Update or create vehicle data if it's an agregado
      if (motorista.funcao === 'Agregado') {
        if (veiculo) {
          // Update existing vehicle
          const { error: veiculoError } = await supabase
            .from('veiculo')
            .update(veiculoData)
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

      // Update or create address
      if (enderecoData.logradouro && enderecoData.cidade && enderecoData.estado) {
        try {
          // First, check if cidade exists
          let cidadeId: number;
          const { data: cidade, error: cidadeError } = await supabase
            .from('cidade')
            .select('id_cidade')
            .eq('cidade', enderecoData.cidade)
            .eq('id_estado', parseInt(enderecoData.estado))
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
                cidade: enderecoData.cidade,
                id_estado: parseInt(enderecoData.estado)
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
            .eq('bairro', enderecoData.bairro)
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
                bairro: enderecoData.bairro,
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
            .eq('logradouro', enderecoData.logradouro)
            .eq('nr_cep', enderecoData.cep)
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
                logradouro: enderecoData.logradouro,
                nr_cep: enderecoData.cep,
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
                nr_end: enderecoData.numero ? parseInt(enderecoData.numero) : null,
                ds_complemento_end: enderecoData.complemento || null,
                id_logradouro: logradouroId,
                st_end: true
              })
              .eq('id_end_motorista', endereco.id_end_motorista);

            if (enderecoError) throw enderecoError;
          } else {
            // Create new address
            const { error: enderecoError } = await supabase
              .from('end_motorista')
              .insert({
                nr_end: enderecoData.numero ? parseInt(enderecoData.numero) : null,
                ds_complemento_end: enderecoData.complemento || null,
                id_motorista: motorista.motorista_id,
                id_logradouro: logradouroId,
                st_end: true
              });

            if (enderecoError) throw enderecoError;
          }
        } catch (error) {
          console.error('Erro ao atualizar endereço:', error);
          toast.error('Erro ao atualizar endereço, mas os outros dados foram salvos');
        }
      }

      toast.success('Dados atualizados com sucesso');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      toast.error('Erro ao atualizar dados');
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
    setVeiculoData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleEnderecoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEnderecoData(prev => ({ ...prev, [name]: value }));
    
    // If CEP is being changed and has 8 digits, trigger CEP lookup
    if (name === 'cep' && value.length === 8) {
      consultarCep(value);
    }
  };

  const statusOptions = [
    { value: 'cadastrado', label: 'Cadastrado' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'documentacao', label: 'Documentação' },
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Editar {motorista.funcao}
          </h2>
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
                  Telefone
                </label>
                <input
                  type="tel"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleChange}
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
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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