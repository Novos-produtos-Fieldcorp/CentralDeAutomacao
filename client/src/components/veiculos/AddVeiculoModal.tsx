import React, { useState } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Motorista } from '../../types/database';
import { VEHICLE_TYPES } from '../../constants/vehicleTypes';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { consultarPlacaApi, validarPlaca, formatarPlaca } from '../../utils/placaService';

interface AddVeiculoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isEmpresa?: boolean;
  motoristas?: Motorista[];
}

const AddVeiculoModal = ({ isOpen, onClose, onSuccess, isEmpresa = false, motoristas = [] }: AddVeiculoModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [consultingPlaca, setConsultingPlaca] = useState(false);
  const { companyId } = useCurrentAccount();
  const [formData, setFormData] = useState({
    placa: '',
    marca: '',
    tipo: '',
    ano: '',
    cor: '',
    tipologia: '',
    combustivel: '',
    peso: '',
    cubagem: '',
    possui_rastreador: false,
    marca_rastreador: '',
    motorista_id: ''
  });

  const consultarPlacaLocal = async (placa: string) => {
    if (!placa || placa.length < 7) return;
    
    if (!validarPlaca(placa)) {
      toast.error('Formato de placa inválido');
      return;
    }

    setConsultingPlaca(true);
    try {
      const data = await consultarPlacaApi(placa);
      
      setFormData(prev => ({
        ...prev,
        placa: formatarPlaca(data.placa || prev.placa),
        marca: data.marca || prev.marca,
        tipo: data.modelo || prev.tipo,
        ano: data.ano || prev.ano,
        cor: data.cor || prev.cor,
        combustivel: data.combustivel || prev.combustivel
      }));
      
      toast.success('Dados da placa preenchidos!');
    } catch (error) {
      console.error('Erro ao consultar placa:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar placa');
    } finally {
      setConsultingPlaca(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);

      const placaFormatada = formData.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const { data: existingVehicle, error: checkError } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .eq('placa', placaFormatada)
        .eq('company_id', companyId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingVehicle) {
        toast.error(`Já existe um veículo cadastrado com a placa ${placaFormatada}`);
        setSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('veiculo')
        .insert({
          ...formData,
          placa: placaFormatada,
          motorista_id: formData.motorista_id ? Number(formData.motorista_id) : null,
          tipologia: formData.tipologia.toUpperCase(),
         status_veiculo: true,
         company_id: companyId
        });

      if (error) throw error;

      toast.success('Veículo cadastrado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao cadastrar veículo:', error);
      toast.error('Erro ao cadastrar veículo');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Adicionar Veículo {isEmpresa ? 'Próprio' : 'do Agregado'}
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
                Placa *
              </label>
              <div className="relative flex">
                <input
                  type="text"
                  name="placa"
                  value={formData.placa}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setFormData(prev => ({ ...prev, placa: value }));
                    
                    // Auto-consult when length is 7
                    if (value.length === 7 && validarPlaca(value)) {
                      consultarPlacaLocal(value);
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="ABC1234"
                  required
                  maxLength={7}
                />
                <button
                  type="button"
                  onClick={() => consultarPlacaLocal(formData.placa)}
                  disabled={consultingPlaca || !validarPlaca(formData.placa)}
                  className="px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg bg-gray-50 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Consultar dados da placa"
                >
                  {consultingPlaca ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Marca
              </label>
              <input
                type="text"
                name="marca"
                value={formData.marca}
                onChange={(e) => setFormData(prev => ({ ...prev, marca: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Modelo
              </label>
              <input
                type="text"
                name="tipo"
                value={formData.tipo}
                onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ano
              </label>
              <input
                type="text"
                name="ano"
                value={formData.ano}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 4) {
                    setFormData(prev => ({ ...prev, ano: value }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                maxLength={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cor
              </label>
              <input
                type="text"
                name="cor"
                value={formData.cor}
                onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipologia *
              </label>
              <select
                name="tipologia"
                value={formData.tipologia}
                onChange={(e) => setFormData(prev => ({ ...prev, tipologia: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              >
                <option value="">Selecione um tipo</option>
                {VEHICLE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Combustível
              </label>
              <input
                type="text"
                name="combustivel"
                value={formData.combustivel}
                onChange={(e) => setFormData(prev => ({ ...prev, combustivel: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Peso (kg)
              </label>
              <input
                type="text"
                name="peso"
                value={formData.peso}
                onChange={(e) => setFormData(prev => ({ ...prev, peso: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cubagem (m³)
              </label>
              <input
                type="text"
                name="cubagem"
                value={formData.cubagem}
                onChange={(e) => setFormData(prev => ({ ...prev, cubagem: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {!isEmpresa && (
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
            )}

            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <input
                  type="checkbox"
                  name="possui_rastreador"
                  checked={formData.possui_rastreador}
                  onChange={(e) => setFormData(prev => ({ ...prev, possui_rastreador: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Possui Rastreador</span>
              </label>
            </div>

            {formData.possui_rastreador && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Marca do Rastreador
                </label>
                <input
                  type="text"
                  name="marca_rastreador"
                  value={formData.marca_rastreador}
                  onChange={(e) => setFormData(prev => ({ ...prev, marca_rastreador: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            )}
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

export default AddVeiculoModal;