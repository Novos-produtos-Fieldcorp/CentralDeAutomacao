import React from 'react';
import { X, Truck, MapPin, PenTool as Tool, FileText, CheckCircle2, XCircle } from 'lucide-react';
import type { Veiculo } from '../../types/database';

interface VehicleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
  isEmpresa?: boolean;
}

const VehicleDetailsModal = ({ isOpen, onClose, veiculo, isEmpresa = false }: VehicleDetailsModalProps) => {
  if (!isOpen || !veiculo) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full shadow-xl">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Detalhes do Veículo
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                           rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Vehicle Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-gray-400" />
                    Informações do Veículo
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</span>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white uppercase">{veiculo.placa || 'Não informada'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca</span>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculo.marca || 'Não informada'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Modelo</span>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculo.tipo || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ano</span>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculo.ano || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cor</span>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculo.cor || 'Não informada'}</p>
                    </div>
                  </div>
                </div>

                {/* Document Info - Only show for company vehicles */}
                {isEmpresa && veiculo.documento_veiculo?.[0] && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-gray-400" />
                      CRV Digital
                    </h3>
                    {veiculo.documento_veiculo[0].foto_crv ? (
                      <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        <img
                          src={veiculo.documento_veiculo[0].foto_crv}
                          alt="CRV do veículo"
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <p className="text-gray-500 dark:text-gray-400">CRV não cadastrado</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* If no document, show a placeholder to maintain grid balance */}
                {isEmpresa && !veiculo.documento_veiculo?.[0] && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-gray-400" />
                      CRV Digital
                    </h3>
                    <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-gray-500 dark:text-gray-400">CRV não cadastrado</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Specifications */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Technical Specs */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Tool className="w-5 h-5 text-gray-400" />
                    Especificações Técnicas
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipologia</span>
                      <p className="text-base text-gray-900 dark:text-white">{veiculo.tipologia || 'Não informada'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Combustível</span>
                      <p className="text-base text-gray-900 dark:text-white">{veiculo.combustivel || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Peso</span>
                      <p className="text-base text-gray-900 dark:text-white">{veiculo.peso ? `${veiculo.peso} kg` : 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cubagem</span>
                      <p className="text-base text-gray-900 dark:text-white">{veiculo.cubagem ? `${veiculo.cubagem} m³` : 'Não informada'}</p>
                    </div>
                  </div>
                </div>

                {/* Tracking Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    Rastreamento
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status do Rastreador</span>
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          veiculo.possui_rastreador
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {veiculo.possui_rastreador ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Instalado
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-2" />
                              Não Instalado
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    {veiculo.possui_rastreador && veiculo.marca_rastreador && (
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca do Rastreador</span>
                        <p className="text-base text-gray-900 dark:text-white mt-1">{veiculo.marca_rastreador}</p>
                      </div>
                    )}
                    {/* Add placeholder content when rastreador is false to maintain layout */}
                    {!veiculo.possui_rastreador && (
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Observação</span>
                        <p className="text-base text-gray-900 dark:text-white mt-1">Veículo sem rastreador instalado</p>
                      </div>
                    )}
                    {/* Add placeholder content when rastreador is true but no brand */}
                    {veiculo.possui_rastreador && !veiculo.marca_rastreador && (
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca do Rastreador</span>
                        <p className="text-base text-gray-900 dark:text-white mt-1">Não informada</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleDetailsModal;