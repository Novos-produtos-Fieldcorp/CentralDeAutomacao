import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Motorista } from '../types/database';
import toast from 'react-hot-toast';
import { getCurrentDate, formatCEP } from '../utils/format';
import { useAuth } from '../context/AuthContext';

interface AddAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

const AddAgregadoModal = ({ isOpen, onClose, onSuccess }: AddAgregadoModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const { companyId } = useAuth();
  
  const [formData, setFormData] = useState({
    cpf: '',
    nome: '',
    email: '',
    telefone: '',
    dt_nascimento: '',
    genero: '',
    st_cadastro: 'cadastrado',
    data_cadastro: getCurrentDate(),
    
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
        estado: estado ? estado.sigla_estado : '', // Use a sigla do estado
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

      // Validate CPF format
      if (!/^\d{11}$/.test(formData.cpf)) {
        throw new Error('CPF inválido. Digite 11 números.');
      }

      // Insert motorista (agregado)
      const { data: motorista, error: motoristaError } = await supabase
        .from('motorista')
        .insert({
          cpf: formData.cpf,
          nome: formData.nome,
          email: formData.email || null,
          telefone: formData.telefone || null,
          dt_nascimento: formData.dt_nascimento || null,
          genero: formData.genero || null,
          funcao: 'Agregado',
          st_cadastro: formData.st_cadastro,
         data_cadastro: formData.data_cadastro,
         company_id: companyId
        })
        .select()
        .single();

      if (motoristaError) {
        if (motoristaError.code === '23505') {
          throw new Error('CPF já cadastrado no sistema.');
        }
        throw new Error(`Erro ao cadastrar motorista: ${motoristaError.message}`);
      }

      if (!motorista) {
        throw new Error('Erro ao cadastrar motorista: nenhum dado retornado');
      }

      // Insert vehicle information
      const { error: veiculoError } = await supabase
        .from('veiculo')
        .insert({
          placa: formData.placa,
          marca: formData.marca,
          tipo: formData.tipo,
          ano: formData.ano,
          cor: formData.cor,
          tipologia: formData. tipologia,
          combustivel: formData.combustivel,
          peso: formData.peso,
          cubagem: formData.cubagem,
          possui_rastreador: formData.possui_rastreador,
          marca_rastreador: formData.marca_rastreador,
          motorista_id: motorista.motorista_id,
         status_veiculo: true,
         company_id: companyId
        });

      if (veiculoError) {
        // Rollback motorista insertion
        await supabase
          .from('motorista')
          .delete()
          .eq('motorista_id', motorista.motorista_id);
        
        if (veiculoError.code === '23505') {
          throw new Error('Placa já cadastrada no sistema.');
        }
        throw new Error(`Erro ao cadastrar veículo: ${veiculoError.message}`);
      }

      // Insert address if all required fields are filled
      if (formData.logradouro && formData.cidade && formData.estado) {
        try {
          // First, find the estado_id based on sigla_estado
          const { data: estadoData, error: estadoError } = await supabase
            .from('estado')
            .select('id_estado')
            .eq('sigla_estado', formData.estado)
            .single();
            
          if (estadoError) {
            throw new Error(`Estado "${formData.estado}" não encontrado.`);
          }
          
          // Check if cidade exists
          let cidadeId: number;
          const { data: cidade, error: cidadeError } = await supabase
            .from('cidade')
            .select('id_cidade')
            .eq('cidade', formData.cidade)
            .eq('id_estado', estadoData.id_estado)
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
                id_estado: estadoData.id_estado
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

          // Create end_motorista
          const { error: enderecoError } = await supabase
            .from('end_motorista')
            .insert({
              nr_end: formData.numero,
              ds_complemento_end: formData.complemento,
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

      toast.success('Agregado cadastrado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao cadastrar agregado:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar agregado');
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
            Adicionar Agregado
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
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  name="dt_nascimento"
                  value={formData.dt_nascimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, dt_nascimento: e.target.value }))}
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
                  <option value="contrato_enviado">Contrato Enviado</option>
                  <option value="contratado">Contratado</option>
                  <option value="repescagem">Repescagem</option>
                  <option value="rejeitado">Rejeitado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
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
                  value={formData.placa}
                  onChange={(e) => setFormData(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))}
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
                  value={formData.marca}
                  onChange={(e) => setFormData(prev => ({ ...prev, marca: e.target.value }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
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
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 4) {
                      setFormData(prev => ({ ...prev, ano: value }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  maxLength={4}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipologia
                </label>
                <input
                  type="text"
                  name="tipologia"
                  value={formData.tipologia}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipologia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Combustível
                </label>
                <input
                  type="text"
                  name="combustivel"
                  value={formData.combustivel}
                  onChange={(e) => setFormData(prev => ({ ...prev, combustivel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Peso
                </label>
                <input
                  type="text"
                  name="peso"
                  value={formData.peso}
                  onChange={(e) => setFormData(prev => ({ ...prev, peso: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cubagem
                </label>
                <input
                  type="text"
                  name="cubagem"
                  value={formData.cubagem}
                  onChange={(e) => setFormData(prev => ({ ...prev, cubagem: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, marca_rastreador: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                  onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {submitting ? (
                <div className="flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </div>
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

export default AddAgregadoModal;