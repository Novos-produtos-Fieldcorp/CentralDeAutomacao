import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, Camera, User, Building, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import type { Comprovante } from '@/../../shared/schema';

const comprovanteSchema = z.object({
  motorista_id: z.string().min(1, 'Selecione um motorista'),
  cliente_id: z.string().min(1, 'Selecione um cliente'),
  logradouro: z.string().min(1, 'Endereço é obrigatório'),
  numero: z.string().optional(),
  bairro: z.string().min(1, 'Bairro é obrigatório'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  cep: z.string().min(8, 'CEP deve ter 8 dígitos').max(9, 'CEP deve ter no máximo 9 dígitos'),
  foto_comprovante: z.any().optional(),
});

type ComprovanteFormData = z.infer<typeof comprovanteSchema>;

interface ComprovanteWithDetails extends Comprovante {
  motorista?: {
    nome: string;
  };
  cliente?: {
    nome: string;
  };
  endereco?: {
    logradouro?: {
      logradouro: string;
      nr_cep: string;
      bairro?: {
        bairro: string;
        cidade?: {
          cidade: string;
        };
      };
    };
    nr_end?: number;
  }[];
}

interface EditComprovanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  comprovante: ComprovanteWithDetails | null;
}

const EditComprovanteModal = ({ isOpen, onClose, onSuccess, comprovante }: EditComprovanteModalProps) => {
  const { companyId } = useCompanyData();
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loadingCep, setLoadingCep] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ComprovanteFormData>({
    resolver: zodResolver(comprovanteSchema),
    defaultValues: {
      motorista_id: '',
      cliente_id: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      cep: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
      if (comprovante) {
        populateForm();
      }
    }
  }, [isOpen, comprovante]);

  const populateForm = () => {
    if (!comprovante) return;

    const endereco = comprovante.endereco?.[0];
    
    form.setValue('motorista_id', comprovante.motorista_id?.toString() || '');
    form.setValue('cliente_id', comprovante.cliente_id?.toString() || '');
    form.setValue('logradouro', endereco?.logradouro?.logradouro || '');
    form.setValue('numero', endereco?.nr_end?.toString() || '');
    form.setValue('bairro', endereco?.logradouro?.bairro?.bairro || '');
    form.setValue('cidade', endereco?.logradouro?.bairro?.cidade?.cidade || '');
    form.setValue('cep', endereco?.logradouro?.nr_cep || '');
    
    if (comprovante.foto_comprovante) {
      setImagePreview(comprovante.foto_comprovante);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch motoristas
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .order('nome');

      if (motoristasData) {
        setMotoristas(motoristasData);
      }

      // Fetch clientes
      const { data: clientesData } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId)
        .eq('st_cliente', true)
        .order('nome');

      if (clientesData) {
        setClientes(clientesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('Arquivo muito grande. Limite de 10MB.');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `comprovante-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('comprovante')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('comprovante')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const createOrUpdateLogradouro = async (data: ComprovanteFormData) => {
    // Check if logradouro exists
    const { data: existingLogradouro } = await supabase
      .from('logradouro')
      .select('logradouro_id, id_bairro(bairro_id, id_cidade(cidade_id, id_estado(estado_id)))')
      .eq('logradouro', data.logradouro)
      .eq('nr_cep', data.cep.replace(/\D/g, ''))
      .single();

    if (existingLogradouro) {
      return existingLogradouro.logradouro_id;
    }

    // Create estado if needed
    let estadoId = 1; // Default estado
    const { data: existingEstado } = await supabase
      .from('estado')
      .select('estado_id')
      .eq('sigla_estado', 'BR')
      .single();

    if (existingEstado) {
      estadoId = existingEstado.estado_id;
    }

    // Create cidade if needed
    let cidadeId;
    const { data: existingCidade } = await supabase
      .from('cidade')
      .select('cidade_id')
      .eq('cidade', data.cidade)
      .eq('id_estado', estadoId)
      .single();

    if (existingCidade) {
      cidadeId = existingCidade.cidade_id;
    } else {
      const { data: newCidade, error: cidadeError } = await supabase
        .from('cidade')
        .insert({
          cidade: data.cidade,
          id_estado: estadoId,
        })
        .select('cidade_id')
        .single();

      if (cidadeError) throw cidadeError;
      cidadeId = newCidade.cidade_id;
    }

    // Create bairro if needed
    let bairroId;
    const { data: existingBairro } = await supabase
      .from('bairro')
      .select('bairro_id')
      .eq('bairro', data.bairro)
      .eq('id_cidade', cidadeId)
      .single();

    if (existingBairro) {
      bairroId = existingBairro.bairro_id;
    } else {
      const { data: newBairro, error: bairroError } = await supabase
        .from('bairro')
        .insert({
          bairro: data.bairro,
          id_cidade: cidadeId,
        })
        .select('bairro_id')
        .single();

      if (bairroError) throw bairroError;
      bairroId = newBairro.bairro_id;
    }

    // Create logradouro
    const { data: newLogradouro, error: logradouroError } = await supabase
      .from('logradouro')
      .insert({
        logradouro: data.logradouro,
        nr_cep: data.cep.replace(/\D/g, ''),
        id_bairro: bairroId,
      })
      .select('logradouro_id')
      .single();

    if (logradouroError) throw logradouroError;
    return newLogradouro.logradouro_id;
  };

  const onSubmit = async (data: ComprovanteFormData) => {
    if (!comprovante) return;

    try {
      setLoading(true);

      let imageUrl = comprovante.foto_comprovante;

      // Upload new image if selected
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      // Update comprovante
      const { error: comprovanteError } = await supabase
        .from('comprovante')
        .update({
          motorista_id: data.motorista_id ? parseInt(data.motorista_id) : null,
          cliente_id: data.cliente_id ? parseInt(data.cliente_id) : null,
          foto_comprovante: imageUrl,
        })
        .eq('id', comprovante.id);

      if (comprovanteError) throw comprovanteError;

      // Create or update logradouro
      const logradouroId = await createOrUpdateLogradouro(data);

      // Update endereco
      const { error: enderecoError } = await supabase
        .from('end_comprovante_entrega')
        .upsert({
          id_comprovante: comprovante.id,
          id_logradouro: logradouroId,
          nr_end: data.numero ? parseInt(data.numero) : null,
        });

      if (enderecoError) throw enderecoError;

      toast.success('Comprovante atualizado com sucesso!');
      onSuccess();
      onClose();
      form.reset();
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Error updating comprovante:', error);
      toast.error('Erro ao atualizar comprovante');
    } finally {
      setLoading(false);
    }
  };

  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    
    if (cepLimpo.length !== 8) {
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      // Preencher os campos automaticamente
      form.setValue('logradouro', data.logradouro || '', { shouldDirty: true, shouldTouch: true });
      form.setValue('bairro', data.bairro || '', { shouldDirty: true, shouldTouch: true });
      form.setValue('cidade', data.localidade || '', { shouldDirty: true, shouldTouch: true });
      
      // Mostrar sucesso apenas se pelo menos cidade e bairro foram preenchidos
      if (data.localidade && data.bairro) {
        toast.success('Endereço preenchido automaticamente!');
      } else if (data.localidade) {
        toast.success('Cidade preenchida automaticamente');
      } else {
        toast.success('CEP válido, preencha os demais campos');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast.error('Erro ao buscar CEP');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>, originalOnChange: (e: React.ChangeEvent<HTMLInputElement>) => void) => {
    const valor = e.target.value;
    const cepFormatado = valor.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
    
    // Atualizar o valor formatado
    const eventoFormatado = { ...e, target: { ...e.target, value: cepFormatado } };
    originalOnChange(eventoFormatado);
    
    // Buscar automaticamente quando o CEP estiver completo
    if (valor.replace(/\D/g, '').length === 8) {
      buscarCep(valor);
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedImage(null);
    setImagePreview(null);
    onClose();
  };

  if (!isOpen || !comprovante) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Editar Comprovante
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            data-testid="button-close-modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Motorista */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Motorista *
            </label>
            <select
              {...form.register('motorista_id')}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              data-testid="select-motorista"
            >
              <option value="">Selecione um motorista</option>
              {motoristas.map((motorista) => (
                <option key={motorista.motorista_id} value={motorista.motorista_id}>
                  {motorista.nome}
                </option>
              ))}
            </select>
            {form.formState.errors.motorista_id && (
              <p className="text-red-500 text-sm mt-1">{form.formState.errors.motorista_id.message}</p>
            )}
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Building className="w-4 h-4 inline mr-2" />
              Cliente *
            </label>
            <select
              {...form.register('cliente_id')}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              data-testid="select-cliente"
            >
              <option value="">Selecione um cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.cliente_id} value={cliente.cliente_id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            {form.formState.errors.cliente_id && (
              <p className="text-red-500 text-sm mt-1">{form.formState.errors.cliente_id.message}</p>
            )}
          </div>

          {/* Endereço de Entrega */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Endereço de Entrega
            </h3>

            {/* CEP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CEP * {loadingCep && <span className="text-blue-500 text-xs">(Buscando...)</span>}
              </label>
              <input
                type="text"
                {...((field) => ({
                  ...field,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleCepChange(e, field.onChange)
                }))(form.register('cep'))}
                maxLength={9}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Ex: 01234-567"
                data-testid="input-cep"
              />
              {form.formState.errors.cep && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.cep.message}</p>
              )}
            </div>

            {/* Logradouro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Logradouro *
              </label>
              <input
                type="text"
                {...form.register('logradouro')}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Ex: Rua das Flores"
                data-testid="input-logradouro"
              />
              {form.formState.errors.logradouro && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.logradouro.message}</p>
              )}
            </div>

            {/* Número */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Número
              </label>
              <input
                type="text"
                {...form.register('numero')}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Ex: 123"
                data-testid="input-numero"
              />
            </div>

            {/* Bairro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bairro *
              </label>
              <input
                type="text"
                {...form.register('bairro')}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Ex: Centro"
                data-testid="input-bairro"
              />
              {form.formState.errors.bairro && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.bairro.message}</p>
              )}
            </div>

            {/* Cidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cidade *
              </label>
              <input
                type="text"
                {...form.register('cidade')}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Ex: São Paulo"
                data-testid="input-cidade"
              />
              {form.formState.errors.cidade && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.cidade.message}</p>
              )}
            </div>
          </div>

          {/* Upload de Imagem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Camera className="w-4 h-4 inline mr-2" />
              Comprovante (Imagem)
            </label>
            
            {/* Preview da imagem atual ou nova */}
            {imagePreview && (
              <div className="mb-4">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-w-xs h-48 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setSelectedImage(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remover imagem
                </button>
              </div>
            )}

            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Clique para fazer upload</span> ou arraste e solte
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG ou JPEG (MAX. 10MB)</p>
                </div>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                  data-testid="input-file-upload"
                />
              </label>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="button-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-save"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditComprovanteModal;