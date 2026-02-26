import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Save, Eye, EyeOff, Shield, CheckCircle, X, AlertTriangle, Building2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AccessControl {
  company_id: number;
  nome_company: string;
  cnpj: string;
  id_conta_wiseapp: string;
  checklist_access: boolean;
  motorista_access: boolean;
  hodometro_acsess: boolean;
  minuta_access: boolean;
  resumo_access: boolean;
  comprovante_access: boolean;
  tags_access: boolean | null;
  bomba_gasolina_access: boolean;
  romaneio_access: boolean;
  bau_access: boolean;
  operacoes_access: boolean;
  logs_access: boolean;
  st_company: boolean;
}

interface CompanyFormData {
  nome_company: string;
  cnpj: string;
  email: string;
  telefone: string;
  id_conta_wiseapp: string;
}

const Admin = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessControls, setAccessControls] = useState<AccessControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [companyFormData, setCompanyFormData] = useState<CompanyFormData>({
    nome_company: '',
    cnpj: '',
    email: '',
    telefone: '',
    id_conta_wiseapp: ''
  });
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();

  // The admin password - in a real app, this would be stored securely
  const ADMIN_PASSWORD = 'Wiseapp2025';

  useEffect(() => {
    // Check if admin is already authenticated in this session
    const adminAuth = sessionStorage.getItem('adminAuth');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
      fetchAccessControls();
    }
  }, []);

  const handleAuthenticate = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuth', 'true');
      fetchAccessControls();
      setAuthError('');
    } else {
      setAuthError('Senha incorreta');
      toast.error('Senha incorreta');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAuthenticate();
    }
  };

  const fetchAccessControls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company')
        .select('company_id, nome_company, cnpj, id_conta_wiseapp, checklist_access, motorista_access, hodometro_acsess, minuta_access, resumo_access, comprovante_access, tags_access, bomba_gasolina_access, romaneio_access, bau_access, operacoes_access, st_company')
        .order('company_id', { ascending: true });

      if (error) throw error;

      // Try fetching logs_access separately — column may not exist yet
      const { data: logsData } = await supabase
        .from('company')
        .select('company_id, logs_access');
      const logsMap = new Map<number, boolean>(
        (logsData || []).map((r: any) => [r.company_id, r.logs_access ?? false])
      );

      const normalized = (data || []).map((d: any) => ({
        ...d,
        minuta_access: d.hasOwnProperty('minuta_access') ? d.minuta_access : false,
        logs_access: logsMap.get(d.company_id) ?? false
      }));

      setAccessControls(normalized);
    } catch (error) {
      console.error('Error fetching access controls:', error);
      toast.error('Erro ao carregar controles de acesso');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccess = async (index: number, field: keyof AccessControl) => {
    const control = accessControls[index];
    const currentValue = control[field];
    
    // Calculate new value: treat null/undefined as false and toggle
    let newValue;
    if (field === 'tags_access') {
      newValue = currentValue === true ? false : true;
    } else {
      // For boolean fields, treat null/undefined as false and toggle
      newValue = currentValue === true ? false : true;
    }

    try {

      let updatedData = null;
      let error = null;

      if (field === 'minuta_access') {
        // Use backend service route to bypass RLS for company updates
        try {
          const { createApiUrl } = await import('../lib/api-config-supabase');
          const url = createApiUrl(`/admin/company/${control.company_id}/minuta`);
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: newValue })
          });

          // Read as text once, then try parse JSON from that text to avoid 'body stream already read'
          const text = await resp.text();
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (e) {
            // not JSON, keep json as null
            json = null;
          }

          if (!resp.ok) {
            // Prefer backend json error message if available, otherwise raw text
            const serverMessage = json?.error?.message || json?.error || text || `HTTP ${resp.status}`;
            toast.error('Erro ao contatar backend: ' + serverMessage);
            error = { message: serverMessage };
          } else {
            updatedData = json?.data ?? null;
            error = json?.error ?? null;
            if (json?.error) {
              toast.error('Erro do backend: ' + (json.error.message || JSON.stringify(json.error)));
            }
          }
        } catch (e) {
          error = e;
        }
      } else {
        // Update in Supabase immediately and return the updated row for inspection
        const supRes = await supabase
          .from('company')
          .update({ [field]: newValue })
          .eq('company_id', control.company_id)
          .select();
  updatedData = supRes.data;
  error = supRes.error;
      }

      if (error) {
        console.error(`Error updating ${field} for company ${control.company_id}:`, error);
        toast.error(`Erro ao atualizar ${field}: ${error.message || String(error)}`);
        return;
      }

      // Update local state if the update was successful
      const updatedControls = [...accessControls];
      updatedControls[index] = {
        ...updatedControls[index],
        [field]: newValue
      };
      
      setAccessControls(updatedControls);
      toast.success('Configuração atualizada com sucesso');
    } catch (error) {
      console.error(`Error toggling ${field}:`, error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      let hasError = false;

      // Update each company record
        for (const control of accessControls) {
        const { error } = await supabase
          .from('company')
          .update({
            checklist_access: control.checklist_access,
            motorista_access: control.motorista_access,
            hodometro_acsess: control.hodometro_acsess,
            minuta_access: control.minuta_access,
            resumo_access: control.resumo_access,
            comprovante_access: control.comprovante_access,
            tags_access: control.tags_access,
            romaneio_access: control.romaneio_access,
            bau_access: control.bau_access,
            operacoes_access: control.operacoes_access,
            logs_access: control.logs_access
          })
          .eq('company_id', control.company_id);

        if (error) {
          console.error(`Error updating company ${control.company_id}:`, error);
          hasError = true;
        }
      }

      if (hasError) {
        toast.error('Ocorreram erros ao salvar algumas configurações');
      } else {
        toast.success('Configurações salvas com sucesso');
      }
      
      // Refresh the list regardless of errors to show current state
      fetchAccessControls();
    } catch (error) {
      console.error('Error saving access controls:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuth');
    navigate('/');
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent default form submission
    if (creatingCompany) return;
    
    try {
      setCreatingCompany(true);
      
      // Validate CNPJ format
      if (!/^\d{14}$/.test(companyFormData.cnpj.replace(/\D/g, ''))) {
        toast.error('CNPJ inválido. Digite 14 números.');
        return;
      }
      
      // Create new company
      const { data, error } = await supabase
        .from('company')
        .insert([{
          nome_company: companyFormData.nome_company,
          cnpj: companyFormData.cnpj.replace(/\D/g, ''),
          email: companyFormData.email,
          telefone: companyFormData.telefone.replace(/\D/g, ''),
          st_company: true,
          id_conta_wiseapp: companyFormData.id_conta_wiseapp,
          checklist_access: false,
          motorista_access: false,
          hodometro_acsess: false,
          resumo_access: false,
          comprovante_access: false,
          tags_access: true
        }])
        .select();

      if (error) {
        if (error.code === '23505') {
          toast.error('CNPJ já cadastrado no sistema.');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Empresa criada com sucesso!');
      setIsCreateModalOpen(false);
      fetchAccessControls();
      
      // Reset form
      setCompanyFormData({
        nome_company: '',
        cnpj: '',
        email: '',
        telefone: '',
        id_conta_wiseapp: ''
      });
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('Erro ao criar empresa');
    } finally {
      setCreatingCompany(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
            Acesso Administrativo
          </h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full px-4 py-2 border ${authError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {authError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{authError}</p>
              )}
            </div>
            
            <button
              onClick={handleAuthenticate}
              className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
              type="button"
            >
              <Lock size={18} />
              Autenticar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
              <Shield className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Controle de Acesso aos Módulos
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 flex items-center gap-2"
            >
              <Plus size={16} />
              Nova Empresa
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-800 dark:text-blue-300">Instruções</h3>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  Configure quais empresas têm acesso a cada módulo do sistema. O ID da conta WiseApp está associado a cada empresa.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ID da Conta WiseApp
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Checklist
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contratações
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Hodômetro
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Bomba
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Resumos em Grupo
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Minutas
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Romaneios
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Comprovantes
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tags
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Baú
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Operações
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Logs
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {accessControls.map((control, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {control.nome_company}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {control.id_conta_wiseapp || 'Não definido'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'checklist_access')}
                          className={`p-2 rounded-full ${
                            control.checklist_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'motorista_access')}
                          className={`p-2 rounded-full ${
                            control.motorista_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'hodometro_acsess')}
                          className={`p-2 rounded-full ${
                            control.hodometro_acsess
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'bomba_gasolina_access')}
                          className={`p-2 rounded-full ${
                            control.bomba_gasolina_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'resumo_access')}
                          className={`p-2 rounded-full ${
                            control.resumo_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'minuta_access')}
                          className={`p-2 rounded-full ${
                            control.minuta_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'romaneio_access')}
                          className={`p-2 rounded-full ${
                            control.romaneio_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                          data-testid={`button-toggle-romaneio-${index}`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'comprovante_access')}
                          className={`p-2 rounded-full ${
                            control.comprovante_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'tags_access')}
                          className={`p-2 rounded-full ${
                            control.tags_access === true
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'bau_access')}
                          className={`p-2 rounded-full ${
                            control.bau_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                          data-testid={`button-toggle-bau-${index}`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'operacoes_access')}
                          className={`p-2 rounded-full ${
                            control.operacoes_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                          data-testid={`button-toggle-operacoes-${index}`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleAccess(index, 'logs_access')}
                          className={`p-2 rounded-full ${
                            control.logs_access
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                          }`}
                          data-testid={`button-toggle-logs-${index}`}
                        >
                          <CheckCircle size={20} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          control.st_company
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                        }`}>
                          {control.st_company ? 'Ativo' : 'Desativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {accessControls.length === 0 && (
                    <tr>
                      <td colSpan={15} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma conta configurada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveChanges}
              disabled={saving || accessControls.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title={accessControls.length === 0 ? 'Nenhuma empresa para salvar' : 'Salvar alterações de acesso'}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Create Company Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Nova Empresa
                </h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  value={companyFormData.nome_company}
                  onChange={(e) => setCompanyFormData(prev => ({ ...prev, nome_company: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  value={companyFormData.cnpj}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 14) {
                      setCompanyFormData(prev => ({ ...prev, cnpj: value }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  placeholder="Digite apenas números"
                  maxLength={14}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={companyFormData.email}
                  onChange={(e) => setCompanyFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  value={companyFormData.telefone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      setCompanyFormData(prev => ({ ...prev, telefone: value }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Digite apenas números"
                  maxLength={11}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ID da Conta WiseApp *
                </label>
                <input
                  type="text"
                  value={companyFormData.id_conta_wiseapp}
                  onChange={(e) => setCompanyFormData(prev => ({ ...prev, id_conta_wiseapp: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                  disabled={creatingCompany}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={creatingCompany || !companyFormData.nome_company || !companyFormData.cnpj || !companyFormData.id_conta_wiseapp}
                >
                  {creatingCompany ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Criar Empresa
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;