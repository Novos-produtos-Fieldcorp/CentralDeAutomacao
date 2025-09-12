import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, Camera, User, Building, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';

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

interface AddComprovanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddComprovanteModal = ({ isOpen, onClose, onSuccess }: AddComprovanteModalProps) => {
  const { companyId } = useCompanyData();
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
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
    }
  }, [isOpen]);

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
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileName = `comprovante-${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('comprovante')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('comprovante')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const createLogradouro = async (data: ComprovanteFormData) => {
    // For simplicity, we'll create a basic address structure
    // In a real app, you might want to use a proper address API
    
    // First, check if estado exists (using default for Brazil)
    let { data: estadoData } = await supabase
      .from('estado')
      .select('id_estado')
      .eq('sigla_estado', 'BR')
      .single();

    if (!estadoData) {
      const { data: newEstado } = await supabase
        .from('estado')
        .insert({ estado: 'Brasil', sigla_estado: 'BR' })
        .select('id_estado')
        .single();
      estadoData = newEstado;
    }

    // Check if cidade exists
    let { data: cidadeData } = await supabase
      .from('cidade')
      .select('id_cidade')
      .eq('cidade', data.cidade)
      .eq('id_estado', estadoData?.id_estado)
      .single();

    if (!cidadeData) {
      const { data: newCidade } = await supabase
        .from('cidade')
        .insert({ cidade: data.cidade, id_estado: estadoData?.id_estado })
        .select('id_cidade')
        .single();
      cidadeData = newCidade;
    }

    // Check if bairro exists
    let { data: bairroData } = await supabase
      .from('bairro')
      .select('id_bairro')
      .eq('bairro', data.bairro)
      .eq('id_cidade', cidadeData?.id_cidade)
      .single();

    if (!bairroData) {
      const { data: newBairro } = await supabase
        .from('bairro')
        .insert({ bairro: data.bairro, id_cidade: cidadeData?.id_cidade })
        .select('id_bairro')
        .single();
      bairroData = newBairro;
    }

    // Check if logradouro exists
    let { data: logradouroData } = await supabase
      .from('logradouro')
      .select('id_logradouro')
      .eq('logradouro', data.logradouro)
      .eq('nr_cep', data.cep.replace(/\D/g, ''))
      .eq('id_bairro', bairroData?.id_bairro)
      .single();

    if (!logradouroData) {
      const { data: newLogradouro } = await supabase
        .from('logradouro')
        .insert({ 
          logradouro: data.logradouro, 
          nr_cep: data.cep.replace(/\D/g, ''), 
          id_bairro: bairroData?.id_bairro 
        })
        .select('id_logradouro')
        .single();
      logradouroData = newLogradouro;
    }

    return logradouroData?.id_logradouro;
  };

  const onSubmit = async (data: ComprovanteFormData) => {
    try {
      setLoading(true);

      let fotoUrl = null;
      if (selectedImage) {
        fotoUrl = await uploadImage(selectedImage);
      }

      // Create logradouro if needed
      const logradouroId = await createLogradouro(data);

      // Create comprovante
      const { data: comprovanteData, error: comprovanteError } = await supabase
        .from('comprovante')
        .insert({
          company_id: companyId,
          motorista_id: parseInt(data.motorista_id),
          cliente_id: parseInt(data.cliente_id),
          foto_comprovante: fotoUrl,
        })
        .select('id')
        .single();

      if (comprovanteError) throw comprovanteError;

      // Create delivery address
      if (comprovanteData && logradouroId) {
        const { error: enderecoError } = await supabase
          .from('end_comprovante_entrega')
          .insert({
            id_comprovante: comprovanteData.id,
            id_logradouro: logradouroId,
            nr_end: data.numero ? parseInt(data.numero) : null,
          });

        if (enderecoError) throw enderecoError;
      }

      toast.success('Comprovante adicionado com sucesso!');
      onSuccess();
      onClose();
      form.reset();
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Error creating comprovante:', error);
      toast.error('Erro ao criar comprovante');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedImage(null);
    setImagePreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Adicionar Comprovante
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

            {/* CEP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CEP *
              </label>
              <input
                type="text"
                {...form.register('cep')}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Ex: 01234-567"
                maxLength={9}
                data-testid="input-cep"
              />
              {form.formState.errors.cep && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.cep.message}</p>
              )}
            </div>
          </div>

          {/* Upload de Foto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Camera className="w-4 h-4 inline mr-2" />
              Foto do Comprovante
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
              {imagePreview ? (
                <div className="text-center">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-full max-h-48 mx-auto rounded-lg mb-4"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    data-testid="button-change-image"
                  >
                    Alterar foto
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    data-testid="button-upload-image"
                  >
                    Selecionar foto
                  </button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    PNG, JPG ou JPEG até 10MB
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                data-testid="input-file"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              data-testid="button-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="button-save-comprovante"
            >
              {loading ? 'Salvando...' : 'Salvar Comprovante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddComprovanteModal;