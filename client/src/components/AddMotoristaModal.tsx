import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { getCurrentDate, formatCEP } from '../utils/format';
import { useAuth } from '../context/AuthContext';

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
      toast.success('Dados do CPF preenchidos!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar CPF');
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

      // Validate required fields
      if (!formData.telefone) {
        throw new Error('O telefone é obrigatório.');
      }

      if (!formData.dt_nascimento) {
        throw new Error('A data de nascimento é obrigatória.');
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

      // If address is provided, save it
      if (formData.cep && motorista) {
        try {
          // First, find or create the cidade based on estado and cidade name
          let cidadeId: number;
          if (formData.estado && formData.cidade) {
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
          } else {
            throw new Error('Estado e cidade são obrigatórios para cadastrar endereço');
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
                    }
                  }}
                  onBlur={() => consultarCpfApi(formData.cpf)}
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
      </div>
    </div>
  );
};

export default AddMotoristaModal;