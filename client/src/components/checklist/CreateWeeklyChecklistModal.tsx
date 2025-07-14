import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Motorista, Veiculo } from '../../types/database';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

interface CreateWeeklyChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateWeeklyChecklistModal = ({ isOpen, onClose, onSuccess }: CreateWeeklyChecklistModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [statusItems, setStatusItems] = useState<{ status_id: number; status: string }[]>([]);
  const { companyId } = useAuth();
  
  // Initialize with empty form data
  const emptyFormData = {
    motorista_id: '',
    veiculo_id: '',
    quilometragem: '',
    observacoes: '',
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().split(' ')[0].slice(0, 5),
    fluidos: {
      agua_radiador: 1,
      oleo_motor: 1,
      oleo_hidraulico: 1,
      fluido_freio: 1,
      liq_arrefecimento: 1,
      agua_parabrisa: 1
    },
    farol: {
      dianteiro: 1,
      auxiliar: 1,
      lanterna_traseira: 1,
      pisca_dianteiro: 1,
      pisca_traseiro: 1,
      luz_placa: 1,
      luz_indicador_painel: ''
    },
    componentes: {
      freio_estacionamento: 1,
      pedal: 1,
      limpeza_interna: 1
    },
    acessorios: {
      pneu: 1,
      pneu_ruim: '',
      documento_veicular: 1
    }
  };
  
  const [formData, setFormData] = useState(emptyFormData);

  // Reset form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      // Reset form data when modal is closed
      setFormData(emptyFormData);
    }
  }, [isOpen]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      // Always reset to empty form for new checklist
      setFormData(emptyFormData);
      
      fetchMotoristas();
      fetchVeiculos();
      fetchStatusItems();
    }
  }, [isOpen, companyId]);

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

  const fetchMotoristas = async () => {
    try {
      const { data, error } = await supabase
        .from('motorista')
        .select('*')
        .eq('st_cadastro', 'contratado')
        .eq('company_id', companyId)
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
        .eq('company_id', companyId)
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
        company_id: companyId,
        status: false // Default to false for new checklists
      };

      const { data: newChecklist, error: checklistError } = await supabase
        .from('checklist')
        .insert({ ...checklistData })
        .select()
        .single();

      if (checklistError) throw checklistError;
      
      const checklistId = newChecklist.checklist_id;

      // Insert acessorios
      const { error: acessoriosError } = await supabase
        .from('acessorios_veiculos')
        .insert({
          checklist_id: checklistId,
          pneu: formData.acessorios.pneu,
          pneu_ruim: formData.acessorios.pneu_ruim,
          documento_veicular: formData.acessorios.documento_veicular
        });

      if (acessoriosError) throw acessoriosError;

      // Insert componentes
      const { error: componentesError } = await supabase
        .from('componentes_gerais')
        .insert({
          checklist_id: checklistId,
          freio_estacionamento: formData.componentes.freio_estacionamento,
          pedal: formData.componentes.pedal,
          limpeza_interna: formData.componentes.limpeza_interna
        });

      if (componentesError) throw componentesError;

      // Insert farol
      const { error: farolError } = await supabase
        .from('farol_veiculo')
        .insert({
          checklist_id: checklistId,
          dianteiro: formData.farol.dianteiro,
          auxiliar: formData.farol.auxiliar,
          lanterna_traseira: formData.farol.lanterna_traseira,
          pisca_dianteiro: formData.farol.pisca_dianteiro,
          pisca_traseiro: formData.farol.pisca_traseiro,
          luz_placa: formData.farol.luz_placa,
          luz_indicador_painel: formData.farol.luz_indicador_painel
        });

      if (farolError) throw farolError;

      // Insert fluidos
      const { error: fluidosError } = await supabase
        .from('fluido_veiculo')
        .insert({
          checklist_id: checklistId,
          agua_radiador: formData.fluidos.agua_radiador,
          oleo_motor: formData.fluidos.oleo_motor,
          oleo_hidraulico: formData.fluidos.oleo_hidraulico,
          fluido_freio: formData.fluidos.fluido_freio,
          liq_arrefecimento: formData.fluidos.liq_arrefecimento,
          agua_parabrisa: formData.fluidos.agua_parabrisa
        });

      if (fluidosError) throw fluidosError;

      toast.success('Checklist criado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating checklist:', error);
      toast.error('Erro ao criar checklist');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-700 dark:text-gray-300">Carregando dados do checklist...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-md border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Novo Checklist Semanal
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
                        [key]: parseInt(e.target.value)
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {statusItems.map(item => (
                      <option key={item.status_id} value={item.status_id}>
                        {item.status}
                      </option>
                    ))}
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
                      value={value as string}
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
                      value={value as number}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        farol: {
                          ...prev.farol,
                          [key]: parseInt(e.target.value)
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {statusItems.map(item => (
                        <option key={item.status_id} value={item.status_id}>
                          {item.status}
                        </option>
                      ))}
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
                        [key]: parseInt(e.target.value)
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {statusItems.map(item => (
                      <option key={item.status_id} value={item.status_id}>
                        {item.status}
                      </option>
                    ))}
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
              {/* Only show pneu, pneu_ruim, documento_veicular for weekly checklist */}
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
                      pneu: parseInt(e.target.value)
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {statusItems.map(item => (
                    <option key={item.status_id} value={item.status_id}>
                      {item.status}
                    </option>
                  ))}
                </select>
              </div>
              
              {formData.acessorios.pneu === 2 && (
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
                      documento_veicular: parseInt(e.target.value)
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {statusItems.map(item => (
                    <option key={item.status_id} value={item.status_id}>
                      {item.status}
                    </option>
                  ))}
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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default CreateWeeklyChecklistModal;