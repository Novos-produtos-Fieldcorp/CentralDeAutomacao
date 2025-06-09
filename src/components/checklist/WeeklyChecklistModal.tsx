import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Motorista, Veiculo, Checklist } from '../../types/database';
import toast from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

interface WeeklyChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  checklist?: Checklist | null;
}

const WeeklyChecklistModal = ({ isOpen, onClose, onSuccess, checklist }: WeeklyChecklistModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const { companyId } = useAuth();
  const [formData, setFormData] = useState({
    motorista_id: '',
    veiculo_id: '',
    quilometragem: '',
    observacoes: '',
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().split(' ')[0].slice(0, 5),
    fluidos: {
      agua_radiador: 'No nível',
      oleo_motor: 'No nível',
      oleo_hidraulico: 'No nível',
      fluido_freio: 'No nível',
      liq_arrefecimento: 'No nível',
      agua_parabrisa: 'No nível'
    },
    farol: {
      dianteiro: 'Funcionando',
      auxiliar: 'Funcionando',
      lanterna_traseira: 'Sim',
      // Remove luz_freio as it doesn't exist in the schema
      pisca_dianteiro: 'Funcionando',
      pisca_traseiro: 'Funcionando',
      luz_placa: 'Funcionando',
      luz_indicador_painel: ''
    },
    componentes: {
      freio: 'Bom',
      pedal: 'Bom',
      limpeza_interna: 'Boa'
    },
    acessorios: {
      pneu: 'Bom',
      pneu_ruim: '',
      documento_veicular: 'Sim',
      carrinho_carga: 'Sim'
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchMotoristas();
      fetchVeiculos();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchChecklistDetails = async () => {
      if (!checklist) return;

      try {
        setLoading(true);
        
        // First, fetch status items to get the correct status text mappings
        const { data: statusItems, error: statusError } = await supabase
          .from('status_item')
          .select('*')
          .order('status_id');
          
        if (statusError) throw statusError;
        
        // Now fetch the checklist details
        const { data, error } = await supabase
          .from('checklist')
          .select(`
            *,
            acessorios_veiculos!checklist_id(*),
            componentes_gerais!checklist_id(*),
            farol_veiculo!checklist_id(*),
            fluido_veiculo!checklist_id(*)
          `)
          .eq('checklist_id', checklist.checklist_id)
          .single();

        if (error) throw error;

        if (data) {
          // Map the database values to the form values based on the status_id
          // For fluids
          const fluidosData = {
            agua_radiador: 'No nível',
            oleo_motor: 'No nível',
            oleo_hidraulico: 'No nível',
            fluido_freio: 'No nível',
            liq_arrefecimento: 'No nível',
            agua_parabrisa: 'No nível'
          };
          
          if (data.fluido_veiculo?.[0]) {
            const fluidos = data.fluido_veiculo[0];
            Object.keys(fluidosData).forEach(key => {
              if (fluidos[key] === 1) {
                fluidosData[key] = 'No nível';
              } else if (fluidos[key] === 2) {
                fluidosData[key] = 'Abaixo do nível';
              } else if (fluidos[key] === 3) {
                fluidosData[key] = 'Acima do nível';
              }
            });
          }
          
          // For lights
          const farolData = {
            dianteiro: 'Funcionando',
            auxiliar: 'Funcionando',
            lanterna_traseira: 'Sim',
            pisca_dianteiro: 'Funcionando',
            pisca_traseiro: 'Funcionando',
            luz_placa: 'Funcionando',
            luz_indicador_painel: ''
          };
          
          if (data.farol_veiculo?.[0]) {
            const farol = data.farol_veiculo[0];
            Object.keys(farolData).forEach(key => {
              if (key === 'luz_indicador_painel') {
                farolData[key] = farol[key] || '';
                return;
              }
              
              if (key === 'lanterna_traseira') {
                if (farol[key] === 1) {
                  farolData[key] = 'Sim';
                } else if (farol[key] === 2) {
                  farolData[key] = 'Não';
                }
              } else {
                if (farol[key] === 1) {
                  farolData[key] = 'Funcionando';
                } else if (farol[key] === 2) {
                  farolData[key] = 'Queimado';
                }
              }
            });
          }
          
          // For components
          const componentesData = {
            freio: 'Bom',
            pedal: 'Bom',
            limpeza_interna: 'Boa'
          };
          
          if (data.componentes_gerais?.[0]) {
            const componentes = data.componentes_gerais[0];
            
            // Map freio_estacionamento to freio
            if (componentes.freio_estacionamento === 1) {
              componentesData.freio = 'Bom';
            } else if (componentes.freio_estacionamento === 2) {
              componentesData.freio = 'Ruim';
            }
            
            // Map pedal
            if (componentes.pedal === 1) {
              componentesData.pedal = 'Bom';
            } else if (componentes.pedal === 2) {
              componentesData.pedal = 'Ruim';
            }
            
            // Map limpeza_interna
            if (componentes.limpeza_interna === 1) {
              componentesData.limpeza_interna = 'Boa';
            } else if (componentes.limpeza_interna === 2) {
              componentesData.limpeza_interna = 'Ruim';
            }
          }
          
          // For accessories
          const acessoriosData = {
            pneu: 'Bom',
            pneu_ruim: '',
            documento_veicular: 'Sim',
            carrinho_carga: 'Sim'
          };
          
          if (data.acessorios_veiculos?.[0]) {
            const acessorios = data.acessorios_veiculos[0];
            
            // Map pneu
            if (acessorios.pneu === 1) {
              acessoriosData.pneu = 'Bom';
            } else if (acessorios.pneu === 2) {
              acessoriosData.pneu = 'Ruim';
            }
            
            // Get pneu_ruim text
            acessoriosData.pneu_ruim = acessorios.pneu_ruim || '';
            
            // Map documento_veicular
            if (acessorios.documento_veicular === 1) {
              acessoriosData.documento_veicular = 'Sim';
            } else if (acessorios.documento_veicular === 2) {
              acessoriosData.documento_veicular = 'Não';
            }
            
            // Map carrinho_carga
            if (acessorios.carrinho_carga === 1) {
              acessoriosData.carrinho_carga = 'Sim';
            } else if (acessorios.carrinho_carga === 2) {
              acessoriosData.carrinho_carga = 'Não';
            }
          }
          
          // Update form data with all the mapped values
          setFormData(prev => ({
            ...prev,
            motorista_id: data.motorista_id?.toString() || '',
            veiculo_id: data.veiculo_id?.toString() || '',
            quilometragem: data.quilometragem?.toString() || '',
            observacoes: data.observacoes || '',
            data: data.data || new Date().toISOString().split('T')[0],
            hora: data.hora || new Date().toTimeString().split(' ')[0].slice(0, 5),
            fluidos: fluidosData,
            farol: farolData,
            componentes: componentesData,
            acessorios: acessoriosData
          }));
        }
      } catch (error) {
        console.error('Error fetching checklist details:', error);
        toast.error('Erro ao carregar dados do checklist');
      } finally {
        setLoading(false);
      }
    };

    if (checklist) {
      fetchChecklistDetails();
    }
  }, [checklist]);

  const fetchMotoristas = async () => {
    try {
      const { data, error } = await supabase
        .from('motorista')
        .select('*')
        .eq('st_cadastro', 'contratado')
        .order('nome');

      if (error) throw error;
      setMotoristas(data || []);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    }
  };

  const fetchVeiculos = async () => {
    try {
      const { data, error } = await supabase
        .from('veiculo')
        .select('*')
        .eq('status_veiculo', true)
        .order('placa');

      if (error) throw error;
      setVeiculos(data || []);
    } catch (error) {
      console.error('Error fetching veiculos:', error);
      toast.error('Erro ao carregar veículos');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);

      // Validate required fields
      if (!formData.motorista_id || !formData.veiculo_id || !formData.quilometragem) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      const checklistData = {
        data: formData.data,
        hora: formData.hora,
        quilometragem: parseFloat(formData.quilometragem),
        observacoes: formData.observacoes,
        id_tipo_checklist: 2, // Weekly
        motorista_id: parseInt(formData.motorista_id),
        veiculo_id: parseInt(formData.veiculo_id),
        company_id: companyId
      };

      let checklistResponse;
      if (checklist) {
        checklistResponse = await supabase
          .from('checklist')
          .update(checklistData)
          .eq('checklist_id', checklist.checklist_id)
          .select()
          .single();
      } else {
        checklistResponse = await supabase
          .from('checklist')
          .insert({ ...checklistData })
          .select()
          .single();
      }

      const { data: newChecklist, error: checklistError } = checklistResponse;

      if (checklistError) throw checklistError;
      
      const checklistId = checklist ? checklist.checklist_id : newChecklist.checklist_id;

      // Find status IDs based on the form values
      const getStatusId = (value: string, type: string) => {
        // Default mappings
        if (type === 'fluid') {
          if (value === 'No nível') return 1;
          if (value === 'Abaixo do nível') return 2;
          if (value === 'Acima do nível') return 3;
          return 1;
        }
        
        if (type === 'light') {
          if (value === 'Funcionando') return 1;
          if (value === 'Queimado') return 2;
          return 1;
        }
        
        if (type === 'lanterna') {
          if (value === 'Sim') return 1;
          if (value === 'Não') return 2;
          return 1;
        }
        
        if (type === 'component') {
          if (value === 'Bom' || value === 'Boa') return 1;
          if (value === 'Ruim') return 2;
          return 1;
        }
        
        if (type === 'accessory') {
          if (value === 'Sim') return 1;
          if (value === 'Não') return 2;
          return 1;
        }
        
        // For pneu
        if (value === 'Bom') return 1;
        if (value === 'Ruim') return 2;
        
        // Default to OK if no match
        return 1;
      };

      // Insert acessorios
      if (checklist) {
        await supabase
          .from('acessorios_veiculos')
          .delete()
          .eq('checklist_id', checklistId);
      }

      const { error: acessoriosError } = await supabase
        .from('acessorios_veiculos')
        .insert({
          checklist_id: checklistId,
          pneu: getStatusId(formData.acessorios.pneu, 'pneu'),
          pneu_ruim: formData.acessorios.pneu_ruim,
          documento_veicular: getStatusId(formData.acessorios.documento_veicular, 'accessory'),
          carrinho_carga: getStatusId(formData.acessorios.carrinho_carga, 'accessory')
        });

      if (acessoriosError) throw acessoriosError;

      // Insert componentes
      if (checklist) {
        await supabase
          .from('componentes_gerais')
          .delete()
          .eq('checklist_id', checklistId);
      }

      const { error: componentesError } = await supabase
        .from('componentes_gerais')
        .insert({
          checklist_id: checklistId,
          freio_estacionamento: getStatusId(formData.componentes.freio, 'component'),
          pedal: getStatusId(formData.componentes.pedal, 'component'),
          limpeza_interna: getStatusId(formData.componentes.limpeza_interna, 'component')
        });

      if (componentesError) throw componentesError;

      // Insert farol
      if (checklist) {
        await supabase
          .from('farol_veiculo')
          .delete()
          .eq('checklist_id', checklistId);
      }

      const { error: farolError } = await supabase
        .from('farol_veiculo')
        .insert({
          checklist_id: checklistId,
          dianteiro: getStatusId(formData.farol.dianteiro, 'light'),
          auxiliar: getStatusId(formData.farol.auxiliar, 'light'),
          lanterna_traseira: getStatusId(formData.farol.lanterna_traseira, 'lanterna'),
          pisca_dianteiro: getStatusId(formData.farol.pisca_dianteiro, 'light'),
          pisca_traseiro: getStatusId(formData.farol.pisca_traseiro, 'light'),
          luz_placa: getStatusId(formData.farol.luz_placa, 'light'),
          luz_indicador_painel: formData.farol.luz_indicador_painel
        });

      if (farolError) throw farolError;

      // Insert fluidos
      if (checklist) {
        await supabase
          .from('fluido_veiculo')
          .delete()
          .eq('checklist_id', checklistId);
      }

      const { error: fluidosError } = await supabase
        .from('fluido_veiculo')
        .insert({
          checklist_id: checklistId,
          agua_radiador: getStatusId(formData.fluidos.agua_radiador, 'fluid'),
          oleo_motor: getStatusId(formData.fluidos.oleo_motor, 'fluid'),
          oleo_hidraulico: getStatusId(formData.fluidos.oleo_hidraulico, 'fluid'),
          fluido_freio: getStatusId(formData.fluidos.fluido_freio, 'fluid'),
          liq_arrefecimento: getStatusId(formData.fluidos.liq_arrefecimento, 'fluid'),
          agua_parabrisa: getStatusId(formData.fluidos.agua_parabrisa, 'fluid')
        });

      if (fluidosError) throw fluidosError;

      toast.success(checklist ? 'Checklist atualizado com sucesso' : 'Checklist criado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating checklist:', error);
      toast.error(checklist ? 'Erro ao atualizar checklist' : 'Erro ao criar checklist');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-md border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {checklist ? 'Editar' : 'Novo'} Checklist Semanal
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Informações Básicas
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motorista *
                </label>
                <select
                  name="motorista_id"
                  value={formData.motorista_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, motorista_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">Selecione um motorista</option>
                  {motoristas.map(motorista => (
                    <option key={motorista.motorista_id} value={motorista.motorista_id}>
                      {motorista.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Veículo *
                </label>
                <select
                  name="veiculo_id"
                  value={formData.veiculo_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, veiculo_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">Selecione um veículo</option>
                  {veiculos.map(veiculo => (
                    <option key={veiculo.veiculo_id} value={veiculo.veiculo_id}>
                      {veiculo.placa} - {veiculo.marca} {veiculo.tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data *
                </label>
                <input
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora *
                </label>
                <input
                  type="time"
                  name="hora"
                  value={formData.hora}
                  onChange={(e) => setFormData(prev => ({ ...prev, hora: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quilometragem *
                </label>
                <input
                  type="number"
                  name="quilometragem"
                  value={formData.quilometragem}
                  onChange={(e) => setFormData(prev => ({ ...prev, quilometragem: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  step="0.1"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Fluids Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Níveis de Fluidos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(formData.fluidos).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                  <select
                    value={value}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      fluidos: {
                        ...prev.fluidos,
                        [key]: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="No nível">No nível</option>
                    <option value="Abaixo do nível">Abaixo do nível</option>
                    <option value="Acima do nível">Acima do nível</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Lights Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Sistema de Iluminação
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(formData.farol).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                  {key === 'luz_indicador_painel' ? (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        farol: {
                          ...prev.farol,
                          [key]: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Descreva o problema (se houver)"
                    />
                  ) : (
                    <select
                      value={value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        farol: {
                          ...prev.farol,
                          [key]: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {key === 'lanterna_traseira' ? (
                        <>
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </>
                      ) : (
                        <>
                          <option value="Funcionando">Funcionando</option>
                          <option value="Queimado">Queimado</option>
                        </>
                      )}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Components Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Componentes
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(formData.componentes).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                  <select
                    value={value}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      componentes: {
                        ...prev.componentes,
                        [key]: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {key === 'limpeza_interna' ? (
                      <>
                        <option value="Boa">Boa</option>
                        <option value="Ruim">Ruim</option>
                      </>
                    ) : (
                      <>
                        <option value="Bom">Bom</option>
                        <option value="Ruim">Ruim</option>
                      </>
                    )}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Accessories Section - Only specific items for weekly checklist */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Acessórios
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Only show pneu, pneu_ruim, documento_veicular, and carrinho_carga for weekly checklist */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pneu
                </label>
                <select
                  value={formData.acessorios.pneu}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    acessorios: {
                      ...prev.acessorios,
                      pneu: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="Bom">Bom</option>
                  <option value="Ruim">Ruim</option>
                </select>
              </div>
              
              {formData.acessorios.pneu === 'Ruim' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pneu com Problema
                  </label>
                  <input
                    type="text"
                    value={formData.acessorios.pneu_ruim}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      acessorios: {
                        ...prev.acessorios,
                        pneu_ruim: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Descreva o problema"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Documento Veicular
                </label>
                <select
                  value={formData.acessorios.documento_veicular}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    acessorios: {
                      ...prev.acessorios,
                      documento_veicular: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Carrinho Carga
                </label>
                <select
                  value={formData.acessorios.carrinho_carga}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    acessorios: {
                      ...prev.acessorios,
                      carrinho_carga: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
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

export default WeeklyChecklistModal;