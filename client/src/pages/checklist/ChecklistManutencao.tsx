import React, { useState, useEffect, useRef } from 'react';
import { Truck, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, PenTool as Tool, Calendar, FileText, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompanyData } from '../../hooks/useCompanyData';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import LoadingSpinner from '../../components/LoadingSpinner';

interface MaintenanceItem {
  id: number;
  veiculo: {
    placa: string;
    marca: string;
    tipo: string;
  };
  tipo: 'preventiva' | 'corretiva';
  prioridade: 'alta' | 'media' | 'baixa';
  componentes: {
    categoria: string;
    item: string;
    status: string;
    status_id: number;
    data_checklist: string;
    tipo_checklist: string;
    motorista: {
      nome: string;
      cpf: string;
    };
  }[];
  data_checklist: string;
}

interface AlertDetails {
  id: number;
  isOpen: boolean;
}

interface StatusItem {
  status_id: number;
  status: string;
}

const ChecklistManutencao = () => {
  const { query, companyId } = useCompanyData();
  const [alerts, setAlerts] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<AlertDetails | null>(null);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all', false);
  
  // Validate date is within acceptable range
  const validateDate = (dateString: string): boolean => {
    if (!dateString) return true; // Allow empty
    const year = parseInt(dateString.split('-')[0]);
    return year >= 2020 && year <= 2099;
  };
  
  // Dropdown states
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  useEffect(() => {
    fetchStatusItems();
  }, []);

  useEffect(() => {
    // Only fetch when date range actually changes
    if (statusItems.length > 0) {
      fetchMaintenanceAlerts();
    }
  }, [dateRange, statusItems, companyId]);

  const fetchStatusItems = async () => {
    try {
      const { data, error } = await supabase
        .from('status_item')
        .select('*')
        .order('status_id');

      if (error) throw error;
      setStatusItems(data || []);
    } catch (error) {
      console.error('Error fetching status items:', error);
      toast.error('Erro ao carregar status');
    }
  };

  const fetchMaintenanceAlerts = async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      
      // Fetch all checklists with issues
      const { data: checklists, error: checklistError } = await supabase.from('checklist')
        .select(`
          checklist_id,
          data,
          hora,
          id_tipo_checklist,
          motorista:motorista_id (
            nome,
            cpf
          ),
          veiculo:veiculo_id (
            placa,
            marca,
            tipo
          ),
          acessorios_veiculos!checklist_id(*),
          componentes_gerais!checklist_id(*),
          farol_veiculo!checklist_id(*),
          fluido_veiculo!checklist_id(*)
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false });

      if (checklistError) throw checklistError;

      if (checklists) {
        const maintenanceItems: MaintenanceItem[] = [];
        let itemId = 1;

        for (const checklist of checklists) {
          const issues: {
            categoria: string;
            item: string;
            status: string;
            status_id: number;
            data_checklist: string;
            tipo_checklist: string;
            motorista: {
              nome: string;
              cpf: string;
            };
          }[] = [];

          // Check each section for issues
          const sections = {
            'Acessórios': checklist.acessorios_veiculos?.[0],
            'Componentes': checklist.componentes_gerais?.[0],
            'Iluminação': checklist.farol_veiculo?.[0],
            'Fluidos': checklist.fluido_veiculo?.[0]
          };

          Object.entries(sections).forEach(([categoria, section]) => {
            if (!section) return;

            Object.entries(section).forEach(([key, value]) => {
              // Skip ID fields and non-status fields
              if (key.includes('id_') || key === 'checklist_id' || key === 'pneu_ruim' || key === 'luz_indicador_painel') return;

              // Status 2 indicates an issue
              if (value === 2) {
                const statusItem = statusItems.find(item => Number(item.status_id) === Number(value));
                
                // Format the item name for better readability
                const itemName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                // Create a more descriptive status based on the item type
                let descriptiveStatus = statusItem?.status || 'Não OK';
                
                // Customize status based on item category and name
                if (categoria === 'Fluidos') {
                  descriptiveStatus = 'Nível Baixo';
                } else if (categoria === 'Iluminação') {
                  if (key.includes('pisca') || key.includes('farol') || key.includes('luz')) {
                    descriptiveStatus = 'Queimado';
                  }
                } else if (categoria === 'Componentes') {
                  if (key.includes('limpeza')) {
                    descriptiveStatus = 'Suja';
                  } else if (key.includes('freio')) {
                    descriptiveStatus = 'Com Problema';
                  } else {
                    descriptiveStatus = 'Danificado';
                  }
                } else if (categoria === 'Acessórios') {
                  if (key === 'pneu') {
                    descriptiveStatus = 'Desgastado';
                  } else if (key.includes('extintor')) {
                    descriptiveStatus = 'Vencido';
                  } else {
                    descriptiveStatus = 'Ausente';
                  }
                }
                
                issues.push({
                  categoria,
                  item: itemName,
                  status: descriptiveStatus,
                  status_id: value as number,
                  data_checklist: checklist.data,
                  tipo_checklist: checklist.id_tipo_checklist === 1 ? 'Mensal' : 'Semanal',
                  motorista: {
                    nome: Array.isArray(checklist.motorista) ? checklist.motorista[0]?.nome || '' : checklist.motorista?.nome || '',
                    cpf: Array.isArray(checklist.motorista) ? checklist.motorista[0]?.cpf || '' : checklist.motorista?.cpf || ''
                  }
                });
              }
            });
          });

          if (issues.length > 0) {
            // Group issues by vehicle
            const existingItem = maintenanceItems.find(
              item => item.veiculo.placa === (Array.isArray(checklist.veiculo) ? checklist.veiculo[0]?.placa : checklist.veiculo?.placa)
            );

            if (existingItem) {
              // Add new issues to existing vehicle
              existingItem.componentes.push(...issues);
              // Update date if this checklist is more recent
              if (new Date(checklist.data) > new Date(existingItem.data_checklist)) {
                existingItem.data_checklist = checklist.data;
              }
            } else {
              // Create new maintenance item
              maintenanceItems.push({
                id: itemId++,
                veiculo: {
                  placa: (Array.isArray(checklist.veiculo) ? checklist.veiculo[0]?.placa : checklist.veiculo?.placa)?.toUpperCase() || '',
                  marca: Array.isArray(checklist.veiculo) ? checklist.veiculo[0]?.marca || '' : checklist.veiculo?.marca || '',
                  tipo: Array.isArray(checklist.veiculo) ? checklist.veiculo[0]?.tipo || '' : checklist.veiculo?.tipo || ''
                },
                tipo: issues.some(i => ['Fluidos', 'Componentes'].includes(i.categoria)) 
                  ? 'corretiva' 
                  : 'preventiva',
                prioridade: issues.length > 3 ? 'alta' : issues.length > 1 ? 'media' : 'baixa',
                componentes: issues,
                data_checklist: checklist.data
              });
            }
          }
        }

        // Sort maintenance items by date (most recent first)
        maintenanceItems.sort((a, b) => {
          const dateA = new Date(a.data_checklist);
          const dateB = new Date(b.data_checklist);
          return dateB.getTime() - dateA.getTime();
        });

        setAlerts(maintenanceItems);
      }
    } catch (error) {
      console.error('Error fetching maintenance alerts:', error);
      toast.error('Erro ao carregar alertas de manutenção');
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusColor = (status_id: number) => {
    const statusItem = statusItems.find(item => Number(item.status_id) === Number(status_id));
    if (!statusItem) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';

    switch (status_id) {
      case 1: // OK
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 2: // Não OK
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 3: // N/A
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
  };

  const getPriorityStyle = (prioridade: string) => {
    switch (prioridade) {
      case 'alta':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'media':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'baixa':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        {/* Período Filter */}
        <div className="relative z-[40]" ref={periodDropdownRef}>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
          >
            <Calendar className="h-4 w-4" />
            <span>
              {periodType === 'all' ? 'Período' : 
               periodType === '1day' ? 'Hoje' :
               periodType === '15days' ? '15 dias' :
               periodType === '30days' ? '30 dias' :
               periodType === 'custom' ? 'Personalizado' : 'Período'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {showPeriodDropdown && (
            <div 
              className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-top-2 fade-in duration-200"
              style={{ 
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                zIndex: 999999
              }}
            >
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar período</span>
              </div>
              {[
                { value: 'all', label: 'Todos os períodos' },
                { value: '1day', label: 'Hoje' },
                { value: '15days', label: 'Últimos 15 dias' },
                { value: '30days', label: 'Últimos 30 dias' },
                { value: 'custom', label: 'Período personalizado' }
              ].map(({ value, label }) => (
                <div key={value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                  <button
                    type="button"
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => {
                      updatePeriod(value as any);
                      setShowPeriodDropdown(false);
                    }}
                  >
                    {label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Date Range */}
      {periodType === 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data inicial
            </label>
            <input
              type="date"
              data-testid="input-custom-start-date-checklist-manutencao"
              value={dateRange.startDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (validateDate(newDate)) {
                  setDateRange({ ...dateRange, startDate: e.target.value });
                } else {
                  toast.error('Por favor selecione uma data entre 2020 e 2099');
                }
              }}
              min="2020-01-01"
              max="2099-12-31"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data final
            </label>
            <input
              type="date"
              data-testid="input-custom-end-date-checklist-manutencao"
              value={dateRange.endDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (validateDate(newDate)) {
                  setDateRange({ ...dateRange, endDate: e.target.value });
                } else {
                  toast.error('Por favor selecione uma data entre 2020 e 2099');
                }
              }}
              min="2020-01-01"
              max="2099-12-31"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="text-blue-500" />
            Veículos que Precisam de Atenção
          </h2>
        </div>

        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-[#1f2937] rounded-xl border border-gray-200 dark:border-gray-700">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300">
                Nenhum veículo necessita de manutenção no momento
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-gray-50 dark:bg-[#1f2937] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
              >
                {/* Alert Header */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedAlert(
                    expandedAlert?.id === alert.id 
                      ? null 
                      : { id: alert.id, isOpen: true }
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${
                        alert.prioridade === 'alta' 
                          ? 'bg-red-100 dark:bg-red-900/20' 
                          : alert.prioridade === 'media'
                            ? 'bg-yellow-100 dark:bg-yellow-900/20'
                            : 'bg-green-100 dark:bg-green-900/20'
                      }`}>
                        <AlertTriangle className={`w-5 h-5 ${
                          alert.prioridade === 'alta'
                            ? 'text-red-600 dark:text-red-400'
                            : alert.prioridade === 'media'
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-green-600 dark:text-green-400'
                        }`} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          <span className="uppercase">{alert.veiculo.placa}</span> - {alert.veiculo.marca} {alert.veiculo.tipo}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityStyle(alert.prioridade)}`}>
                            Prioridade {alert.prioridade.charAt(0).toUpperCase() + alert.prioridade.slice(1)}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            alert.tipo === 'preventiva'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200'
                          }`}>
                            Manutenção {alert.tipo.charAt(0).toUpperCase() + alert.tipo.slice(1)}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {alert.componentes.length} {alert.componentes.length === 1 ? 'problema' : 'problemas'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {expandedAlert?.id === alert.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Alert Details */}
                {expandedAlert?.id === alert.id && (
                  <div className="px-4 pb-4 space-y-6 border-t border-gray-200 dark:border-gray-700">
                    {/* Components Analysis */}
                    <div className="pt-4">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                        <Tool className="w-4 h-4" />
                        Itens com Problema
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {alert.componentes.map((componente, index) => (
                          <div key={index} className="bg-white dark:bg-[#1f2937] rounded-lg p-4 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {componente.item}
                                </span>
                              </div>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(componente.status_id)}`}>
                                {componente.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Checklist {componente.tipo_checklist}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatDate(componente.data_checklist)}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {componente.motorista.nome}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Tool className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {componente.categoria}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status Indicators */}
                    <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Manutenção Necessária
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Atenção Requerida
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistManutencao;