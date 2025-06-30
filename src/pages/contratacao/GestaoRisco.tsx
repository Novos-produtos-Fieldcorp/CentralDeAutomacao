import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, X, Loader2, Check, Search } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';

interface GRStatus {
  id: number;
  status: string;
}

interface GREmpresa {
  id: number;
  nome: string;
}

interface GRMotorista {
  id: number;
  motorista_id: number;
  empresa_id: number;
  status_id: number;
  motivo: string;
  empresa_nome?: string;
  status_nome?: string;
  motorista_nome?: string;
}

interface AddEmpresaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  empresas: GREmpresa[];
  statuses: GRStatus[];
}

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={24} />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const AddEmpresaModal: React.FC<AddEmpresaModalProps> = ({ isOpen, onClose, onSuccess, empresas, statuses }) => {
  const [formData, setFormData] = useState({
    empresa_id: '',
    status_id: '',
    motivo: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [motoristas, setMotoristas] = useState<{ motorista_id: number; nome: string }[]>([]);
  const [selectedMotorista, setSelectedMotorista] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { companyId } = useCompanyData();

  useEffect(() => {
    if (isOpen) {
      fetchMotoristas();
    }
  }, [isOpen, searchTerm]);

  const fetchMotoristas = async () => {
    try {
      let query = supabase
        .from('motorista')
        .select('motorista_id, nome')
        .eq('company_id', companyId);
      
      if (searchTerm) {
        query = query.ilike('nome', `%${searchTerm}%`);
      }
      
      const { data, error } = await query.limit(10);
      
      if (error) throw error;
      setMotoristas(data || []);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMotorista || !formData.empresa_id || !formData.status_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Check if entry already exists
      const { data: existingData, error: checkError } = await supabase
        .from('gr_motorista')
        .select('id')
        .eq('motorista_id', selectedMotorista)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existingData) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from('gr_motorista')
          .update({
            empresa_id: parseInt(formData.empresa_id),
            status_id: parseInt(formData.status_id),
            motivo: formData.motivo
          })
          .eq('id', existingData.id);
          
        if (updateError) throw updateError;
      } else {
        // Create new entry
        const { error: insertError } = await supabase
          .from('gr_motorista')
          .insert({
            motorista_id: selectedMotorista,
            empresa_id: parseInt(formData.empresa_id),
            status_id: parseInt(formData.status_id),
            motivo: formData.motivo
          });
          
        if (insertError) throw insertError;
      }
      
      toast.success('Informações de gestão de risco salvas com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving risk management data:', error);
      toast.error('Erro ao salvar informações de gestão de risco');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Adicionar Gestão de Risco
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motorista *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar motorista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-2"
              />
              <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            
            {motoristas.length > 0 ? (
              <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
                {motoristas.map((motorista) => (
                  <div 
                    key={motorista.motorista_id}
                    className={`p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedMotorista === motorista.motorista_id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => setSelectedMotorista(motorista.motorista_id)}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {motorista.nome.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {motorista.nome}
                        </p>
                      </div>
                      {selectedMotorista === motorista.motorista_id && (
                        <Check className="ml-auto h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
                Nenhum motorista encontrado
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Empresa *
            </label>
            <select
              value={formData.empresa_id}
              onChange={(e) => setFormData(prev => ({ ...prev, empresa_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Selecione uma empresa</option>
              {empresas.map(empresa => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status *
            </label>
            <select
              value={formData.status_id}
              onChange={(e) => setFormData(prev => ({ ...prev, status_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Selecione um status</option>
              {statuses.map(status => (
                <option key={status.id} value={status.id}>
                  {status.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motivo
            </label>
            <textarea
              value={formData.motivo}
              onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={submitting || !selectedMotorista || !formData.empresa_id || !formData.status_id}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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

const GestaoRisco: React.FC = () => {
  const { companyId } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [motoristas, setMotoristas] = useState<GRMotorista[]>([]);
  const [empresas, setEmpresas] = useState<GREmpresa[]>([]);
  const [statuses, setStatuses] = useState<GRStatus[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState<GRMotorista | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch statuses
      const { data: statusesData, error: statusesError } = await supabase
        .from('gr_status')
        .select('*')
        .order('id');
        
      if (statusesError) throw statusesError;
      setStatuses(statusesData || []);
      
      // Fetch empresas
      const { data: empresasData, error: empresasError } = await supabase
        .from('gr_empresa')
        .select('*')
        .order('nome');
        
      if (empresasError) throw empresasError;
      setEmpresas(empresasData || []);
      
      // Fetch motoristas with GR data
      const { data: motoristasData, error: motoristasError } = await supabase
        .from('vw_motoristas_completo')
        .select(`
          motorista_id,
          nome_motorista,
          gr_motorista_id,
          gr_motorista_motivo,
          empresa_motorista,
          status_motorista
        `)
        .eq('company_id', companyId)
        .order('nome_motorista');
        
      if (motoristasError) throw motoristasError;
      
      // Transform data to match our interface
      const transformedData: GRMotorista[] = (motoristasData || []).map(m => ({
        id: m.gr_motorista_id || 0,
        motorista_id: m.motorista_id,
        empresa_id: 0, // We'll get this from the join
        status_id: 0, // We'll get this from the join
        motivo: m.gr_motorista_motivo || '',
        empresa_nome: m.empresa_motorista || '',
        status_nome: m.status_motorista || '',
        motorista_nome: m.nome_motorista
      }));
      
      setMotoristas(transformedData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMotorista) return;
    
    try {
      const { error } = await supabase
        .from('gr_motorista')
        .delete()
        .eq('id', selectedMotorista.id);
        
      if (error) throw error;
      
      toast.success('Registro excluído com sucesso');
      fetchData();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Erro ao excluir registro');
    }
  };

  const filteredMotoristas = motoristas.filter(motorista => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      motorista.motorista_nome?.toLowerCase().includes(searchLower) ||
      motorista.empresa_nome?.toLowerCase().includes(searchLower) ||
      motorista.status_nome?.toLowerCase().includes(searchLower) ||
      motorista.motivo?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Gestão de Risco</h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Adicionar
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por motorista, empresa, status ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motivo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMotoristas.length > 0 ? (
                filteredMotoristas.map((motorista) => (
                  <tr key={motorista.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {motorista.motorista_nome?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {motorista.motorista_nome || 'Não informado'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {motorista.empresa_nome || 'Não informada'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        motorista.status_nome === 'Aprovado' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                          : motorista.status_nome === 'Reprovado'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                            : motorista.status_nome === 'Pendente'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {motorista.status_nome || 'Não informado'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white line-clamp-2">
                        {motorista.motivo || 'Não informado'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => {
                            setSelectedMotorista(motorista);
                            setIsEditModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMotorista(motorista);
                            setIsDeleteModalOpen(true);
                          }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum registro de gestão de risco encontrado'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddEmpresaModal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedMotorista(null);
        }}
        onSuccess={fetchData}
        empresas={empresas}
        statuses={statuses}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedMotorista(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o registro de gestão de risco para ${selectedMotorista?.motorista_nome || 'este motorista'}?`}
      />
    </div>
  );
};

export default GestaoRisco;