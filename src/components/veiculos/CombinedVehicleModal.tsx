import React, { useState, useRef, useEffect } from 'react';
import { X, Truck, MapPin, PenTool as Tool, FileText, CheckCircle2, XCircle, Camera, Loader2, ExternalLink, Upload, Save, Edit2 } from 'lucide-react';
import type { Veiculo, DocumentoVeiculo } from '../../types/database';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { VEHICLE_TYPES } from '../../constants/vehicleTypes';

interface CombinedVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
  onUploadSuccess?: () => void;
}

const CombinedVehicleModal = ({ isOpen, onClose, veiculo, onUploadSuccess }: CombinedVehicleModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [veiculoData, setVeiculoData] = useState<Veiculo | null>(null);
  const [documentoVeiculo, setDocumentoVeiculo] = useState<DocumentoVeiculo | null>(null);

  // Form state for editing
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
    marca_rastreador: ''
  });

  useEffect(() => {
    if (isOpen && veiculo) {
      fetchVehicleDetails();
    }
  }, [isOpen, veiculo]);

  useEffect(() => {
    if (veiculoData) {
      setFormData({
        placa: veiculoData.placa || '',
        marca: veiculoData.marca || '',
        tipo: veiculoData.tipo || '',
        ano: veiculoData.ano || '',
        cor: veiculoData.cor || '',
        tipologia: veiculoData.tipologia || '',
        combustivel: veiculoData.combustivel || '',
        peso: veiculoData.peso || '',
        cubagem: veiculoData.cubagem || '',
        possui_rastreador: veiculoData.possui_rastreador || false,
        marca_rastreador: veiculoData.marca_rastreador || ''
      });

      // Set preview URL for document
      if (documentoVeiculo?.foto_crv) {
        setPreviewUrl(documentoVeiculo.foto_crv);
      }
    }
  }, [veiculoData, documentoVeiculo]);

  const fetchVehicleDetails = async () => {
    if (!veiculo) return;

    try {
      // Fetch vehicle details
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('veiculo')
        .select('*')
        .eq('veiculo_id', veiculo.veiculo_id)
        .single();

      if (vehicleError) throw vehicleError;
      setVeiculoData(vehicleData);

      // Fetch document details
      const { data: documentData, error: documentError } = await supabase
        .from('documento_veiculo')
        .select('*')
        .eq('veiculo_id', veiculo.veiculo_id)
        .maybeSingle();

      if (documentError && documentError.code !== 'PGRST116') throw documentError;
      setDocumentoVeiculo(documentData || null);
      if (documentData?.foto_crv) {
        setPreviewUrl(documentData.foto_crv);
      }
    } catch (error) {
      console.error('Error fetching vehicle details:', error);
      toast.error('Erro ao carregar detalhes do veículo');
    }
  };

  if (!isOpen || !veiculo) return null;

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size (max 15MB)
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. Tamanho máximo: 15MB');
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
      return;
    }

    setFile(selectedFile);
  };

  const uploadDocument = async (file: File, type: 'crv' | 'antt' | 'seguro') => {
    if (!veiculo || !veiculo.veiculo_id) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${veiculo.veiculo_id}/${type}_${Date.now()}.${fileExt}`;
      const filePath = `${veiculo.veiculo_id}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('imagensdocs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(filePath);

      const { data: existingDoc } = await supabase
        .from('documento_veiculo')
        .select('*')
        .eq('veiculo_id', veiculo.veiculo_id)
        .single();

      if (existingDoc) {
        // If document exists, update it
        const { error: updateError } = await supabase
          .from('documento_veiculo')
          .update({
            foto_crv: publicUrl
          })
          .eq('id_documento_veiculo', existingDoc.id_documento_veiculo);

        if (updateError) throw updateError;
      } else {
        // If no document exists, create a new one
        const { error: insertError } = await supabase
          .from('documento_veiculo')
          .insert({
            veiculo_id: veiculo.veiculo_id,
            foto_crv: publicUrl
          });

        if (insertError) throw insertError;
      }

      // Update preview URL
      setPreviewUrl(publicUrl);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Update document state
      await fetchVehicleDetails();

      toast.success('Documento enviado com sucesso');
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!veiculo) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('veiculo')
        .update({
          ...formData,
          placa: formData.placa.toUpperCase()
        })
        .eq('veiculo_id', veiculo.veiculo_id);
        
      if (error) throw error;
      
      toast.success('Veículo atualizado com sucesso');
      
      // Refresh vehicle data
      await fetchVehicleDetails();
      
      // Exit edit mode
      setIsEditing(false);
      
      // Call onUploadSuccess to refresh parent component if needed
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      console.error('Error updating vehicle:', error);
      toast.error('Erro ao atualizar veículo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-transparent" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {veiculoData?.placa.toUpperCase() || veiculo.placa.toUpperCase()} - {veiculoData?.marca || veiculo.marca} {veiculoData?.tipo || veiculo.tipo}
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

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'details'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <Truck className="w-5 h-5 mr-2" />
                  Detalhes do Veículo
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'documents'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Documentos
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8">
              {activeTab === 'details' && (
                <>
                  {/* Edit/Save Button */}
                  <div className="flex justify-end">
                    {isEditing ? (
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                 transition-colors flex items-center gap-2"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            Salvar
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                 transition-colors flex items-center gap-2"
                      >
                        <Edit2 className="w-5 h-5" />
                        Editar
                      </button>
                    )}
                  </div>

                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Vehicle Info */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-gray-400" />
                        Informações do Veículo
                      </h3>
                      
                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Placa *
                            </label>
                            <input
                              type="text"
                              name="placa"
                              value={formData.placa}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              required
                              maxLength={7}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Marca
                            </label>
                            <input
                              type="text"
                              name="marca"
                              value={formData.marca}
                              onChange={handleInputChange}
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
                              onChange={handleInputChange}
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
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</span>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white uppercase">{veiculoData?.placa || veiculo.placa}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca</span>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculoData?.marca || veiculo.marca || 'Não informada'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Modelo</span>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculoData?.tipo || veiculo.tipo || 'Não informado'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ano</span>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculoData?.ano || veiculo.ano || 'Não informado'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cor</span>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculoData?.cor || veiculo.cor || 'Não informada'}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Technical Specs */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Tool className="w-5 h-5 text-gray-400" />
                        Especificações Técnicas
                      </h3>
                      
                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Tipologia *
                            </label>
                            <select
                              name="tipologia"
                              value={formData.tipologia}
                              onChange={handleInputChange}
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
                              onChange={handleInputChange}
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
                              onChange={handleInputChange}
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
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipologia</span>
                            <p className="text-base text-gray-900 dark:text-white">{veiculoData?.tipologia || veiculo.tipologia || 'Não informada'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Combustível</span>
                            <p className="text-base text-gray-900 dark:text-white">{veiculoData?.combustivel || veiculo.combustivel || 'Não informado'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Peso</span>
                            <p className="text-base text-gray-900 dark:text-white">{veiculoData?.peso ? `${veiculoData.peso} kg` : 'Não informado'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cubagem</span>
                            <p className="text-base text-gray-900 dark:text-white">{veiculoData?.cubagem ? `${veiculoData.cubagem} m³` : 'Não informada'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tracking Info */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      Rastreamento
                    </h3>
                    
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <input
                              type="checkbox"
                              name="possui_rastreador"
                              checked={formData.possui_rastreador}
                              onChange={handleInputChange}
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
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status do Rastreador</span>
                          <div className="mt-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              veiculoData?.possui_rastreador
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {veiculoData?.possui_rastreador ? (
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
                        {veiculoData?.possui_rastreador && veiculoData?.marca_rastreador && (
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca do Rastreador</span>
                            <p className="text-base text-gray-900 dark:text-white mt-1">{veiculoData.marca_rastreador}</p>
                          </div>
                        )}
                        {/* Add placeholder content when rastreador is false to maintain layout */}
                        {!veiculoData?.possui_rastreador && (
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Observação</span>
                            <p className="text-base text-gray-900 dark:text-white mt-1">Veículo sem rastreador instalado</p>
                          </div>
                        )}
                        {/* Add placeholder content when rastreador is true but no brand */}
                        {veiculoData?.possui_rastreador && !veiculoData?.marca_rastreador && (
                          <div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca do Rastreador</span>
                            <p className="text-base text-gray-900 dark:text-white mt-1">Não informada</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-6">
                  {/* CRV Document */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        CRV Digital
                      </h3>
                      {previewUrl && (
                        <button
                          onClick={() => openDocumentInNewTab(previewUrl)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                        >
                          <ExternalLink size={16} />
                          Abrir em nova aba
                        </button>
                      )}
                    </div>
                    
                    {previewUrl ? (
                      <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        {isPdf(previewUrl) ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <FileText className="w-12 h-12 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                            <button
                              onClick={() => setActiveDocument(previewUrl)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                            >
                              <FileText size={16} />
                              Visualizar PDF
                            </button>
                          </div>
                        ) : (
                          <img
                            src={previewUrl}
                            alt="CRV do veículo"
                            className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                            onClick={() => setActiveDocument(previewUrl)}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                        <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        <div className="text-center">
                          <p className="text-gray-500 dark:text-gray-400 font-medium">CRV não cadastrado</p>
                          <p className="text-sm text-gray-400 dark:text-gray-500">
                            Faça o upload do CRV para visualizá-lo aqui
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Upload Section */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Enviar novo documento
                        </h4>
                      </div>
                      
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Selecione um arquivo
                          </label>
                          <input
                            type="file"
                            onChange={handleFileChange}
                            accept="image/jpeg,image/png,image/jpg,application/pdf"
                            className="block w-full text-sm text-gray-900 dark:text-gray-100
                                   file:mr-4 file:py-2 file:px-4
                                   file:rounded-md file:border-0
                                   file:text-sm file:font-medium
                                   file:bg-blue-50 file:text-blue-700
                                   dark:file:bg-blue-900/20 dark:file:text-blue-300
                                   hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30
                                   border border-gray-300 dark:border-gray-600 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            ref={fileInputRef}
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            JPEG, PNG ou PDF (máx. 15MB)
                          </p>
                        </div>
                        
                        <button
                          onClick={() => uploadDocument(file!, 'crv')}
                          disabled={!file || uploading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                 flex items-center gap-2"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5" />
                              Enviar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen document viewer */}
      {activeDocument && (
        <div 
          className="fixed inset-0 bg-transparent z-[60] flex items-center justify-center p-4"
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

export default CombinedVehicleModal;