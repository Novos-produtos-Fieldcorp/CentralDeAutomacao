import React, { useState, useEffect } from 'react';
import { X, Edit2, Upload, FileText, Eye, Download, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  agregado: any;
  onUpdate: () => void;
}

export default function UnifiedAgregadoModal({ isOpen, onClose, agregado, onUpdate }: UnifiedAgregadoModalProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [isEditingDocuments, setIsEditingDocuments] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [motorista, setMotorista] = useState<any>(null);

  useEffect(() => {
    if (agregado?.motorista_id) {
      fetchMotorista();
    }
  }, [agregado?.motorista_id]);

  const fetchMotorista = async () => {
    try {
      const { data, error } = await supabase
        .from('motoristas')
        .select('*')
        .eq('id', agregado.motorista_id)
        .single();

      if (error) throw error;
      setMotorista(data);
    } catch (error) {
      console.error('Erro ao buscar motorista:', error);
    }
  };

  if (!isOpen || !agregado) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Detalhes do Agregado
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'info'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Informações
          </button>
          <button
            onClick={() => setActiveTab('motorista')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'motorista'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Motorista
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'documents'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Documentos
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'info' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Informações Básicas
                  </h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{agregado.nome}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{agregado.cpf}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{agregado.telefone}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{agregado.email || 'Não informado'}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Status e Datas
                  </h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                      <dd className="text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          agregado.status === 'ativo' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {agregado.status}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Cadastro</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {new Date(agregado.created_at).toLocaleDateString('pt-BR')}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          ) : activeTab === 'motorista' ? (
            <div className="space-y-6">
              {motorista ? (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Informações do Motorista
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{motorista.nome}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{motorista.cpf}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">RG</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{motorista.rg || 'Não informado'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">
                            {motorista.data_nascimento ? new Date(motorista.data_nascimento).toLocaleDateString('pt-BR') : 'Não informado'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{motorista.telefone}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{motorista.email || 'Não informado'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Endereço</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{motorista.endereco || 'Não informado'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome da Mãe</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">
                            {motorista.nome_mae || 'Não informado'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">Nenhum motorista associado</p>
                </div>
              )}
            </div>
          ) : activeTab === 'documents' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Documentos
                </h3>
                <div className="flex space-x-2">
                  {isEditingDocuments || isUploadingDocuments ? (
                    <button
                      onClick={() => {
                        setIsEditingDocuments(false);
                        setIsUploadingDocuments(false);
                      }}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditingDocuments(true)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar e Enviar Documentos
                    </button>
                  )}
                </div>
              </div>
              
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Nenhum documento enviado</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}