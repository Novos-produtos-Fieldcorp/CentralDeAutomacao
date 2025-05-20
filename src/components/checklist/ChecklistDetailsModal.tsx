import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Camera, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportChecklistToPDF } from '../../utils/export';
import { getStatusInfo } from '../../utils/checklistStatus';
import type { Checklist } from '../../types/database';
import LoadingSpinner from '../LoadingSpinner';
import { PhotoThumbnail } from './PhotoThumbnail';
import { ChecklistSection } from './ChecklistSection';

interface ChecklistDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklist: Checklist | null;
}

const ChecklistDetailsModal = ({ isOpen, onClose, checklist }: ChecklistDetailsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklistDetails, setChecklistDetails] = useState<any>(null);
  const [statusItems, setStatusItems] = useState<{ status_id: number; status: string }[]>([]);
  const retryTimeoutRef = useRef<number>();

  useEffect(() => {
    fetchStatusItems();
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen && checklist) {
      fetchChecklistDetails();
    }
  }, [isOpen, checklist]);

  const fetchStatusItems = async (retryCount = 0) => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('status_item')
        .select('*')
        .order('status_id');

      if (error) throw error;
      
      if (data) {
        setStatusItems(data);
      } else {
        throw new Error('No data received from status items query');
      }
    } catch (error) {
      console.error('Error fetching status items:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Erro ao carregar itens de status: ${errorMessage}`);

      // Retry logic - maximum 3 retries with exponential backoff
      if (retryCount < 3) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        retryTimeoutRef.current = window.setTimeout(() => {
          fetchStatusItems(retryCount + 1);
        }, retryDelay);
      }
    }
  };

  const fetchChecklistDetails = async () => {
    if (!checklist) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('checklist')
        .select(`
          *,
          motorista:motorista_id (*),
          veiculo:veiculo_id (*),
          acessorios_veiculos!checklist_id(*),
          componentes_gerais!checklist_id(*),
          farol_veiculo!checklist_id(*),
          fluido_veiculo!checklist_id(*),
          foto_checklist!checklist_id(*)
        `)
        .eq('checklist_id', checklist.checklist_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const processedData = {
          ...data,
          acessorios: data.acessorios_veiculos?.[0] || null,
          componentes: data.componentes_gerais?.[0] || null,
          farol: data.farol_veiculo?.[0] || null,
          fluidos: data.fluido_veiculo?.[0] || null,
          fotos: data.foto_checklist?.[0] || null
        };

        setChecklistDetails(processedData);
      }
    } catch (error) {
      console.error('Error fetching checklist details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Erro ao carregar detalhes do checklist: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (checklistDetails) {
      exportChecklistToPDF(checklistDetails);
    }
  };

  const renderPhotos = (fotos: Record<string, any>) => {
    if (!fotos) {
      return (
        <div className="text-center py-8">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">
            Nenhuma foto disponível
          </p>
        </div>
      );
    }

    const photoEntries = Object.entries(fotos).filter(([key, value]) => 
      key !== 'id_foto_checklist' && 
      key !== 'checklist_id' && 
      value
    );

    if (photoEntries.length === 0) {
      return (
        <div className="text-center py-8">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">
            Nenhuma foto disponível
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {photoEntries.map(([key, value]) => (
          <PhotoThumbnail
            key={key}
            url={value as string}
            label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          />
        ))}
      </div>
    );
  };

  if (!isOpen || !checklist) return null;

  // Show error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Erro</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setError(null);
                fetchStatusItems();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tentar Novamente
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isMonthlyChecklist = checklist.id_tipo_checklist === 1;
  const details = checklistDetails || checklist;

  const formatDate = (date: string) => {
    // Split the date string (YYYY-MM-DD) and rearrange to DD/MM/YYYY
    const parts = date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return date; // Return original if format is unexpected
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay background */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      
      {/* Modal container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full shadow-md border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {isMonthlyChecklist ? 'Checklist Mensal' : 'Checklist Semanal'}
                </h2>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                  {details.veiculo?.placa.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Basic Information */}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Informações Básicas
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Data:</span>
                      <p className="mt-1 text-base text-gray-900 dark:text-white">
                        {formatDate(details.data)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Hora:</span>
                      <p className="mt-1 text-base text-gray-900 dark:text-white">{details.hora}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Motorista:</span>
                      <p className="mt-1 text-base text-gray-900 dark:text-white font-medium">
                        {details.motorista?.nome}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Veículo:</span>
                      <p className="mt-1 text-base text-gray-900 dark:text-white">
                        {details.veiculo?.placa.toUpperCase()} - {details.veiculo?.marca} {details.veiculo?.tipo}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Quilometragem:</span>
                      <p className="mt-1 text-base text-gray-900 dark:text-white">
                        {details.quilometragem?.toLocaleString('pt-BR')} km
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Sections */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Fluids Section */}
                    {details.fluidos && (
                      <ChecklistSection 
                        title="Níveis de Fluidos"
                        items={details.fluidos}
                        excludeKeys={['id_fluido_veiculo', 'checklist_id']}
                        statusItems={statusItems}
                      />
                    )}

                    {/* Lights Section */}
                    {details.farol && (
                      <ChecklistSection 
                        title="Sistema de Iluminação"
                        items={details.farol}
                        excludeKeys={['id_farol_veiculo', 'checklist_id']}
                        statusItems={statusItems}
                        specialTextKey="luz_indicador_painel"
                      />
                    )}
                  </div>

                  {/* Components Section */}
                  {details.componentes && (
                    <div className="mt-6">
                      <ChecklistSection 
                        title="Componentes Gerais"
                        items={details.componentes}
                        excludeKeys={['id_componentes_gerais', 'checklist_id']}
                        statusItems={statusItems}
                        filterKeys={!isMonthlyChecklist ? ['pedal', 'limpeza_interna', 'sistema_freio'] : undefined}
                        gridCols={2}
                      />
                    </div>
                  )}

                  {/* Accessories Section */}
                  {details.acessorios && (
                    <div className="mt-6">
                      <ChecklistSection 
                        title="Acessórios"
                        items={details.acessorios}
                        excludeKeys={['id_acessorio', 'checklist_id']}
                        statusItems={statusItems}
                        filterKeys={!isMonthlyChecklist ? ['pneu', 'documento_veicular', 'carrinho_carga'] : undefined}
                        gridCols={2}
                        specialTextKey="pneu_ruim"
                        specialTextLabel="Pneu com Problema"
                      />
                    </div>
                  )}

                  {/* Photos Section - Only show for monthly checklist */}
                  {isMonthlyChecklist && (
                    <div className="mt-6">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Fotos do Veículo
                        </h3>
                        {renderPhotos(details.fotos)}
                      </div>
                    </div>
                  )}

                  {/* Observations */}
                  {details.observacoes && (
                    <div className="mt-6">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Observações
                        </h3>
                        <p className="text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {details.observacoes}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChecklistDetailsModal;