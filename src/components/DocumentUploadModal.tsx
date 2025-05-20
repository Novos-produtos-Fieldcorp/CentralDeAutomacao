import React, { useState, useEffect } from 'react';
import { X, Loader2, Upload, CreditCard, Home, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import DocumentUploader from './DocumentUploader';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista_id: number;
  nome: string;
  onUploadSuccess?: () => void;
}

interface DocumentoMotorista {
  id_documento_motorista?: number;
  foto_cnh: string | null;
  foto_comprovante_residencia: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  nr_registro_cnh: string | null;
  categoria_cnh: string | null;
  validade_cnh: string | null;
  uf_cnh: string | null;
  motorista_id: number;
}

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  motorista_id,
  nome,
  onUploadSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documento, setDocumento] = useState<DocumentoMotorista>({
    foto_cnh: null,
    foto_comprovante_residencia: null,
    nome_pai: null,
    nome_mae: null,
    nr_registro_cnh: null,
    categoria_cnh: null,
    validade_cnh: null,
    uf_cnh: null,
    motorista_id
  });
  const [veiculo, setVeiculo] = useState<any | null>(null);
  const [documentoVeiculo, setDocumentoVeiculo] = useState<any | null>(null);
  const [veiculoData, setVeiculoData] = useState({
    foto_crv: null as string | null
  });

  useEffect(() => {
    if (isOpen && motorista_id) {
      fetchDocumento();
      fetchVeiculoInfo();
    }
  }, [isOpen, motorista_id]);

  const fetchDocumento = async () => {
    if (!motorista_id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setDocumento({
          id_documento_motorista: data.id_documento_motorista,
          foto_cnh: data.foto_cnh,
          foto_comprovante_residencia: data.foto_comprovante_residencia,
          nome_pai: data.nome_pai,
          nome_mae: data.nome_mae,
          nr_registro_cnh: data.nr_registro_cnh ? String(data.nr_registro_cnh) : null,
          categoria_cnh: data.categoria_cnh,
          validade_cnh: data.validade_cnh,
          uf_cnh: data.uf_cnh,
          motorista_id
        });
      } else {
        setDocumento({
          foto_cnh: null,
          foto_comprovante_residencia: null,
          nome_pai: null,
          nome_mae: null,
          nr_registro_cnh: null,
          categoria_cnh: null,
          validade_cnh: null,
          uf_cnh: null,
          motorista_id
        });
      }
    } catch (error) {
      console.error('Error fetching documento:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchVeiculoInfo = async () => {
    try {
      // Get vehicle associated with this motorista
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculo')
        .select('*')
        .eq('motorista_id', motorista_id)
        .eq('status_veiculo', true)
        .maybeSingle();

      if (veiculoError) throw veiculoError;
      
      if (veiculoData) {
        setVeiculo(veiculoData);
        
        // Get vehicle document if it exists
        const { data: docData, error: docError } = await supabase
          .from('documento_veiculo')
          .select('*')
          .eq('veiculo_id', veiculoData.veiculo_id)
          .maybeSingle();
          
        if (docError) throw docError;
        
        if (docData) {
          setDocumentoVeiculo(docData);
          setVeiculoData({
            foto_crv: docData.foto_crv
          });
        }
      }
    } catch (error) {
      console.error('Error fetching vehicle info:', error);
      // Don't show error toast as vehicle might not exist
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDocumento(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!motorista_id) {
      toast.error('ID do motorista inválido');
      return;
    }
    
    try {
      setSaving(true);

      // Check if document record exists
      const { data: existingDoc, error: checkError } = await supabase
        .from('documento_motorista')
        .select('id_documento_motorista')
        .eq('motorista_id', motorista_id)
        .maybeSingle();
        
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // Prepare data with proper handling of numeric fields
      const documentData = {
        nome_pai: documento.nome_pai,
        nome_mae: documento.nome_mae,
        nr_registro_cnh: documento.nr_registro_cnh ? parseFloat(documento.nr_registro_cnh) : null,
        categoria_cnh: documento.categoria_cnh,
        validade_cnh: documento.validade_cnh,
        uf_cnh: documento.uf_cnh,
        foto_cnh: documento.foto_cnh,
        foto_comprovante_residencia: documento.foto_comprovante_residencia
      };

      if (existingDoc) {
        // Update existing record
        const { error } = await supabase
          .from('documento_motorista')
          .update(documentData)
          .eq('motorista_id', motorista_id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('documento_motorista')
          .insert({
            motorista_id,
            ...documentData
          });

        if (error) throw error;
      }

      // Update vehicle document if vehicle exists
      if (veiculo && veiculoData.foto_crv) {
        if (documentoVeiculo) {
          // Update existing vehicle document
          const { error: veiculoError } = await supabase
            .from('documento_veiculo')
            .update({ foto_crv: veiculoData.foto_crv })
            .eq('id_documento_veiculo', documentoVeiculo.id_documento_veiculo);
            
          if (veiculoError) throw veiculoError;
        } else {
          // Create new vehicle document
          const { error: veiculoError } = await supabase
            .from('documento_veiculo')
            .insert({ 
              veiculo_id: veiculo.veiculo_id,
              foto_crv: veiculoData.foto_crv
            });
            
          if (veiculoError) throw veiculoError;
        }
      }

      toast.success('Documentos salvos com sucesso');
      if (onUploadSuccess) onUploadSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving documento:', error);
      toast.error('Erro ao salvar documentos');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = (field: keyof DocumentoMotorista, url: string) => {
    setDocumento(prev => ({ ...prev, [field]: url }));
  };

  const handleVeiculoDocumentUpload = (field: keyof typeof veiculoData, url: string) => {
    setVeiculoData(prev => ({ ...prev, [field]: url }));
  };

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Documentos de {nome}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CNH Information */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <CreditCard className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                    Informações da CNH
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número da CNH
                    </label>
                    <input
                      type="text"
                      name="nr_registro_cnh"
                      value={documento.nr_registro_cnh || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Categoria
                    </label>
                    <select
                      name="categoria_cnh"
                      value={documento.categoria_cnh || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Selecione</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>
                      <option value="AB">AB</option>
                      <option value="AC">AC</option>
                      <option value="AD">AD</option>
                      <option value="AE">AE</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Validade
                    </label>
                    <input
                      type="date"
                      name="validade_cnh"
                      value={documento.validade_cnh || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      UF
                    </label>
                    <select
                      name="uf_cnh"
                      value={documento.uf_cnh || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Selecione</option>
                      <option value="AC">AC</option>
                      <option value="AL">AL</option>
                      <option value="AP">AP</option>
                      <option value="AM">AM</option>
                      <option value="BA">BA</option>
                      <option value="CE">CE</option>
                      <option value="DF">DF</option>
                      <option value="ES">ES</option>
                      <option value="GO">GO</option>
                      <option value="MA">MA</option>
                      <option value="MT">MT</option>
                      <option value="MS">MS</option>
                      <option value="MG">MG</option>
                      <option value="PA">PA</option>
                      <option value="PB">PB</option>
                      <option value="PR">PR</option>
                      <option value="PE">PE</option>
                      <option value="PI">PI</option>
                      <option value="RJ">RJ</option>
                      <option value="RN">RN</option>
                      <option value="RS">RS</option>
                      <option value="RO">RO</option>
                      <option value="RR">RR</option>
                      <option value="SC">SC</option>
                      <option value="SP">SP</option>
                      <option value="SE">SE</option>
                      <option value="TO">TO</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome do Pai
                    </label>
                    <input
                      type="text"
                      name="nome_pai"
                      value={documento.nome_pai || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome da Mãe
                    </label>
                    <input
                      type="text"
                      name="nome_mae"
                      value={documento.nome_mae || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>
              
              {/* CNH Document */}
              <div>
                <DocumentUploader
                  documentType="cnh"
                  currentUrl={documento.foto_cnh}
                  motorista_id={motorista_id}
                  onUploadComplete={(url) => handleDocumentUpload('foto_cnh', url)}
                  label="CNH"
                />
              </div>
              
              {/* Comprovante de Residência */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Home className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                    Comprovante de Residência
                  </h3>
                </div>
                
                <DocumentUploader
                  documentType="comprovante_residencia"
                  currentUrl={documento.foto_comprovante_residencia}
                  motorista_id={motorista_id}
                  onUploadComplete={(url) => handleDocumentUpload('foto_comprovante_residencia', url)}
                  label="Comprovante de Residência"
                />
              </div>

              {/* CRV Section - Only show if vehicle exists */}
              {veiculo && (
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 flex-1">
                      CRV do Veículo
                    </h3>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</span>
                        <p className="text-base font-semibold text-gray-900 dark:text-white uppercase">{veiculo.placa}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca</span>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{veiculo.marca}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Modelo</span>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{veiculo.tipo}</p>
                      </div>
                    </div>
                  </div>
                  
                  <DocumentUploader
                    documentType="cnh" // Reusing the same component but for CRV
                    motorista_id={motorista_id}
                    currentUrl={veiculoData.foto_crv}
                    onUploadComplete={(url) => handleVeiculoDocumentUpload('foto_crv', url)}
                    label="CRV Digital"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentUploadModal;