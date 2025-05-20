import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Hodometro, Motorista, Veiculo } from '../../types/database';
import toast from 'react-hot-toast';

interface EditHodometroModalProps {
  isOpen: boolean;
  onClose: () => void;
  hodometro: Hodometro | null;
  onUpdate: () => void;
}

const EditHodometroModal = ({ isOpen, onClose, hodometro, onUpdate }: EditHodometroModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [formData, setFormData] = useState({
    data: '',
    hora: '',
    hod_informado: '',
    hod_lido: '',
    trip_lida: '',
    trip_informada: '',
    km_rodado: '',
    bateria: '',
    verificacao: false,
    comparacao_leitura: false,
    motorista_id: '',
    veiculo_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchMotoristas();
      fetchVeiculos();
    }
  }, [isOpen]);

  useEffect(() => {
    if (hodometro) {
      setFormData({
        data: hodometro.data,
        hora: hodometro.hora,
        hod_informado: hodometro.hod_informado?.toString() || '',
        hod_lido: hodometro.hod_lido?.toString() || '',
        trip_lida: hodometro.trip_lida?.toString() || '',
        trip_informada: hodometro.trip_informada?.toString() || '',
        km_rodado: hodometro.km_rodado?.toString() || '',
        bateria: hodometro.bateria?.toString() || '',
        verificacao: hodometro.verificacao || false,
        comparacao_leitura: hodometro.comparacao_leitura || false,
        motorista_id: hodometro.motorista_id?.toString() || '',
        veiculo_id: hodometro.veiculo_id?.toString() || ''
      });
    }
  }, [hodometro]);

  const fetchMotoristas = async () => {
    try {
      const { data, error } = await supabase
        .from('motorista')
        .select('*')
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
    
    if (!hodometro) return;

    try {
      setSubmitting(true);

      const updateData: any = {
        data: formData.data,
        hora: formData.hora,
        verificacao: formData.verificacao,
        comparacao_leitura: formData.comparacao_leitura,
        motorista_id: parseInt(formData.motorista_id),
        veiculo_id: parseInt(formData.veiculo_id),
        trip_lida: formData.trip_lida ? parseFloat(formData.trip_lida) : null,
        trip_informada: formData.trip_informada || null,
        km_rodado: parseFloat(formData.km_rodado)
      };

      // Handle electric vehicles (with battery) vs regular vehicles
      if (formData.bateria) {
        updateData.bateria = parseInt(formData.bateria);
      } else {
        updateData.hod_informado = parseFloat(formData.hod_informado);
        updateData.hod_lido = parseFloat(formData.hod_lido);
      }

      const { error } = await supabase
        .from('hodometro')
        .update(updateData)
        .eq('id_hodometro', hodometro.id_hodometro);

      if (error) throw error;

      toast.success('Leitura atualizada com sucesso');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating hodometro:', error);
      toast.error('Erro ao atualizar leitura');
    } finally {
      setSubmitting(false);
    }
  };

  const isElectricVehicle = formData.bateria !== '';

  if (!isOpen || !hodometro) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-md border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Editar Leitura
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                    {motorista.nome} - {motorista.cpf}
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
                Tipo de Veículo
              </label>
              <select
                value={isElectricVehicle ? "electric" : "regular"}
                onChange={(e) => {
                  const isElectric = e.target.value === "electric";
                  setFormData(prev => ({
                    ...prev,
                    bateria: isElectric ? '100' : '',
                    hod_informado: isElectric ? '' : prev.hod_informado,
                    hod_lido: isElectric ? '' : prev.hod_lido
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="regular">Veículo Regular</option>
                <option value="electric">Ciclomotor Elétrico</option>
              </select>
            </div>

            {isElectricVehicle ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bateria (%) *
                </label>
                <input
                  type="number"
                  name="bateria"
                  value={formData.bateria}
                  onChange={(e) => setFormData(prev => ({ ...prev, bateria: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required={isElectricVehicle}
                  min="0"
                  max="100"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hodômetro Informado *
                  </label>
                  <input
                    type="number"
                    name="hod_informado"
                    value={formData.hod_informado}
                    onChange={(e) => setFormData(prev => ({ ...prev, hod_informado: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required={!isElectricVehicle}
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hodômetro Lido *
                  </label>
                  <input
                    type="number"
                    name="hod_lido"
                    value={formData.hod_lido}
                    onChange={(e) => setFormData(prev => ({ ...prev, hod_lido: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required={!isElectricVehicle}
                    step="0.1"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trip Informada
              </label>
              <input
                type="text"
                name="trip_informada"
                value={formData.trip_informada}
                onChange={(e) => setFormData(prev => ({ ...prev, trip_informada: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trip Lida
              </label>
              <input
                type="number"
                name="trip_lida"
                value={formData.trip_lida}
                onChange={(e) => setFormData(prev => ({ ...prev, trip_lida: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {isElectricVehicle ? 'Autonomia (km) *' : 'KM Rodado *'}
              </label>
              <input
                type="number"
                name="km_rodado"
                value={formData.km_rodado}
                onChange={(e) => setFormData(prev => ({ ...prev, km_rodado: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
                step="0.1"
              />
            </div>

            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  name="verificacao"
                  checked={formData.verificacao}
                  onChange={(e) => setFormData(prev => ({ ...prev, verificacao: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Verificado</span>
              </label>
            </div>

            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  name="comparacao_leitura"
                  checked={formData.comparacao_leitura}
                  onChange={(e) => setFormData(prev => ({ ...prev, comparacao_leitura: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Leitura OK</span>
              </label>
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

export default EditHodometroModal;