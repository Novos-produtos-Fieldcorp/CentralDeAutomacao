import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import { supabase } from '../lib/supabase';
import type { Cliente } from '../types/database';
import toast from 'react-hot-toast';
import { formatCEP } from '../utils/format';

interface EditClienteModalProps {
    isOpen: boolean;
    onClose: () => void;
    cliente: Cliente | null;
    onSuccess: () => void;
}

interface FormData {
    nome: string;
    cnpj: string;
    email: string;
    telefone: string;
    st_cliente: boolean;
}

interface Endereco {
    id_end_cliente?: number;
    nr_end?: number;
    ds_complemento_end?: string;
    logradouro?: {
        id_logradouro?: number;
        logradouro?: string;
        nr_cep?: string;
        bairro?: {
            id_bairro?: number;
            bairro?: string;
            cidade?: {
                id_cidade?: number;
                cidade?: string;
                estado?: {
                    id_estado?: number;
                    sigla_estado?: string;
                };
            };
        };
    };
}

interface EnderecoData {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
}

interface SupabaseEndereco {
    id_end_cliente: number;
    nr_end: number;
    ds_complemento_end: string;
    logradouro: {
        id_logradouro: number;
        logradouro: string;
        nr_cep: string;
        bairro: {
            id_bairro: number;
            bairro: string;
            cidade: {
                id_cidade: number;
                cidade: string;
                estado: {
                    id_estado: number;
                    sigla_estado: string;
                };
            };
        };
    };
}

