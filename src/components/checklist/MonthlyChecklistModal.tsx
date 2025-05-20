import React, { useState, useEffect } from 'react';
import { X, Loader2, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Motorista, Veiculo, Checklist } from '../../types/database';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

interface MonthlyChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  checklist?: Checklist | null;
}

const MonthlyChecklistModal = ({ isOpen, onClose, onSuccess, checklist }: MonthlyChecklistModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const { companyId } = useAuth();
  
  const [formData, setFormData] = useState({
    motorista_id: '',
    veiculo_id: '',
    quilometragem: '',
    observacoes: '',
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().split(' ')[0].slice(0, 5),
    fotos: {
      foto_hodometro: '',
      foto_oleo: '',
      foto_bateria: '',
      foto_carrinho_carga: '',
      foto_dianteira: '',
      foto_traseira: '',
      foto_lateral_direita: '',
      foto_lateral_esquerda: ''
    },
    acessorios: {
      pneu: 1,
      estepe: 1,
      macaco: 1,
      extintor: 1,
      cartao_combustivel: 1,
      cadeado: 1,
      chave_reserva: 1,
      carrinho_carga: 1,
      documento_veicular: 1,
      manual_veiculo: 1,
      triangulo: 1,
      chave_roda: 1
    },
    componentes: {
      buzina: 1,
      ar_condicionado: 1,
      freio_estacionamento: 1,
      pedal: 1,
      retrovisor: 1,
      parabrisa_dianteiro: 1,
      limpador_parabrisa: 1,
      vidros_laterais: 1,
      bateria: 1,
      banco: 1,
      forro_interno: 1,
      tampa_tanque: 1,
      estrutura_bau: 1,
      fechadura_porta: 1,
      limpeza_interna: 1,
      limpeza_externa: 1,
      sistema_freio: 1,
      tapete: 1,
      cinto_seguranca: 1
    },
    farol: {
      dianteiro: 1,
      auxiliar: 1,
      pisca_dianteiro: 1,
      pisca_traseiro: 1,
      lanterna_traseira: 1,
      luz_placa: 1,
      luz_indicador_painel: ''
    },
    fluidos: {
      agua_radiador: 1,
      oleo_motor: 1,
      oleo_hidraulico: 1,
      fluido_freio: 1,
      liq_arrefecimento: 1,
      agua_parabrisa: 1
    }
  });

  useEffect(() => {
    if (checklist) {
      setFormData(prev => ({
        ...prev,
        motorista_id: checklist.motorista_id?.toString() || '',
        veiculo_id: checklist.veiculo_id?.toString() || '',
        quilometragem: checklist.quilometragem?.toString() || '',
        observacoes: checklist.observacoes || '',
        data: checklist.data || new Date().toISOString().split('T')[0],
        hora: checklist.hora || new Date().toTimeString().split(' ')[0].slice(0, 5)
      }));
    }
  }, [checklist]);

  useEffect(() => {
    if (isOpen) {
      fetchMotoristas();
      fetchVeiculos();
      
      // If editing a checklist, also fetch its photos
      if (checklist) {
        fetchChecklistPhotos(checklist.checklist_id);
        fetchChecklistDetails(checklist.checklist_id);
      }
    }
  }, [isOpen, checklist]);

  const fetchChecklistDetails = async (checklistId: number) => {
    try {
      setLoading(true);
      
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
        .eq('checklist_id', checklistId)
        .single();

      if (error) throw error;

      if (data) {
        // Update form data with the fetched details
        setFormData(prev => ({
          ...prev,
          acessorios: {
            pneu: data.acessorios_veiculos?.[0]?.pneu || 1,
            estepe: data.acessorios_veiculos?.[0]?.estepe || 1,
            macaco: data.acessorios_veiculos?.[0]?.macaco || 1,
            extintor: data.acessorios_veiculos?.[0]?.extintor || 1,
            cartao_combustivel: data.acessorios_veiculos?.[0]?.cartao_combustivel || 1,
            cadeado: data.acessorios_veiculos?.[0]?.cadeado || 1,
            chave_reserva: data.acessorios_veiculos?.[0]?.chave_reserva || 1,
            carrinho_carga: data.acessorios_veiculos?.[0]?.carrinho_carga || 1,
            documento_veicular: data.acessorios_veiculos?.[0]?.documento_veicular || 1,
            manual_veiculo: data.acessorios_veiculos?.[0]?.manual_veiculo || 1,
            triangulo: data.acessorios_veiculos?.[0]?.triangulo || 1,
            chave_roda: data.acessorios_veiculos?.[0]?.chave_roda || 1
          },
          componentes: {
            buzina: data.componentes_gerais?.[0]?.buzina || 1,
            ar_condicionado: data.componentes_gerais?.[0]?.ar_condicionado || 1,
            freio_estacionamento: data.componentes_gerais?.[0]?.freio_estacionamento || 1,
            pedal: data.componentes_gerais?.[0]?.pedal || 1,
            retrovisor: data.componentes_gerais?.[0]?.retrovisor || 1,
            parabrisa_dianteiro: data.componentes_gerais?.[0]?.parabrisa_dianteiro || 1,
            limpador_parabrisa: data.componentes_gerais?.[0]?.limpador_parabrisa || 1,
            vidros_laterais: data.componentes_gerais?.[0]?.vidros_laterais || 1,
            bateria: data.componentes_gerais?.[0]?.bateria || 1,
            banco: data.componentes_gerais?.[0]?.banco || 1,
            forro_interno: data.componentes_gerais?.[0]?.forro_interno || 1,
            tampa_tanque: data.componentes_gerais?.[0]?.tampa_tanque || 1,
            estrutura_bau: data.componentes_gerais?.[0]?.estrutura_bau || 1,
            fechadura_porta: data.componentes_gerais?.[0]?.fechadura_porta || 1,
            limpeza_interna: data.componentes_gerais?.[0]?.limpeza_interna || 1,
            limpeza_externa: data.componentes_gerais?.[0]?.limpeza_externa || 1,
            sistema_freio: data.componentes_gerais?.[0]?.sistema_freio || 1,
            tapete: data.componentes_gerais?.[0]?.tapete || 1,
            cinto_seguranca: data.componentes_gerais?.[0]?.cinto_seguranca || 1
          },
          farol: {
            dianteiro: data.farol_veiculo?.[0]?.dianteiro || 1,
            auxiliar: data.farol_veiculo?.[0]?.auxiliar || 1,
            pisca_dianteiro: data.farol_veiculo?.[0]?.pisca_dianteiro || 1,
            pisca_traseiro: data.farol_veiculo?.[0]?.pisca_traseiro || 1,
            lanterna_traseira: data.farol_veiculo?.[0]?.lanterna_traseira || 1,
            luz_placa: data.farol_veiculo?.[0]?.luz_placa || 1,
            luz_indicador_painel: data.farol_veiculo?.[0]?.luz_indicador_painel || ''
          },
          fluidos: {
            agua_radiador: data.fluido_veiculo?.[0]?.agua_radiador || 1,
            oleo_motor: data.fluido_veiculo?.[0]?.oleo_motor || 1,
            oleo_hidraulico: data.fluido_veiculo?.[0]?.oleo_hidraulico || 1,
            fluido_freio: data.fluido_veiculo?.[0]?.fluido_freio || 1,
            liq_arrefecimento: data.fluido_veiculo?.[0]?.liq_arrefecimento || 1,
            agua_parabrisa: data.fluido_veiculo?.[0]?.agua_parabrisa || 1
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching checklist details:', error);
      toast.error('Erro ao carregar dados do checklist');
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklistPhotos = async (checklistId: number) => {
    try {
      const { data, error } = await supabase
        .from('foto_checklist')
        .select('*')
        .eq('checklist_id', checklistId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setFormData(prev => ({
          ...prev,
          fotos: {
            foto_hodometro: data.foto_hodometro || '',
            foto_oleo: data.foto_oleo || '',
            foto_bateria: data.foto_bateria || '',
            foto_carrinho_carga: data.foto_carrinho_carga || '',
            foto_dianteira: data.foto_dianteira || '',
            foto_traseira: data.foto_traseira || '',
            foto_lateral_direita: data.foto_lateral_direita || '',
            foto_lateral_esquerda: data.foto_lateral_esquerda || ''
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching checklist photos:', error);
      toast.error('Erro ao carregar fotos do checklist');
    }
  };

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof formData.fotos) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('checklist-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('checklist-photos')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        fotos: {
          ...prev.fotos,
          [field]: publicUrl
        }
      }));

      toast.success('Foto enviada com sucesso');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Erro ao enviar foto');
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
        id_tipo_checklist: 1, // Monthly
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

      // Insert fotos
      if (Object.values(formData.fotos).some(foto => foto)) {
        if (checklist) {
          await supabase
            .from('foto_checklist')
            .delete()
            .eq('checklist_id', checklistId);
        }

        const { error: fotosError } = await supabase
          .from('foto_checklist')
          .insert({
            checklist_id: checklistId,
            foto_hodometro: formData.fotos.foto_hodometro,
            foto_oleo: formData.fotos.foto_oleo,
            foto_bateria: formData.fotos.foto_bateria,
            foto_carrinho_carga: formData.fotos.foto_carrinho_carga,
            foto_dianteira: formData.fotos.foto_dianteira,
            foto_traseira: formData.fotos.foto_traseira,
            foto_lateral_direita: formData.fotos.foto_lateral_direita,
            foto_lateral_esquerda: formData.fotos.foto_lateral_esquerda
          });

        if (fotosError) throw fotosError;
      }

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
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {checklist ? 'Editar' : 'Novo'} Checklist Mensal
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8">
              {[1, 2, 3].map((step, index) => (
                <React.Fragment key={step}>
                  <div 
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 
                              ${currentStep >= step 
                                ? 'border-blue-600 bg-blue-600 text-white' 
                                : 'border-gray-300 dark:border-gray-600'}`}
                  >
                    {step}
                  </div>
                  {index < 2 && (
                    <div className={`flex-1 h-1 mx-4 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step Content */}
            {currentStep === 1 && (
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
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  Fotos do Veículo
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(formData.fotos).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {key.replace(/foto_/g, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                          <Camera className="w-5 h-5" />
                          <span>Adicionar Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handlePhotoUpload(e, key as keyof typeof formData.fotos)}
                            className="hidden"
                          />
                        </label>
                        {value && (
                          <img
                            src={value}
                            alt={key}
                            className="w-16 h-16 object-cover rounded-lg shadow-md"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  Estado dos Componentes
                </h3>
                
                {/* Acessórios */}
                <div className="space-y-4">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">Acessórios</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(formData.acessorios).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                        <select
                          value={value}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            acessorios: {
                              ...prev.acessorios,
                              [key]: parseInt(e.target.value)
                            }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value={1}>OK</option>
                          <option value={2}>Não OK</option>
                          <option value={3}>N/A</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Componentes */}
                <div className="space-y-4">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">Componentes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          <option value={1}>OK</option>
                          <option value={2}>Não OK</option>
                          <option value={3}>N/A</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Faróis */}
                <div className="space-y-4">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">Faróis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <option value={1}>OK</option>
                            <option value={2}>Não OK</option>
                            <option value={3}>N/A</option>
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fluidos */}
                <div className="space-y-4">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">Fluidos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          <option value={1}>OK</option>
                          <option value={2}>Não OK</option>
                          <option value={3}>N/A</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Voltar
              </button>
            )}
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!formData.motorista_id || !formData.veiculo_id || !formData.quilometragem || !formData.data || !formData.hora}
              >
                Próximo
              </button>
            ) : (
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default MonthlyChecklistModal;