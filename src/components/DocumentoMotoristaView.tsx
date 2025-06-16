import React, { useState } from 'react';
import { MapPin, Phone, Mail, FileText, Calendar, CreditCard, Info, Camera, User, UserCircle, ExternalLink, Home, X } from 'lucide-react';
import type { DocumentoMotorista, Veiculo, DocumentoVeiculo } from '../types/database';
import { formatPhone, formatDate, formatCEP } from '../utils/format';

interface DocumentoMotoristaViewProps {
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
}

const DocumentoMotoristaView: React.FC<DocumentoMotoristaViewProps> = ({
  documento,
  nome,
  cpf,
  email,
  telefone,
  dt_nascimento,
  endereco,
  veiculo,
  isAgregado = false
}) => {
  const [activeDocument, setActiveDocument] = useState<string | null>(null);

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div>
        {/* Seção 1: Informações Pessoais */}
        <section className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Informações Pessoais
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Telefone */}
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Telefone</div>
                <div className="text-base text-gray-900 dark:text-white">
                  {telefone ? formatPhone(telefone.toString()) : 'Não informado'}
                </div>
              </div>
            </div>
            
            {/* Email */}
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Email</div>
                <div className="text-base text-gray-900 dark:text-white">
                  {email || 'Não informado'}
                </div>
              </div>
            </div>
            
            {/* Data de Nascimento */}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Data de Nascimento</div>
                <div className="text-base text-gray-900 dark:text-white">
                  {dt_nascimento ? formatDate(dt_nascimento) : 'Não informada'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-t border-gray-200 dark:border-gray-700" />
        
        {/* Seção 2: Endereço */}
        <section className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Home className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Endereço
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    Logradouro
                  </div>
                  <p className="text-base text-gray-900 dark:text-white">
                    {endereco?.logradouro?.logradouro ? 
                      `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                      'Não informado'
                    }
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Info className="w-4 h-4 text-gray-400" />
                    Complemento
                  </div>
                  <p className="text-base text-gray-900 dark:text-white">
                    {endereco?.ds_complemento_end || 'Não informado'}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <FileText className="w-4 h-4 text-gray-400" />
                    CEP
                  </div>
                  <p className="text-base text-gray-900 dark:text-white">
                    {endereco?.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    Bairro
                  </div>
                  <p className="text-base text-gray-900 dark:text-white">
                    {endereco?.logradouro?.bairro?.bairro || 'Não informado'}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    Cidade/Estado
                  </div>
                  <p className="text-base text-gray-900 dark:text-white">
                    {endereco?.logradouro?.bairro?.cidade?.cidade && endereco?.logradouro?.bairro?.cidade?.estado?.sigla_estado ? 
                      `${endereco.logradouro.bairro.cidade.cidade}/${endereco.logradouro.bairro.cidade.estado.sigla_estado}` : 
                      'Não informado'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-t border-gray-200 dark:border-gray-700" />
        
        {/* Seção 3: Informações da CNH */}
        <section className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Informações da CNH
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  Número da CNH
                </div>
                <p className="text-base text-gray-900 dark:text-white">
                  {documento?.nr_registro_cnh || 'Não informado'}
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FileText className="w-4 h-4 text-gray-400" />
                  Categoria
                </div>
                <p className="text-base text-gray-900 dark:text-white">
                  {documento?.categoria_cnh || 'Não informada'}
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Data de Validade
                </div>
                <p className="text-base text-gray-900 dark:text-white">
                  {documento?.validade_cnh ? formatDate(documento.validade_cnh) : 'Não informada'}
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  UF da CNH
                </div>
                <p className="text-base text-gray-900 dark:text-white">
                  {documento?.uf_cnh || 'Não informada'}
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <User className="w-4 h-4 text-gray-400" />
                  Nome da Mãe
                </div>
                <p className="text-base text-gray-900 dark:text-white">
                  {documento?.nome_mae || 'Não informado'}
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <User className="w-4 h-4 text-gray-400" />
                  Nome do Pai
                </div>
                <p className="text-base text-gray-900 dark:text-white">
                  {documento?.nome_pai || 'Não informado'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-t border-gray-200 dark:border-gray-700" />
        
        {/* Seção 4: Fotos dos Documentos */}
        <section className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
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

export default DocumentoMotoristaView;