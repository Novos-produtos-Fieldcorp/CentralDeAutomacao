import React, { useState, useEffect } from 'react';
import { X, Truck, User, MapPin, Phone, Mail, Calendar, CreditCard, FileText, Info, Camera, CheckCircle2, XCircle, ExternalLink, Edit2, Home, Save, Loader2 } from 'lucide-react';
import type { DocumentoMotorista, Veiculo, DocumentoVeiculo, Motorista, DocumentoAjudante, PessoaFisicaDonoVeiculo, PessoaJuridicaDonoVeiculo } from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  agregado?: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, agregado, onSuccess }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'vehicle'>('details');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [veiculo, setVeiculo] = useState<(Veiculo & {
    documento_veiculo: (DocumentoVeiculo & {
      pessoa_fisica_dono_veiculo?: PessoaFisicaDonoVeiculo;
      pessoa_juridica_dono_veiculo?: PessoaJuridicaDonoVeiculo;
    })[];
  }) | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [documento_ajudante, setDocumentoAjudante] = useState<DocumentoAjudante | null>(null);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  
  // Form states for editable fields
  const [cnhForm, setCnhForm] = useState({
    nr_registro_cnh: '',
    categoria_cnh: '',
    validade_cnh: '',
    uf_cnh: '',
    nome_pai: '',
    nome_mae: ''
  });
  
  const [veiculoForm, setVeiculoForm] = useState({
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
    if (isOpen && agregado) {
      fetchAgregadoDetails();
    }
  }, [isOpen, agregado]);

  useEffect(() => {
    // Initialize form data when documento is loaded
    if (documento) {
      setCnhForm({
        nr_registro_cnh: documento.nr_registro_cnh ? String(documento.nr_registro_cnh) : '',
        categoria_cnh: documento.categoria_cnh || '',
        validade_cnh: documento.validade_cnh ? documento.validade_cnh.split('T')[0] : '',
        uf_cnh: documento.uf_cnh || '',
        nome_pai: documento.nome_pai || '',
        nome_mae: documento.nome_mae || ''
      });
    }
  }, [documento]);

  useEffect(() => {
    // Initialize vehicle form data when veiculo is loaded
    if (veiculo) {
      setVeiculoForm({
        placa: veiculo.placa || '',
        marca: veiculo.marca || '',
        tipo: veiculo.tipo || '',
        ano: veiculo.ano || '',
        cor: veiculo.cor || '',
        tipologia: veiculo.tipologia || '',
        combustivel: veiculo.combustivel || '',
        peso: veiculo.peso || '',
        cubagem: veiculo.cubagem || '',
        possui_rastreador: veiculo.possui_rastreador || false,
        marca_rastreador: veiculo.marca_rastreador || ''
      });
    }
  }, [veiculo]);

  const fetchAgregadoDetails = async () => {
    if (!agregado) return;
    
    try {
      setLoading(true);
      
      // Fetch documento_motorista
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', agregado.motorista_id)
        .maybeSingle();

      if (documentoError && documentoError.code !== 'PGRST116') {
        throw documentoError;
      }

      // Fetch endereco
      const { data: enderecoData, error: enderecoError } = await supabase
        .from('end_motorista')
        .select(`
          nr_end,
          ds_complemento_end,
          logradouro (
            logradouro,
            nr_cep,
            bairro (
              bairro,
              cidade (
                cidade,
                estado (
                  sigla_estado
                )
              )
            )
          )
        `)
        .eq('id_motorista', agregado.motorista_id)
        .maybeSingle();

      if (enderecoError && enderecoError.code !== 'PGRST116') {
        throw enderecoError;
      }

      // Fetch veiculo
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculo')
        .select(`
          *,
          documento_veiculo (
            *,
            pessoa_fisica_dono_veiculo (*),
            pessoa_juridica_dono_veiculo (*)
          )
        `)
        .eq('motorista_id', agregado.motorista_id)
        .eq('status_veiculo', true)
        .maybeSingle();

      if (veiculoError && veiculoError.code !== 'PGRST116') {
        throw veiculoError;
      }

      // Fetch documento_ajudante
      const { data: ajudanteData, error: ajudanteError } = await supabase
        .from('documento_ajudante')
        .select(`
          *,
          cnh_ajudante (*)
        `)
        .eq('veiculo_id', veiculoData?.veiculo_id || 0)
        .maybeSingle();

      if (ajudanteError && ajudanteError.code !== 'PGRST116') {
        throw ajudanteError;
      }

      setDocumento(documentoData);
      setEndereco(enderecoData);
      setVeiculo(veiculoData);
      setDocumentoAjudante(ajudanteData);
    } catch (error) {
      console.error('Error fetching agregado details:', error);
      toast.error('Erro ao carregar detalhes do agregado');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCnh = async () => {
    if (!agregado) return;
    
    try {
      setSubmitting(true);
      
      const documentoData = {
        nr_registro_cnh: cnhForm.nr_registro_cnh ? parseFloat(cnhForm.nr_registro_cnh) : null,
        categoria_cnh: cnhForm.categoria_cnh,
        validade_cnh: cnhForm.validade_cnh || null,
        uf_cnh: cnhForm.uf_cnh,
        nome_pai: cnhForm.nome_pai,
        nome_mae: cnhForm.nome_mae,
        motorista_id: agregado.motorista_id
      };
      
      if (documento) {
        // Update existing documento
        const { error } = await supabase
          .from('documento_motorista')
          .update(documentoData)
          .eq('id_documento_motorista', documento.id_documento_motorista);
          
        if (error) throw error;
      } else {
        // Create new documento
        const { error } = await supabase
          .from('documento_motorista')
          .insert(documentoData);
          
        if (error) throw error;
      }
      
      toast.success('Informações da CNH salvas com sucesso');
      fetchAgregadoDetails(); // Refresh data
    } catch (error) {
      console.error('Error saving CNH information:', error);
      toast.error('Erro ao salvar informações da CNH');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveVeiculo = async () => {
    if (!agregado || !veiculo) return;
    
    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('veiculo')
        .update({
          placa: veiculoForm.placa,
          marca: veiculoForm.marca,
          tipo: veiculoForm.tipo,
          ano: veiculoForm.ano,
          cor: veiculoForm.cor,
          tipologia: veiculoForm.tipologia,
          combustivel: veiculoForm.combustivel,
          peso: veiculoForm.peso,
          cubagem: veiculoForm.cubagem,
          possui_rastreador: veiculoForm.possui_rastreador,
          marca_rastreador: veiculoForm.marca_rastreador
        })
        .eq('veiculo_id', veiculo.veiculo_id);
        
      if (error) throw error;
      
      toast.success('Informações do veículo salvas com sucesso');
      fetchAgregadoDetails(); // Refresh data
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving vehicle information:', error);
      toast.error('Erro ao salvar informações do veículo');
    } finally {
      setSubmitting(false);
    }
  };

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  if (!isOpen || !agregado) return null;

  // Ensure we have the agregado data
  const nome = agregado.nome || '';
  const cpf = agregado.cpf || '';
  const status = agregado.st_cadastro || '';

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Agregado • {formatCPF(cpf)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                           rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'details'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <User className="w-5 h-5 mr-2" />
                  Detalhes
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
                <button
                  onClick={() => setActiveTab('vehicle')}
                  className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'vehicle'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <Truck className="w-5 h-5 mr-2" />
                  Veículo
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-6 flex justify-center items-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="p-6 space-y-8">
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Informações Pessoais */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" />
                        Informações Pessoais
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {agregado.nome}
                            </div>
                          </div>
                          
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {formatCPF(agregado.cpf)}
                            </div>
                          </div>
                          
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {agregado.dt_nascimento ? formatDate(agregado.dt_nascimento) : 'Não informada'}
                            </div>
                          </div>
                          
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                            <div className="text-base text-gray-900 dark:text-white break-words capitalize">
                              {agregado.st_cadastro.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {agregado.telefone ? formatPhone(agregado.telefone.toString()) : 'Não informado'}
                            </div>
                          </div>
                          
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {agregado.email || 'Não informado'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                    
                    {/* Endereço */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        Endereço
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Logradouro</div>
                          <div className="text-base text-gray-900 dark:text-white break-words">
                            {endereco?.logradouro?.logradouro ? 
                              `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                              'Não informado'
                            }
                          </div>
                        </div>
                        
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Complemento</div>
                          <div className="text-base text-gray-900 dark:text-white break-words">
                            {endereco?.ds_complemento_end || 'Não informado'}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Bairro</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.bairro?.bairro || 'Não informado'}
                            </div>
                          </div>
                          
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CEP</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Cidade</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.bairro?.cidade?.cidade || 'Não informada'}
                            </div>
                          </div>
                          
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Estado</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.bairro?.cidade?.estado?.sigla_estado || 'Não informado'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
                
                {/* Documents Tab */}
                {activeTab === 'documents' && (
                  <div className="space-y-6">
                    {/* CNH Information */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-gray-400" />
                          Informações da CNH
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Número da CNH
                          </label>
                          <input
                            type="text"
                            value={cnhForm.nr_registro_cnh}
                            onChange={(e) => setCnhForm(prev => ({ ...prev, nr_registro_cnh: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Categoria
                          </label>
                          <select
                            value={cnhForm.categoria_cnh}
                            onChange={(e) => setCnhForm(prev => ({ ...prev, categoria_cnh: e.target.value }))}
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
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Validade
                          </label>
                          <input
                            type="date"
                            value={cnhForm.validade_cnh}
                            onChange={(e) => setCnhForm(prev => ({ ...prev, validade_cnh: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            UF
                          </label>
                          <select
                            value={cnhForm.uf_cnh}
                            onChange={(e) => setCnhForm(prev => ({ ...prev, uf_cnh: e.target.value }))}
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
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nome do Pai
                          </label>
                          <input
                            type="text"
                            value={cnhForm.nome_pai}
                            onChange={(e) => setCnhForm(prev => ({ ...prev, nome_pai: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nome da Mãe
                          </label>
                          <input
                            type="text"
                            value={cnhForm.nome_mae}
                            onChange={(e) => setCnhForm(prev => ({ ...prev, nome_mae: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveCnh}
                          disabled={submitting}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                 flex items-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            <>
                              <Save className="w-5 h-5" />
                              Salvar Informações da CNH
                            </>
                          )}
                        </button>
                      </div>

                      {/* CNH Document */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">CNH Digital</div>
                          {documento?.foto_cnh && (
                            <button
                              onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                            >
                              <ExternalLink size={14} />
                              Abrir em nova aba
                            </button>
                          )}
                        </div>
                        
                        {documento?.foto_cnh ? (
                          <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            {isPdf(documento.foto_cnh) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                <button
                                  onClick={() => setActiveDocument(documento.foto_cnh)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                >
                                  <FileText size={16} />
                                  Visualizar PDF
                                </button>
                              </div>
                            ) : (
                              <img
                                src={documento.foto_cnh}
                                alt="CNH"
                                className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                onClick={() => setActiveDocument(documento.foto_cnh)}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                            <div className="text-center">
                              <p className="text-gray-500 dark:text-gray-400 font-medium">CNH não cadastrada</p>
                              <p className="text-sm text-gray-400 dark:text-gray-500">
                                Faça o upload da CNH para visualizá-la aqui
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Comprovante de Residência */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Home className="w-5 h-5 text-gray-400" />
                          Comprovante de Residência
                        </h3>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Comprovante Digital</div>
                          {documento?.foto_comprovante_residencia && (
                            <button
                              onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                            >
                              <ExternalLink size={14} />
                              Abrir em nova aba
                            </button>
                          )}
                        </div>
                        
                        {documento?.foto_comprovante_residencia ? (
                          <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            {isPdf(documento.foto_comprovante_residencia) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                <button
                                  onClick={() => setActiveDocument(documento.foto_comprovante_residencia)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                >
                                  <FileText size={16} />
                                  Visualizar PDF
                                </button>
                              </div>
                            ) : (
                              <img
                                src={documento.foto_comprovante_residencia}
                                alt="Comprovante de Residência"
                                className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                onClick={() => setActiveDocument(documento.foto_comprovante_residencia)}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                            <div className="text-center">
                              <p className="text-gray-500 dark:text-gray-400 font-medium">Comprovante não cadastrado</p>
                              <p className="text-sm text-gray-400 dark:text-gray-500">
                                Faça o upload do comprovante para visualizá-lo aqui
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}
                
                {/* Vehicle Tab */}
                {activeTab === 'vehicle' && veiculo && (
                  <div className="space-y-6">
                    {/* Vehicle Information */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-gray-400" />
                        Informações do Veículo
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Placa
                          </label>
                          <input
                            type="text"
                            value={veiculoForm.placa}
                            onChange={(e) => setVeiculoForm(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            maxLength={7}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Marca
                          </label>
                          <input
                            type="text"
                            value={veiculoForm.marca}
                            onChange={(e) => setVeiculoForm(prev => ({ ...prev, marca: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Modelo
                          </label>
                          <input
                            type="text"
                            value={veiculoForm.tipo}
                            onChange={(e) => setVeiculoForm(prev => ({ ...prev, tipo: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Ano
                          </label>
                          <input
                            type="text"
                            value={veiculoForm.ano}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 4) {
                                setVeiculoForm(prev => ({ ...prev, ano: value }));
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
                            value={veiculoForm.cor}
                            onChange={(e) => setVeiculoForm(prev => ({ ...prev, cor: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Tipologia
                          </label>
                          <input
                            type="text"
                            value={veiculoForm.tipologia}
                            onChange={(e) => setVeiculoForm(prev => ({ ...prev, tipologia: e.target.value.toUpperCase() }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Combustível
                          </label>
                          <input
                            type="text"
                            value={veiculoForm.combustivel}
                            onChange={(e) => setVeiculoForm(prev => ({ ...prev, combustivel: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Peso (kg)
                          </label>
                          <input
                            type="text"
                            value={veiculoForm.peso}
                            onChange={(e) => setVeiculoForm(prev => ({ ...prev, peso: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Cubagem (m³)
                          </label>
                          <input
                            type="text"
                            value={veiculoForm.cubagem}
                            onChange={(e) => setVeiculoForm(prev => ({ ...prev, cubagem: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <input
                              type="checkbox"
                              checked={veiculoForm.possui_rastreador}
                              onChange={(e) => setVeiculoForm(prev => ({ ...prev, possui_rastreador: e.target.checked }))}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>Possui Rastreador</span>
                          </label>
                        </div>

                        {veiculoForm.possui_rastreador && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Marca do Rastreador
                            </label>
                            <input
                              type="text"
                              value={veiculoForm.marca_rastreador}
                              onChange={(e) => setVeiculoForm(prev => ({ ...prev, marca_rastreador: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-end mt-6">
                        <button
                          onClick={handleSaveVeiculo}
                          disabled={submitting}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                 flex items-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            <>
                              <Save className="w-5 h-5" />
                              Salvar Informações do Veículo
                            </>
                          )}
                        </button>
                      </div>
                    </section>
                    
                    {/* CRV Document */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <FileText className="w-5 h-5 text-gray-400" />
                          Documentação do Veículo
                        </h3>
                        {veiculo.documento_veiculo?.[0]?.foto_crv && (
                          <button
                            onClick={() => openDocumentInNewTab(veiculo.documento_veiculo[0].foto_crv)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                          >
                            <ExternalLink size={16} />
                            Abrir em nova aba
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {/* CRV Document */}
                        <div className="mt-4">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">CRV Digital</div>
                          {veiculo.documento_veiculo?.[0]?.foto_crv ? (
                            <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {isPdf(veiculo.documento_veiculo[0].foto_crv) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                  <button
                                    onClick={() => setActiveDocument(veiculo.documento_veiculo[0].foto_crv)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                  >
                                    <FileText size={16} />
                                    Visualizar PDF
                                  </button>
                                </div>
                              ) : (
                                <img
                                  src={veiculo.documento_veiculo[0].foto_crv}
                                  alt="CRV do veículo"
                                  className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                  onClick={() => setActiveDocument(veiculo.documento_veiculo[0].foto_crv)}
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
                        </div>
                      </div>
                    </section>
                    
                    {/* Helper Information */}
                    {documento_ajudante && (
                      <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <User className="w-5 h-5 text-gray-400" />
                          Informações do Ajudante
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {documento_ajudante.nome || 'Não informado'}
                              </div>
                            </div>
                            
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {documento_ajudante.cpf ? formatCPF(documento_ajudante.cpf.toString()) : 'Não informado'}
                              </div>
                            </div>
                          </div>
                          
                          {/* CNH do Ajudante */}
                          {documento_ajudante.cnh_ajudante && documento_ajudante.cnh_ajudante.length > 0 && (
                            <div className="mt-4">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">CNH do Ajudante</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="overflow-hidden">
                                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Número</div>
                                  <div className="text-base text-gray-900 dark:text-white break-words">
                                    {documento_ajudante.cnh_ajudante[0].nr_registro || 'Não informado'}
                                  </div>
                                </div>
                                
                                <div className="overflow-hidden">
                                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoria</div>
                                  <div className="text-base text-gray-900 dark:text-white break-words">
                                    {documento_ajudante.cnh_ajudante[0].categoria || 'Não informada'}
                                  </div>
                                </div>
                              </div>
                              
                              {documento_ajudante.cnh_ajudante[0].foto_cnh && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => setActiveDocument(documento_ajudante.cnh_ajudante[0].foto_cnh)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                                  >
                                    <FileText size={14} />
                                    Ver CNH do Ajudante
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen document viewer */}
      {activeDocument && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
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

export default UnifiedAgregadoModal;