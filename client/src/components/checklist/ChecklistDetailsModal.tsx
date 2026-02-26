import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Camera, Loader2, AlertCircle, Edit2, Save, ArrowLeft, Upload, Trash2, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportChecklistToPDF } from '../../utils/export';
import { getStatusInfo } from '../../utils/checklistStatus';
import type { Checklist } from '../../types/database';
import LoadingSpinner from '../LoadingSpinner';
import { PhotoThumbnail } from './PhotoThumbnail';
import { ChecklistSection } from './ChecklistSection';
import toast from 'react-hot-toast';

interface ChecklistDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklist: Checklist | null;
  onEdit?: (checklist: Checklist) => void;
}

const ChecklistDetailsModal = ({ isOpen, onClose, checklist, onEdit }: ChecklistDetailsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklistDetails, setChecklistDetails] = useState<any>(null);
  const [statusItems, setStatusItems] = useState<{ status_id: number; status: string }[]>([]);
  const retryTimeoutRef = useRef<number>();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const [photoUploadState, setPhotoUploadState] = useState<Record<string, { status: 'idle' | 'preparing' | 'uploading' | 'done' | 'error'; progress: number; error?: string }>>({});
  const activeUploadsRef = useRef(0);
  const uploadQueueRef = useRef<Array<() => Promise<void>>>([]);
  const [motoristas, setMotoristas] = useState<Array<{ motorista_id: number; nome: string }>>([]);
  const [veiculos, setVeiculos] = useState<Array<{ veiculo_id: number; placa: string }>>([]);
  const [loadingMotoristas, setLoadingMotoristas] = useState(false);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);
  const [motoristaSearchTerm, setMotoristaSearchTerm] = useState('');
  const [veiculoSearchTerm, setVeiculoSearchTerm] = useState('');
  const [isMotoristaDropdownOpen, setIsMotoristaDropdownOpen] = useState(false);
  const [isVeiculoDropdownOpen, setIsVeiculoDropdownOpen] = useState(false);
  const motoristaDropdownRef = useRef<HTMLDivElement>(null);
  const veiculoDropdownRef = useRef<HTMLDivElement>(null);
  
  // Form state for editing
  const [formData, setFormData] = useState({
    data: '',
    hora: '',
    quilometragem: '',
    observacoes: '',
    motorista_id: '',
    veiculo_id: '',
    status: false
  });

  // State for editing components
  const [editComponents, setEditComponents] = useState<any>({
    fluidos: {},
    farol: {},
    componentes: {},
    acessorios: {}
  });

  // State for editing photos
  const [editPhotos, setEditPhotos] = useState<any>({});

  useEffect(() => {
    fetchStatusItems();
    fetchMotoristas();
    fetchVeiculos();
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (motoristaDropdownRef.current && !motoristaDropdownRef.current.contains(event.target as Node)) {
        setIsMotoristaDropdownOpen(false);
      }
      if (veiculoDropdownRef.current && !veiculoDropdownRef.current.contains(event.target as Node)) {
        setIsVeiculoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchMotoristas = async () => {
    try {
      setLoadingMotoristas(true);
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .eq('ativo', true)
        .not('nome', 'is', null)
        .not('nome', 'eq', '')
        .order('nome');
      if (error) throw error;
      setMotoristas(data || []);
    } catch (err) {
      console.error('Error fetching motoristas:', err);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoadingMotoristas(false);
    }
  };

  const fetchVeiculos = async () => {
    try {
      setLoadingVeiculos(true);
      const { data, error } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .eq('status_veiculo', true)
        .not('placa', 'is', null)
        .not('placa', 'eq', '')
        .order('placa');
      if (error) throw error;
      setVeiculos(data || []);
    } catch (err) {
      console.error('Error fetching veiculos:', err);
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoadingVeiculos(false);
    }
  };

  const getSelectedMotoristaName = () => {
    const motorista = motoristas.find(m => m.motorista_id.toString() === formData.motorista_id);
    return motorista ? motorista.nome : 'Selecione um motorista';
  };

  const getSelectedVeiculoName = () => {
    const veiculo = veiculos.find(v => v.veiculo_id.toString() === formData.veiculo_id);
    return veiculo ? veiculo.placa : 'Selecione um veículo';
  };

  const filteredMotoristas = motoristas.filter(m =>
    m.nome && m.nome.trim() !== '' && (m.nome || '').toLowerCase().includes((motoristaSearchTerm || '').toLowerCase())
  );

  const filteredVeiculos = veiculos.filter(v =>
    v.placa && v.placa.trim() !== '' && (v.placa || '').toLowerCase().includes((veiculoSearchTerm || '').toLowerCase())
  );

  useEffect(() => {
    if (isOpen && checklist) {
      fetchChecklistDetails();
      setIsEditing(false);
    }
  }, [isOpen, checklist]);

  useEffect(() => {
    if (checklistDetails) {
      // Initialize form data from checklist details
      setFormData({
        data: checklistDetails.data || '',
        hora: checklistDetails.hora || '',
        quilometragem: checklistDetails.quilometragem?.toString() || '',
        observacoes: checklistDetails.observacoes || '',
        motorista_id: checklistDetails.motorista_id?.toString() || '',
        veiculo_id: checklistDetails.veiculo_id?.toString() || '',
        status: checklistDetails.status || false
      });

      // Initialize component data
      setEditComponents({
        fluidos: checklistDetails.fluidos || {},
        farol: checklistDetails.farol || {},
        componentes: checklistDetails.componentes || {},
        acessorios: checklistDetails.acessorios || {}
      });

      // Initialize photos data
      setEditPhotos(checklistDetails.fotos || {});
    }
  }, [checklistDetails]);

  const fetchStatusItems = async (retryCount = 0) => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('status_item')
        .select('*')
        .order('status_id');

      if (error) throw error;
      
      if (data) {
        setStatusItems(data || []);
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

  const handleExportPDF = async () => {
    if (checklistDetails) {
      await exportChecklistToPDF(checklistDetails);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleComponentChange = (section: string, field: string, value: any) => {
    setEditComponents((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const setPhotoState = (photoField: string, next: { status: 'idle' | 'preparing' | 'uploading' | 'done' | 'error'; progress: number; error?: string }) => {
    setPhotoUploadState(prev => ({
      ...prev,
      [photoField]: next
    }));
  };

  const runUploadQueue = () => {
    const MAX_CONCURRENT_UPLOADS = 3;
    while (activeUploadsRef.current < MAX_CONCURRENT_UPLOADS && uploadQueueRef.current.length > 0) {
      const job = uploadQueueRef.current.shift();
      if (!job) return;
      activeUploadsRef.current += 1;
      job()
        .catch(() => {
          // handled in job
        })
        .finally(() => {
          activeUploadsRef.current -= 1;
          runUploadQueue();
        });
    }
  };

  const compressImageIfNeeded = async (file: File): Promise<File> => {
    try {
      if (!file.type.startsWith('image/')) return file;

      // Skip very small files
      if (file.size <= 300 * 1024) return file;

      const bitmap = await createImageBitmap(file);
      const MAX_W = 1600;
      const scale = Math.min(1, MAX_W / bitmap.width);
      const targetW = Math.max(1, Math.round(bitmap.width * scale));
      const targetH = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      bitmap.close();

      // Use jpeg for speed/size; keeps original name extension stable for storage key.
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.75));
      if (!blob) return file;

      return new File([blob], file.name.replace(/\.(png|webp|jpg|jpeg)$/i, '.jpg'), { type: 'image/jpeg' });
    } catch {
      return file;
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, photoField: string) => {
    const file = e.target.files?.[0];
    if (!file || !checklist) return;

    // allow selecting the same file again
    e.target.value = '';

    const enqueue = (fn: () => Promise<void>) => {
      uploadQueueRef.current.push(fn);
      runUploadQueue();
    };
    
    setPhotoState(photoField, { status: 'preparing', progress: 5 });

    enqueue(async () => {
      try {
        setPhotoState(photoField, { status: 'preparing', progress: 10 });

        const processedFile = await compressImageIfNeeded(file);

        // Create a unique file name
        const fileExt = processedFile.name.split('.').pop();
        const fileName = `${checklist.checklist_id}_${photoField}_${Date.now()}.${fileExt}`;

        setPhotoState(photoField, { status: 'uploading', progress: 25 });

        const { error: uploadError } = await supabase.storage
          .from('imagensdocs')
          .upload(fileName, processedFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: processedFile.type
          });

        if (uploadError) throw uploadError;

        setPhotoState(photoField, { status: 'uploading', progress: 85 });

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('imagensdocs')
          .getPublicUrl(fileName);

        // Update the photo in state
        setEditPhotos((prev: any) => ({
          ...prev,
          [photoField]: publicUrl
        }));

        setPhotoState(photoField, { status: 'done', progress: 100 });
        toast.success('Foto enviada com sucesso');

        window.setTimeout(() => {
          setPhotoUploadState(prev => {
            const copy = { ...prev };
            delete copy[photoField];
            return copy;
          });
        }, 1500);
      } catch (error) {
        console.error('Error uploading photo:', error);
        setPhotoState(photoField, {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Erro ao enviar foto'
        });
        toast.error('Erro ao enviar foto');
      }
    });
  };

  const handleRemovePhoto = async (photoField: string) => {
    if (!checklist) return;
    
    try {
      setDeletingPhoto(photoField);
      
      // Get the current photo URL
      const currentPhotoUrl = editPhotos[photoField];
      
      if (currentPhotoUrl) {
        // Extract the file name from the URL
        const fileNameWithPath = currentPhotoUrl.split('/').pop();
        
        if (fileNameWithPath) {
          // Delete the file from storage
          const { error: deleteError } = await supabase.storage
            .from('imagensdocs')
            .remove([fileNameWithPath]);
            
          if (deleteError) {
            console.warn('Error deleting photo from storage:', deleteError);
            // Continue anyway as we want to remove from database even if storage delete fails
          }
        }
      }
      
      // Update state to remove the photo
      setEditPhotos((prev: any) => ({
        ...prev,
        [photoField]: null
      }));
      
      toast.success('Foto removida com sucesso');
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error('Erro ao remover foto');
    } finally {
      setDeletingPhoto(null);
    }
  };

  const handleSave = async () => {
    if (!checklist) return;
    
    try {
      setSaving(true);
      
      // Update main checklist data
      const { error: checklistError } = await supabase
        .from('checklist')
        .update({
          data: formData.data,
          hora: formData.hora,
          quilometragem: parseFloat(formData.quilometragem),
          observacoes: formData.observacoes,
          status: formData.status,
          motorista_id: formData.motorista_id ? Number(formData.motorista_id) : null,
          veiculo_id: formData.veiculo_id ? Number(formData.veiculo_id) : null
        })
        .eq('checklist_id', checklist.checklist_id);
        
      if (checklistError) throw checklistError;
      
      // Update fluidos
      if (editComponents.fluidos && Object.keys(editComponents.fluidos).length > 0) {
        const { error: fluidosError } = await supabase
          .from('fluido_veiculo')
          .update(editComponents.fluidos)
          .eq('checklist_id', checklist.checklist_id);
          
        if (fluidosError) throw fluidosError;
      }
      
      // Update farol
      if (editComponents.farol && Object.keys(editComponents.farol).length > 0) {
        const { error: farolError } = await supabase
          .from('farol_veiculo')
          .update(editComponents.farol)
          .eq('checklist_id', checklist.checklist_id);
          
        if (farolError) throw farolError;
      }
      
      // Update componentes
      if (editComponents.componentes && Object.keys(editComponents.componentes).length > 0) {
        const { error: componentesError } = await supabase
          .from('componentes_gerais')
          .update(editComponents.componentes)
          .eq('checklist_id', checklist.checklist_id);
          
        if (componentesError) throw componentesError;
      }
      
      // Update acessorios
      if (editComponents.acessorios && Object.keys(editComponents.acessorios).length > 0) {
        const { error: acessoriosError } = await supabase
          .from('acessorios_veiculos')
          .update(editComponents.acessorios)
          .eq('checklist_id', checklist.checklist_id);
          
        if (acessoriosError) throw acessoriosError;
      }
      
      // Update photos if it's a monthly checklist
      if (checklist.id_tipo_checklist === 1 && editPhotos) {
        // Check if photos record exists
        const { data: existingPhotos, error: checkPhotosError } = await supabase
          .from('foto_checklist')
          .select('id_foto_checklist')
          .eq('checklist_id', checklist.checklist_id)
          .maybeSingle();
          
        if (checkPhotosError && checkPhotosError.code !== 'PGRST116') throw checkPhotosError;
        
        if (existingPhotos) {
          // Update existing photos
          const { error: updatePhotosError } = await supabase
            .from('foto_checklist')
            .update(editPhotos)
            .eq('id_foto_checklist', existingPhotos.id_foto_checklist);
            
          if (updatePhotosError) throw updatePhotosError;
        } else {
          // Insert new photos record
          const { error: insertPhotosError } = await supabase
            .from('foto_checklist')
            .insert({
              ...editPhotos,
              checklist_id: checklist.checklist_id
            });
            
          if (insertPhotosError) throw insertPhotosError;
        }
      }
      
      toast.success('Checklist atualizado com sucesso');
      fetchChecklistDetails(); // Refresh data
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast.error('Erro ao salvar checklist');
    } finally {
      setSaving(false);
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
            label={key.replace(/foto_/g, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          />
        ))}
      </div>
    );
  };

  const renderEditablePhotos = () => {
    if (!checklist || checklist.id_tipo_checklist !== 1) return null;
    
    // Fotos obrigatórias (sempre mostram)
    const requiredPhotoFields = [
      { key: 'foto_hodometro', label: 'Hodômetro' },
      { key: 'foto_oleo', label: 'Óleo' },
      { key: 'foto_bateria', label: 'Bateria' },
      { key: 'foto_carrinho_carga', label: 'Carrinho de Carga' },
      { key: 'foto_dianteira', label: 'Dianteira' },
      { key: 'foto_traseira', label: 'Traseira' },
      { key: 'foto_lateral_direita', label: 'Lateral Direita' },
      { key: 'foto_lateral_esquerda', label: 'Lateral Esquerda' },
      { key: 'foto_estepe', label: 'Estepe' }
    ];
    
    // Fotos opcionais (só mostram se existirem)
    const optionalPhotoFields = [
      { key: 'foto_pneu_dianteiro_direito', label: 'Pneu Dianteiro Direito' },
      { key: 'foto_pneu_dianteiro_esquerdo', label: 'Pneu Dianteiro Esquerdo' },
      { key: 'foto_pneu_traseiro_direito', label: 'Pneu Traseiro Direito' },
      { key: 'foto_pneu_traseiro_esquerdo', label: 'Pneu Traseiro Esquerdo' },
      { key: 'foto_macaco', label: 'Macaco' },
      { key: 'foto_chavederoda', label: 'Chave de Roda' },
      { key: 'foto_triangulo', label: 'Triângulo' }
    ];
    
    // Filtrar fotos opcionais que existem
    const visibleOptionalFields = optionalPhotoFields.filter(({ key }) => editPhotos[key]);
    
    const photoFields = [...requiredPhotoFields, ...visibleOptionalFields];
    
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Fotos do Veículo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {photoFields.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </label>
              {editPhotos[key] ? (
                <div className="relative aspect-video w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group">
                  <img
                    src={editPhotos[key]}
                    alt={label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => handleRemovePhoto(key)}
                      disabled={deletingPhoto === key}
                      className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                    >
                      {deletingPhoto === key ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    id={`photo-${key}`}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, key)}
                  />
                  <label
                    htmlFor={`photo-${key}`}
                    className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed rounded-lg cursor-pointer
                              border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                              hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {photoUploadState[key]?.status === 'preparing' || photoUploadState[key]?.status === 'uploading' ? (
                      <div className="w-full px-6">
                        <div className="flex items-center justify-center mb-3">
                          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        </div>
                        <div className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">
                          {photoUploadState[key]?.status === 'preparing' ? 'Preparando...' : 'Enviando...'}
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-2 bg-blue-600 rounded-full transition-all"
                            style={{ width: `${photoUploadState[key]?.progress ?? 0}%` }}
                          />
                        </div>
                        <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                          {Math.round(photoUploadState[key]?.progress ?? 0)}%
                        </div>
                      </div>
                    ) : photoUploadState[key]?.status === 'error' ? (
                      <div className="w-full px-6">
                        <div className="flex items-center justify-center mb-2">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <div className="text-center text-sm text-red-600 dark:text-red-400 mb-2">
                          Falha no upload
                        </div>
                        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                          Clique para tentar novamente
                        </div>
                      </div>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Clique para enviar foto
                        </p>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEditableChecklistSection = (
    title: string, 
    section: string, 
    items: any, 
    excludeKeys: string[] = ['id', 'checklist_id'],
    filterKeys?: string[]
  ) => {
    if (!items) return null;
    
    let filteredKeys = Object.keys(items).filter(key => 
      !excludeKeys.some(exclude => key.includes(exclude))
    );
    
    // Apply additional filtering for weekly checklist
    if (filterKeys) {
      filteredKeys = filteredKeys.filter(key => filterKeys.includes(key));
    }
    
    if (filteredKeys.length === 0) return null;
    
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredKeys.map(key => {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            // Special handling for text fields
            if (key === 'luz_indicador_painel' || key === 'pneu_ruim') {
              return (
                <div key={key} className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {key === 'pneu_ruim' ? 'Pneu com Problema' : label}
                  </label>
                  <input
                    type="text"
                    value={editComponents[section][key] || ''}
                    onChange={(e) => handleComponentChange(section, key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              );
            }
            
            // For status fields
            return (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {label}
                </label>
                <select
                  value={editComponents[section][key] || 1}
                  onChange={(e) => handleComponentChange(section, key, parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {statusItems.map(item => (
                    <option key={item.status_id} value={item.status_id}>
                      {item.status}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
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
  const isWeeklyChecklist = checklist.id_tipo_checklist === 2;
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
      <div className="fixed inset-0 bg-black/50" onClick={isEditing ? undefined : onClose}></div>
      
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
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      disabled={saving}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Salvar
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      Exportar PDF
                    </button>
                  </>
                )}
                <button
                  onClick={isEditing ? () => setIsEditing(false) : onClose}
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
                  
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Data
                        </label>
                        <input
                          type="date"
                          name="data"
                          value={formData.data}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          name="hora"
                          value={formData.hora}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Quilometragem
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          name="quilometragem"
                          value={formData.quilometragem}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div ref={motoristaDropdownRef} className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Motorista
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsMotoristaDropdownOpen(!isMotoristaDropdownOpen)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center justify-between"
                          disabled={loadingMotoristas}
                        >
                          <span className="truncate">
                            {getSelectedMotoristaName()}
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${isMotoristaDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isMotoristaDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Pesquisar motorista..."
                                  value={motoristaSearchTerm}
                                  onChange={(e) => setMotoristaSearchTerm(e.target.value)}
                                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setFormData(prev => ({ ...prev, motorista_id: '' }));
                                setIsMotoristaDropdownOpen(false);
                                setMotoristaSearchTerm('');
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm"
                            >
                              Limpar seleção
                            </button>
                            {filteredMotoristas.map((m) => (
                              <button
                                key={m.motorista_id}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, motorista_id: m.motorista_id.toString() }));
                                  setIsMotoristaDropdownOpen(false);
                                  setMotoristaSearchTerm('');
                                }}
                                className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                  formData.motorista_id === m.motorista_id.toString() ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {m.nome}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div ref={veiculoDropdownRef} className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Veículo
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsVeiculoDropdownOpen(!isVeiculoDropdownOpen)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center justify-between"
                          disabled={loadingVeiculos}
                        >
                          <span className="truncate">
                            {getSelectedVeiculoName()}
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${isVeiculoDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isVeiculoDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Pesquisar veículo..."
                                  value={veiculoSearchTerm}
                                  onChange={(e) => setVeiculoSearchTerm(e.target.value)}
                                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setFormData(prev => ({ ...prev, veiculo_id: '' }));
                                setIsVeiculoDropdownOpen(false);
                                setVeiculoSearchTerm('');
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm"
                            >
                              Limpar seleção
                            </button>
                            {filteredVeiculos.map((v) => (
                              <button
                                key={v.veiculo_id}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, veiculo_id: v.veiculo_id.toString() }));
                                  setIsVeiculoDropdownOpen(false);
                                  setVeiculoSearchTerm('');
                                }}
                                className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                  formData.veiculo_id === v.veiculo_id.toString() ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {v.placa}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Status
                        </label>
                        <div className="flex items-center mt-2">
                          <input
                            type="checkbox"
                            name="status"
                            checked={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Verificado
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Observações
                        </label>
                        <textarea
                          name="observacoes"
                          value={formData.observacoes}
                          onChange={handleInputChange}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>

                {/* Status Sections */}
                <div className="p-6">
                  {isEditing ? (
                    <div className="space-y-6">
                      {/* Editable Fluids Section */}
                      {editComponents.fluidos && Object.keys(editComponents.fluidos).length > 0 && (
                        renderEditableChecklistSection(
                          "Níveis de Fluidos", 
                          "fluidos", 
                          editComponents.fluidos, 
                          ['id_fluido_veiculo', 'checklist_id']
                        )
                      )}
                      
                      {/* Editable Lights Section */}
                      {editComponents.farol && Object.keys(editComponents.farol).length > 0 && (
                        renderEditableChecklistSection(
                          "Sistema de Iluminação", 
                          "farol", 
                          editComponents.farol, 
                          ['id_farol_veiculo', 'checklist_id']
                        )
                      )}
                      
                      {/* Editable Components Section */}
                      {editComponents.componentes && Object.keys(editComponents.componentes).length > 0 && (
                        renderEditableChecklistSection(
                          "Componentes Gerais", 
                          "componentes", 
                          editComponents.componentes, 
                          ['id_componentes_gerais', 'checklist_id'],
                          isWeeklyChecklist ? ['pedal', 'limpeza_interna', 'sistema_freio', 'freio_estacionamento'] : undefined
                        )
                      )}
                      
                      {/* Editable Accessories Section */}
                      {editComponents.acessorios && Object.keys(editComponents.acessorios).length > 0 && (
                        renderEditableChecklistSection(
                          "Acessórios", 
                          "acessorios", 
                          editComponents.acessorios, 
                          ['id_acessorio', 'checklist_id'],
                          isWeeklyChecklist ? ['pneu', 'pneu_ruim', 'documento_veicular', 'carrinho_carga'] : undefined
                        )
                      )}
                      
                      {/* Editable Photos Section - Only for monthly checklist */}
                      {isMonthlyChecklist && renderEditablePhotos()}
                    </div>
                  ) : (
                    <div>
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
                            filterKeys={!isMonthlyChecklist ? ['pedal', 'limpeza_interna', 'sistema_freio', 'freio_estacionamento'] : undefined}
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
                            filterKeys={!isMonthlyChecklist ? ['pneu', 'pneu_ruim', 'documento_veicular', 'carrinho_carga'] : undefined}
                            gridCols={2}
                            specialTextKey="pneu_ruim"
                            specialTextLabel="Pneu com Problema"
                          />
                        </div>
                      )}

                      {/* Photos Section - Only show for monthly checklist */}
                      {isMonthlyChecklist && details.fotos && (
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