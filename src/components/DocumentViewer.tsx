import React, { useState } from 'react';
import { X, FileText, Camera, ExternalLink, Upload, Loader2, Phone, Mail, Calendar, Home, MapPin, Info, User, CreditCard } from 'lucide-react';
import type { DocumentoMotorista, Veiculo, DocumentoVeiculo } from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documento: DocumentoMotorista | null;
  nome: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  dt_nascimento?: string;
  endereco?: {
    logradouro?: {
      logradouro?: string;
      nr_cep?: string;
      bairro?: {
        bairro?: string;
        cidade?: {
          cidade?: string;
          estado?: {
            sigla_estado?: string;
          };
        };
      };
    };
    nr_end?: number;
    ds_complemento_end?: string;
  } | null;
  veiculo?: (Veiculo & {
    documento_veiculo: DocumentoVeiculo[];
  }) | null;
  isAgregado?: boolean;
  st_cadastro?: string;
}

const DocumentViewer = ({ isOpen, onClose, documento, nome, cpf, email, telefone, dt_nascimento, endereco, veiculo, isAgregado = false, st_cadastro }: DocumentViewerProps) => {
  const [activeDocument, setActiveDocument] = useState<string | null>(null);

  if (!isOpen) return null;

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header - Fixed */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Documentos de {nome} {isAgregado ? '(Agregado)' : '(Motorista)'}
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                           rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Informações Pessoais */}
                  <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Informações Pessoais
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {nome}
                        </div>
                      </div>
                      
                      {cpf && (
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</div>
                          <div className="text-base text-gray-900 dark:text-white break-words">
                            {formatCPF(cpf)}
                          </div>
                        </div>
                      )}
                      
                      {st_cadastro && (
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                          <div className="text-base text-gray-900 dark:text-white break-words capitalize">
                            {st_cadastro.replace('_', ' ')}
                          </div>
                        </div>
                      )}
                      
                      {/* Telefone */}
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {telefone ? formatPhone(telefone.toString()) : 'Não informado'}
                        </div>
                      </div>
                      
                      {/* Email */}
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {email || 'Não informado'}
                        </div>
                      </div>
                      
                      {/* Data de Nascimento */}
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {dt_nascimento ? formatDate(dt_nascimento) : 'Não informada'}
                        </div>
                      </div>
                    </div>
                  </section>

                  <hr className="border-t border-gray-200 dark:border-gray-700" />
                  
                  {/* Seção 2: Endereço */}
                  <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Home className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      Endereço
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Logradouro</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {endereco?.logradouro?.logradouro ? 
                            `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                            'Não informado'
                          }
                        </div>
                      </div>
                      
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Complemento</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {endereco?.ds_complemento_end || 'Não informado'}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Bairro</div>
                          <div className="text-base text-gray-900 dark:text-white break-words">
                            {endereco?.logradouro?.bairro?.bairro || 'Não informado'}
                          </div>
                        </div>
                        
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CEP</div>
                          <div className="text-base text-gray-900 dark:text-white break-words">
                            {endereco?.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Cidade</div>
                          <div className="text-base text-gray-900 dark:text-white break-words">
                            {endereco?.logradouro?.bairro?.cidade?.cidade || 'Não informada'}
                          </div>
                        </div>
                        
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Estado</div>
                          <div className="text-base text-gray-900 dark:text-white break-words">
                            {endereco?.logradouro?.bairro?.cidade?.estado?.sigla_estado || 'Não informado'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <hr className="border-t border-gray-200 dark:border-gray-700" />
                  
                  {/* Seção 3: Informações da CNH */}
                  <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      Informações da CNH
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Número da CNH</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {documento?.nr_registro_cnh || 'Não informado'}
                        </div>
                      </div>
                      
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoria</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {documento?.categoria_cnh || 'Não informada'}
                        </div>
                      </div>
                      
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Validade</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {documento?.validade_cnh ? formatDate(documento.validade_cnh) : 'Não informada'}
                        </div>
                      </div>
                      
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome da Mãe</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {documento?.nome_mae || 'Não informado'}
                        </div>
                      </div>
                      
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome do Pai</div>
                        <div className="text-base text-gray-900 dark:text-white break-words">
                          {documento?.nome_pai || 'Não informado'}
                        </div>
                      </div>
                    </div>
                  </section>

                  <hr className="border-t border-gray-200 dark:border-gray-700" />
                  
                  {/* Seção 4: Fotos dos Documentos */}
                  <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Documentos
                    </h3>
                    
                    <div className="space-y-8">
                      {/* CNH */}
                      <div>
                        <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                          <span>Carteira Nacional de Habilitação (CNH)</span>
                          {documento?.foto_cnh && (
                            <button
                              onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                            >
                              <ExternalLink size={16} />
                              Abrir em nova aba
                            </button>
                          )}
                        </h4>
                        
                        {documento?.foto_cnh ? (
                          <div className="relative aspect-[1.586] w-full bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden group">
                            {isPdf(documento.foto_cnh) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                <button
                                  onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                >
                                  <ExternalLink size={16} />
                                  Abrir PDF
                                </button>
                              </div>
                            ) : (
                              <img
                                src={documento.foto_cnh}
                                alt="CNH"
                                className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-black/20 transition-colors duration-200" />
                          </div>
                        ) : (
                          <div className="aspect-[1.586] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                            <div className="text-center">
                              <p className="text-gray-500 dark:text-gray-400 font-medium">CNH não cadastrada</p>
                              <p className="text-sm text-gray-400 dark:text-gray-500">
                                Faça o upload da CNH para visualizá-la aqui
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Comprovante de Residência */}
                      <div>
                        <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                          <span>Comprovante de Residência</span>
                          {documento?.foto_comprovante_residencia && (
                            <button
                              onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                            >
                              <ExternalLink size={16} />
                              Abrir em nova aba
                            </button>
                          )}
                        </h4>
                        
                        {documento?.foto_comprovante_residencia ? (
                          <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden group">
                            {isPdf(documento.foto_comprovante_residencia) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                <button
                                  onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                >
                                  <ExternalLink size={16} />
                                  Abrir PDF
                                </button>
                              </div>
                            ) : (
                              <img
                                src={documento.foto_comprovante_residencia}
                                alt="Comprovante de Residência"
                                className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-black/20 transition-colors duration-200" />
                          </div>
                        ) : (
                          <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                            <div className="text-center">
                              <p className="text-gray-500 dark:text-gray-400 font-medium">Comprovante não cadastrado</p>
                              <p className="text-sm text-gray-400 dark:text-gray-500">
                                Faça o upload do comprovante para visualizá-lo aqui
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Documentos do Veículo (apenas para Agregados) */}
                      {isAgregado && veiculo && (
                        <div>
                          <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                            <span>Documentos do Veículo</span>
                            {veiculo.documento_veiculo?.[0]?.foto_crv && (
                              <button
                                onClick={() => openDocumentInNewTab(veiculo.documento_veiculo[0].foto_crv)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                              >
                                <ExternalLink size={16} />
                                Abrir em nova aba
                              </button>
                            )}
                          </h4>
                          
                          {veiculo.documento_veiculo?.[0]?.foto_crv ? (
                            <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden group">
                              {isPdf(veiculo.documento_veiculo[0].foto_crv) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                  <button
                                    onClick={() => openDocumentInNewTab(veiculo.documento_veiculo[0].foto_crv)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                  >
                                    <ExternalLink size={16} />
                                    Abrir PDF
                                  </button>
                                </div>
                              ) : (
                                <img
                                  src={veiculo.documento_veiculo[0].foto_crv}
                                  alt="CRV do veículo"
                                  className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                  onClick={() => openDocumentInNewTab(veiculo.documento_veiculo[0].foto_crv)}
                                />
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-black/20 transition-colors duration-200" />
                            </div>
                          ) : (
                            <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                              <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                              <div className="text-center">
                                <p className="text-gray-500 dark:text-gray-400 font-medium">CRV não cadastrado</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500">
                                  Faça o upload do CRV para visualizá-lo aqui
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Informações do Veículo</h5>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Placa:</span>
                                  <p className="text-sm text-gray-900 dark:text-white">{veiculo.placa.toUpperCase()}</p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Marca/Modelo:</span>
                                  <p className="text-sm text-gray-900 dark:text-white">{veiculo.marca} {veiculo.tipo}</p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ano:</span>
                                  <p className="text-sm text-gray-900 dark:text-white">{veiculo.ano || 'Não informado'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen document viewer */}
      {activeDocument && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setActiveDocument(null)}
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
                  onClick={() => openDocumentInNewTab(activeDocument)}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Abrir em nova aba"
                >
                  <ExternalLink size={20} />
                </button>
                <button
                  onClick={() => setActiveDocument(null)}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="relative h-[calc(90vh-80px)]">
              {isPdf(activeDocument) ? (
                <iframe 
                  src={`${activeDocument}#toolbar=1`} 
                  className="w-full h-full" 
                  title="PDF Viewer"
                />
              ) : (
                <img
                  src={activeDocument}
                  alt="Documento"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;