const EditClienteModal: React.FC<EditClienteModalProps> = ({ isOpen, onClose, cliente, onSuccess }) => {
    const { query, companyId } = useCompanyData();
    const [loadingCep, setLoadingCep] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [estados, setEstados] = useState<{ id_estado: number; sigla_estado: string }[]>([]);
    const [endereco, setEndereco] = useState<Endereco | null>(null);
    const [formData, setFormData] = useState<FormData>({
        nome: cliente?.nome || '',
        cnpj: cliente?.cnpj || '',
        email: cliente?.email || '',
        telefone: cliente?.telefone?.toString() || '',
        st_cliente: cliente?.st_cliente || false
    });
    const [enderecoData, setEnderecoData] = useState<EnderecoData>({
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchEstados();
        }
    }, [isOpen]);

    useEffect(() => {
        if (cliente) {
            setFormData({
                nome: cliente.nome || '',
                cnpj: cliente.cnpj || '',
                email: cliente.email || '',
                telefone: cliente.telefone?.toString() || '',
                st_cliente: cliente.st_cliente || false
            });
            fetchEndereco(cliente.cliente_id);
        }
    }, [cliente]);

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

    const fetchEndereco = async (clienteId: number) => {
        try {
            const { data, error } = await supabase
                .from('end_cliente')
                .select(`
                    id_end_cliente,
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
                .eq('cliente_id', clienteId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                const logradouro = Array.isArray(data.logradouro) ? data.logradouro[0] : data.logradouro;
                const bairro = Array.isArray(logradouro?.bairro) ? logradouro.bairro[0] : logradouro?.bairro;
                
                const enderecoData = {
                    ...data,
                    logradouro: logradouro ? {
                        ...logradouro,
                        bairro: bairro
                    } : null
                } as unknown as SupabaseEndereco;
                
                setEndereco(enderecoData);
                
                // Update form data with address
                setEnderecoData({
                    cep: enderecoData.logradouro?.nr_cep || '',
                    estado: enderecoData.logradouro?.bairro?.cidade?.estado?.id_estado?.toString() || '',
                    cidade: enderecoData.logradouro?.bairro?.cidade?.cidade || '',
                    bairro: enderecoData.logradouro?.bairro?.bairro || '',
                    logradouro: enderecoData.logradouro?.logradouro || '',
                    numero: enderecoData.nr_end?.toString() || '',
                    complemento: enderecoData.ds_complemento_end || ''
                });
            }
        } catch (error) {
            console.error('Erro ao carregar endereço:', error);
            toast.error('Erro ao carregar endereço');
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
        if (!cliente || !companyId) return;

        try {
            setSubmitting(true);
            
            // First, update the client data
            const { error: clienteError } = await supabase
                .from('cliente')
                .update({
                    nome: formData.nome,
                    cnpj: formData.cnpj,
                    email: formData.email || null,
                    telefone: formData.telefone || null,
                    st_cliente: formData.st_cliente
                })
                .eq('cliente_id', cliente.cliente_id)
                .eq('company_id', companyId);

            if (clienteError) throw clienteError;

            // If there's address data, update it
            if (enderecoData.cep && enderecoData.estado && enderecoData.cidade && enderecoData.bairro && enderecoData.logradouro) {
                let logradouroId = endereco?.logradouro?.id_logradouro;
                
                if (!logradouroId) {
                    // Create the address hierarchy: estado -> cidade -> bairro -> logradouro
                    
                    // 1. Get or create estado (should already exist)
                    const estadoId = parseInt(enderecoData.estado);
                    
                    // 2. Get or create cidade
                    let { data: cidadeData, error: cidadeError } = await supabase
                        .from('cidade')
                        .select('id_cidade')
                        .eq('cidade', enderecoData.cidade)
                        .eq('id_estado', estadoId)
                        .maybeSingle();

                    if (cidadeError && cidadeError.code !== 'PGRST116') throw cidadeError;

                    let cidadeId: number;
                    if (!cidadeData) {
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
                    } else {
                        cidadeId = cidadeData.id_cidade;
                    }

                    // 3. Get or create bairro
                    let { data: bairroData, error: bairroError } = await supabase
                        .from('bairro')
                        .select('id_bairro')
                        .eq('bairro', enderecoData.bairro)
                        .eq('id_cidade', cidadeId)
                        .maybeSingle();

                    if (bairroError && bairroError.code !== 'PGRST116') throw bairroError;

                    let bairroId: number;
                    if (!bairroData) {
                        const { data: newBairro, error: newBairroError } = await supabase
                            .from('bairro')
                            .insert({
                                bairro: enderecoData.bairro,
                                id_cidade: cidadeId
                            })
                            .select('id_bairro')
                            .single();

                        if (newBairroError) throw newBairroError;
                        bairroId = newBairro.id_bairro;
                    } else {
                        bairroId = bairroData.id_bairro;
                    }

                    // 4. Get or create logradouro
                    let { data: logradouroData, error: logradouroError } = await supabase
                        .from('logradouro')
                        .select('id_logradouro')
                        .eq('logradouro', enderecoData.logradouro)
                        .eq('nr_cep', enderecoData.cep)
                        .eq('id_bairro', bairroId)
                        .maybeSingle();

                    if (logradouroError && logradouroError.code !== 'PGRST116') throw logradouroError;

                    if (!logradouroData) {
                        const { data: newLogradouro, error: newLogradouroError } = await supabase
                            .from('logradouro')
                            .insert({
                                logradouro: enderecoData.logradouro,
                                nr_cep: enderecoData.cep,
                                id_bairro: bairroId
                            })
                            .select('id_logradouro')
                            .single();

                        if (newLogradouroError) throw newLogradouroError;
                        logradouroId = newLogradouro.id_logradouro;
                    } else {
                        logradouroId = logradouroData.id_logradouro;
                    }
                } else {
                    // Update existing logradouro if needed
                    const { error: updateLogradouroError } = await supabase
                        .from('logradouro')
                        .update({
                            logradouro: enderecoData.logradouro,
                            nr_cep: enderecoData.cep
                        })
                        .eq('id_logradouro', logradouroId);

                    if (updateLogradouroError) throw updateLogradouroError;
                }

                // Finally, update or create the end_cliente record
                if (endereco?.id_end_cliente) {
                    const { error: enderecoError } = await supabase
                        .from('end_cliente')
                        .update({
                            nr_end: parseInt(enderecoData.numero) || null,
                            ds_complemento_end: enderecoData.complemento || null,
                            id_logradouro: logradouroId
                        })
                        .eq('id_end_cliente', endereco.id_end_cliente);

                    if (enderecoError) throw enderecoError;
                } else {
                    const { error: enderecoError } = await supabase
                        .from('end_cliente')
                        .insert({
                            cliente_id: cliente.cliente_id,
                            nr_end: parseInt(enderecoData.numero) || null,
                            ds_complemento_end: enderecoData.complemento || null,
                            id_logradouro: logradouroId
                        });

                    if (enderecoError) throw enderecoError;
                }
            }

            toast.success('Cliente atualizado com sucesso');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating cliente:', error);
            toast.error('Erro ao atualizar cliente');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Editar Cliente
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
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
                        <div className="col-span-2 mt-2">
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
                                    value={enderecoData.cep}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        setEnderecoData(prev => ({ ...prev, cep: value }));
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
                            {enderecoData.cep && enderecoData.cep.length === 8 && (
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {formatCEP(enderecoData.cep)}
                              </div>
                            )}
                        </div>
                        
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Estado
                            </label>
                            <select
                                value={enderecoData.estado}
                                onChange={(e) => setEnderecoData(prev => ({ ...prev, estado: e.target.value }))}
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
                                value={enderecoData.cidade}
                                onChange={(e) => setEnderecoData(prev => ({ ...prev, cidade: e.target.value }))}
                                className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                        </div>
                        
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Bairro
                            </label>
                            <input
                                type="text"
                                value={enderecoData.bairro}
                                onChange={(e) => setEnderecoData(prev => ({ ...prev, bairro: e.target.value }))}
                                className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                        </div>
                        
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Logradouro
                            </label>
                            <input
                                type="text"
                                value={enderecoData.logradouro}
                                onChange={(e) => setEnderecoData(prev => ({ ...prev, logradouro: e.target.value }))}
                                className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                        </div>
                        
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Número
                            </label>
                            <input
                                type="text"
                                value={enderecoData.numero}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    setEnderecoData(prev => ({ ...prev, numero: value }));
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
                                value={enderecoData.complemento}
                                onChange={(e) => setEnderecoData(prev => ({ ...prev, complemento: e.target.value }))}
                                className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                            disabled={submitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
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
                </form>
            </div>
        </div>
    );
};

export default EditClienteModal;