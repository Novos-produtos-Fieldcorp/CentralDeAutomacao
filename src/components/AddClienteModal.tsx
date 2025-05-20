import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { formatCEP } from '../utils/format';

interface AddClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddClienteModal = ({ isOpen, onClose, onSuccess }: AddClienteModalProps) => {
  const { query } = useCompanyData();
  const [submitting, setSubmitting] = useState(false); 
  const [loadingCep, setLoadingCep] = useState(false);
  const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    st_cliente: true,
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

      // Insert cliente
      const { data: cliente, error: clienteError } = await query('cliente')
        .insert({
          nome: formData.nome,
          cnpj: formData.cnpj,
          email: formData.email || null,
          telefone: formData.telefone || null,
          st_cliente: formData.st_cliente
        })
        .select()
        .single();

      if (clienteError) throw clienteError;

      // Insert address if all required fields are filled
      if (formData.logradouro && formData.cidade && formData.estado) {
        try {
          // First, check if cidade exists
          let cidadeId: number;
          const { data: cidadeData, error: cidadeError } = await supabase
            .from('cidade')
            .select('id_cidade')
            .eq('cidade', formData.cidade)
            .eq('id_estado', formData.estado)
            .maybeSingle();

          if (cidadeError && cidadeError.code !== 'PGRST116') {
            throw cidadeError;
          }

          if (cidadeData) {
            cidadeId = cidadeData.id_cidade;
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

          // Create end_cliente
          const { error: enderecoError } = await supabase
            .from('end_cliente')
            .insert({
              nr_end: formData.numero ? parseInt(formData.numero) : null,
              ds_complemento_end: formData.complemento || null,
              cliente_id: cliente.cliente_id,
              id_logradouro: logradouroId
            });

          if (enderecoError) throw enderecoError;
        } catch (error) {
          console.error('Erro ao cadastrar endereço:', error);
          // Don't throw here, as address is optional
          toast.error('Erro ao cadastrar endereço, mas o cliente foi cadastrado');
        }
      }

      if (clienteError) throw clienteError;

      toast.success('Cliente cadastrado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating cliente:', error);
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Novo Cliente
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  CNPJ *
                </label>
                <input
                  type="text"
                  value={formData.cnpj}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 14) {
                      setFormData(prev => ({ ...prev, cnpj: value }));
                    }
                  }}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  maxLength={14}
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      setFormData(prev => ({ ...prev, telefone: value }));
                    }
                  }}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  maxLength={11}
                />
              </div>

              <div className="col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.st_cliente}
                    onChange={(e) => setFormData(prev => ({ ...prev, st_cliente: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cliente Ativo
                  </span>
                </label>
              </div>
            
              {/* Address Section */}
              <div className="col-span-2 mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                  Endereço
                </h3>
              </div>
            
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  CEP
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.cep}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData(prev => ({ ...prev, cep: value }));
                      if (value.length === 8) {
                        consultarCep(value);
                      }
                    }}
                    className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    maxLength={8}
                    placeholder="Somente números"
                  />
                  {loadingCep && (
                    <div className="mt-1 flex items-center px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>
                {formData.cep && formData.cep.length === 8 && (
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {formatCEP(formData.cep)}
                  </div>
                )}
              </div>
            
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Estado
                </label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Selecione um estado</option>
                  {estados.map(estado => (
                    <option key={estado.id_estado} value={estado.id_estado}>
                      {estado.sigla_estado}
                    </option>
                  ))}
                </select>
              </div>
            
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cidade
                </label>
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Bairro
                </label>
                <input
                  type="text"
                  value={formData.bairro}
                  onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Logradouro
                </label>
                <input
                  type="text"
                  value={formData.logradouro}
                  onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Número
                </label>
                <input
                  type="text"
                  value={formData.numero}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData(prev => ({ ...prev, numero: value }));
                  }}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Somente números"
                />
              </div>
            
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Complemento
                </label>
                <input
                  type="text"
                  value={formData.complemento}
                  onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddClienteModal;