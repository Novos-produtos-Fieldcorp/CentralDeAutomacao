import React, { useState, useEffect } from 'react';
import { X, Loader2, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Motorista, Veiculo } from '../../types/database';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';

const FIELD_LABELS: Record<string, string> = {
  cartao_combustivel: 'Cartão de Combustível',
  carrinho_carga: 'Carrinho de Carga',
  chave_roda: 'Chave de Roda',
  cinto_seguranca: 'Cinto de Segurança',
  documento_veicular: 'Documento Veicular',
  FarolAlto: 'Farol Alto',
  fluido_freio: 'Fluído de Freio',
  freio_estacionamento: 'Freio de Estacionamento',
  lanterna_traseira: 'Lanterna Traseira',
  liq_arrefecimento: 'Líquido de Arrefecimento',
  limpador_parabrisa: 'Limpador do Para-brisa',
  luz_indicador_painel: 'Luz Indicadora do Painel',
  luz_placa: 'Luz da Placa',
  LuzFreio: 'Luz de Freio',
  LuzNeblina: 'Luz de Neblina (Farol de Milha)',
  LuzRe: 'Luz de Ré',
  manual_veiculo: 'Manual do Veículo',
  oleo_hidraulico: 'Óleo Hidráulico',
  oleo_motor: 'Óleo do Motor',
  parabrisa_dianteiro: 'Para-brisa Dianteiro',
  pisca_dianteiro: 'Pisca Dianteiro',
  pisca_traseiro: 'Pisca Traseiro',
  sistema_freio: 'Sistema de Freio',
  tampa_tanque: 'Tampa do Tanque',
  vidros_laterais: 'Vidros Laterais'
};

const PHOTO_SECTIONS = [
  {
    title: 'Identificação e inspeção',
    fields: [
      { key: 'foto_hodometro', label: 'Hodômetro' },
      { key: 'foto_oleo', label: 'Óleo' },
      { key: 'foto_bateria', label: 'Bateria' }
    ]
  },
  {
    title: 'Vista externa do veículo',
    fields: [
      { key: 'foto_dianteira', label: 'Dianteira' },
      { key: 'foto_traseira', label: 'Traseira' },
      { key: 'foto_lateral_direita', label: 'Lateral Direita' },
      { key: 'foto_lateral_esquerda', label: 'Lateral Esquerda' }
    ]
  },
  {
    title: 'Acessórios fotografados',
    fields: [
      { key: 'foto_carrinho_carga', label: 'Carrinho de Carga' }
    ]
  },
  {
    title: 'Fotos das avarias',
    description: 'Envie 3 fotos das avarias quando houver necessidade.',
    fields: [
      { key: 'foto_avaria', label: 'Avaria 1' },
      { key: 'foto_avaria2', label: 'Avaria 2' },
      { key: 'foto_avaria3', label: 'Avaria 3' }
    ]
  }
] as const;

const ESTEPE_STATUS_NAMES = new Set(['bom', 'meiavida', 'ruim', 'naopossui']);

const getFieldLabel = (key: string) => FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const normalizeStatusName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();

const getEstepeStatusOptions = (items: { status_id: number; status: string }[]) => {
  const filteredItems = items.filter(item => ESTEPE_STATUS_NAMES.has(normalizeStatusName(item.status)));
  return filteredItems.length > 0 ? filteredItems : items;
};

const getPhotoGridClassName = (title: string) => {
  if (title === 'Fotos das avarias') return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5';
  return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5';
};

interface CreateMonthlyChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateMonthlyChecklistModal = ({ isOpen, onClose, onSuccess }: CreateMonthlyChecklistModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [statusItems, setStatusItems] = useState<{ status_id: number; status: string }[]>([]);
  const { companyId } = useCurrentAccount();
  
  // Initialize with empty form data
  const emptyFormData = {
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
      foto_lateral_esquerda: '',
      foto_avaria: '',
      foto_avaria2: '',
      foto_avaria3: ''
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
    ComentarioBarulhoFreio: '',
    AvariaComentario: '',
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
      FarolAlto: 1,
      LuzFreio: 1,
      LuzRe: 1,
      LuzNeblina: 1,
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
  };
  
  const [formData, setFormData] = useState(emptyFormData);

  // Reset form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      // Reset form data when modal is closed
      setFormData(emptyFormData);
      setCurrentStep(1);
    }
  }, [isOpen]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      // Always reset to empty form for new checklist
      setFormData(emptyFormData);
      setCurrentStep(1);
      
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof formData.fotos) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('imagensdocs')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
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

  const handleRemovePhoto = (field: keyof typeof formData.fotos) => {
    setFormData(prev => ({
      ...prev,
      fotos: {
        ...prev.fotos,
        [field]: ''
      }
    }));
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
        ComentarioBarulhoFreio: formData.ComentarioBarulhoFreio,
        AvariaComentario: formData.AvariaComentario,
        id_tipo_checklist: 1, // Monthly
        motorista_id: parseInt(formData.motorista_id),
        veiculo_id: parseInt(formData.veiculo_id),
        status: true, // Default to true (active) for new checklists
        company_id: companyId
      };

      const { data: newChecklist, error: checklistError } = await supabase
        .from('checklist')
        .insert({ ...checklistData })
        .select()
        .single();

      if (checklistError) throw checklistError;
      
      const checklistId = newChecklist.checklist_id;

      // Insert fotos
      if (Object.values(formData.fotos).some(foto => foto)) {
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
            foto_lateral_esquerda: formData.fotos.foto_lateral_esquerda,
            foto_avaria: formData.fotos.foto_avaria,
            foto_avaria2: formData.fotos.foto_avaria2,
            foto_avaria3: formData.fotos.foto_avaria3
          });

        if (fotosError) throw fotosError;
      }

      // Insert acessorios
      const { error: acessoriosError } = await supabase
        .from('acessorios_veiculos')
        .insert({
          checklist_id: checklistId,
          pneu: formData.acessorios.pneu,
          estepe: formData.acessorios.estepe,
          macaco: formData.acessorios.macaco,
          extintor: formData.acessorios.extintor,
          cartao_combustivel: formData.acessorios.cartao_combustivel,
          cadeado: formData.acessorios.cadeado,
          chave_reserva: formData.acessorios.chave_reserva,
          carrinho_carga: formData.acessorios.carrinho_carga,
          documento_veicular: formData.acessorios.documento_veicular,
          manual_veiculo: formData.acessorios.manual_veiculo,
          triangulo: formData.acessorios.triangulo,
          chave_roda: formData.acessorios.chave_roda
        });

      if (acessoriosError) throw acessoriosError;

      // Insert componentes
      const { error: componentesError } = await supabase
        .from('componentes_gerais')
        .insert({
          checklist_id: checklistId,
          buzina: formData.componentes.buzina,
          ar_condicionado: formData.componentes.ar_condicionado,
          freio_estacionamento: formData.componentes.freio_estacionamento,
          pedal: formData.componentes.pedal,
          retrovisor: formData.componentes.retrovisor,
          parabrisa_dianteiro: formData.componentes.parabrisa_dianteiro,
          limpador_parabrisa: formData.componentes.limpador_parabrisa,
          vidros_laterais: formData.componentes.vidros_laterais,
          bateria: formData.componentes.bateria,
          banco: formData.componentes.banco,
          forro_interno: formData.componentes.forro_interno,
          tampa_tanque: formData.componentes.tampa_tanque,
          estrutura_bau: formData.componentes.estrutura_bau,
          fechadura_porta: formData.componentes.fechadura_porta,
          limpeza_interna: formData.componentes.limpeza_interna,
          limpeza_externa: formData.componentes.limpeza_externa,
          sistema_freio: formData.componentes.sistema_freio,
          tapete: formData.componentes.tapete,
          cinto_seguranca: formData.componentes.cinto_seguranca
        });

      if (componentesError) throw componentesError;

      // Insert farol
      const { error: farolError } = await supabase
        .from('farol_veiculo')
        .insert({
          checklist_id: checklistId,
          dianteiro: formData.farol.dianteiro,
          auxiliar: formData.farol.auxiliar,
          pisca_dianteiro: formData.farol.pisca_dianteiro,
          pisca_traseiro: formData.farol.pisca_traseiro,
          lanterna_traseira: formData.farol.lanterna_traseira,
          luz_placa: formData.farol.luz_placa,
          FarolAlto: formData.farol.FarolAlto,
          LuzFreio: formData.farol.LuzFreio,
          LuzRe: formData.farol.LuzRe,
          LuzNeblina: formData.farol.LuzNeblina,
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-6xl 2xl:max-w-7xl w-full max-h-[92vh] overflow-y-auto shadow-md border border-gray-200 dark:border-gray-700">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Novo Checklist Mensal
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Important: Only wrap the final step in the form element to prevent auto-submission */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-between gap-3 mb-2">
            {[1, 2, 3].map((step, index) => (
              <div key={step} className="flex items-center">
                <div 
                  className={`flex shrink-0 items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 text-sm font-medium
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
              </div>
            ))}
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-6">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Informações Básicas
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Preencha os dados principais e registre observações relevantes do veículo.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-5">
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

                <div className="md:col-span-2 xl:col-span-4">
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

                <div className="md:col-span-2 xl:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descreva comentário sobre barulho de freio se possui?
                  </label>
                  <textarea
                    value={formData.ComentarioBarulhoFreio}
                    onChange={(e) => setFormData(prev => ({ ...prev, ComentarioBarulhoFreio: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Descreva o barulho de freio (se houver)"
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Avarias, se sim, descreva quais
                  </label>
                  <textarea
                    value={formData.AvariaComentario}
                    onChange={(e) => setFormData(prev => ({ ...prev, AvariaComentario: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Descreva as avarias encontradas (se houver)"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-6">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Fotos do Veículo
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Organize as imagens por grupo para reduzir rolagem e facilitar conferência visual.
                </p>
              </div>
              <div className="space-y-8">
                  {PHOTO_SECTIONS.map(section => (
                    <div key={section.title}>
                      <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                        {section.title}
                      </h4>
                      {'description' in section && section.description ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{section.description}</p>
                      ) : null}
                      <div className={getPhotoGridClassName(section.title)}>
                        {section.fields.map(({ key, label }) => {
                          const value = formData.fotos[key as keyof typeof formData.fotos];

                          return (
                            <div key={key} className="space-y-2 min-w-0">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {label}
                              </label>
                              {value ? (
                                <div className="relative aspect-video w-full bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden group shadow-sm">
                                  <img src={value} alt={label} className="absolute inset-0 w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <button type="button" onClick={() => handleRemovePhoto(key as keyof typeof formData.fotos)} className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors">
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label htmlFor={`file-${key}`} className="flex min-h-[150px] items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700/40 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                                  <Camera className="w-5 h-5" />
                                  <span>Adicionar Foto</span>
                                  <input type="file" id={`file-${key}`} accept="image/*" onChange={(e) => handlePhotoUpload(e, key as keyof typeof formData.fotos)} className="hidden" />
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {currentStep === 3 && (
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Estado dos Componentes
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Distribua os status com menos rolagem e melhor leitura em telas largas.
                  </p>
                </div>
                
                {/* Acessórios */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-4">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">Acessórios</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {(['pneu','macaco','extintor','cartao_combustivel','cadeado','chave_reserva','carrinho_carga','documento_veicular','manual_veiculo','triangulo','chave_roda'] as const).map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {getFieldLabel(key)}
                        </label>
                        <select
                          value={formData.acessorios[key]}
                          onChange={(e) => setFormData(prev => ({ ...prev, acessorios: { ...prev.acessorios, [key]: parseInt(e.target.value) } }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          {statusItems.map(item => (
                            <option key={item.status_id} value={item.status_id}>{item.status}</option>
                          ))}
                        </select>
                      </div>
                    ))}

                    {/* Estepe com opções específicas */}
                    <div className="md:col-span-2 xl:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estepe</label>
                      <select
                        value={formData.acessorios.estepe}
                        onChange={(e) => setFormData(prev => ({ ...prev, acessorios: { ...prev.acessorios, estepe: parseInt(e.target.value) } }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {getEstepeStatusOptions(statusItems).map(item => (
                          <option key={item.status_id} value={item.status_id}>{item.status}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>

                {/* Componentes */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-4">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">Componentes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {Object.entries(formData.componentes).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {getFieldLabel(key)}
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

                {/* Faróis */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-4">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">Faróis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {Object.entries(formData.farol).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {getFieldLabel(key)}
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

                {/* Fluidos */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-4">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">Fluidos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
              </div>
              
              <div className="flex flex-wrap justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-gray-800/80">
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Voltar
                </button>
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
              </div>
            </form>
          )}
          
          {/* Navigation buttons for steps 1 and 2 */}
          {currentStep < 3 && (
            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!formData.motorista_id || !formData.veiculo_id || !formData.quilometragem || !formData.data || !formData.hora}
              >
                Próximo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateMonthlyChecklistModal;