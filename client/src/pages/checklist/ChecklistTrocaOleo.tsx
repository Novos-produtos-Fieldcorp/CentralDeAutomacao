import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useCompanyData } from '@/hooks/useCompanyData';
import { Droplets, Pencil, Trash2, Plus, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface TrocaOleoRecord {
  id: number;
  veiculo_id: number;
  company_id: number;
  intervalo_km: number;
  km_ultima_troca: string;
  km_aviso_antecipado: number;
  ativo: boolean;
  ultimo_aviso_km: string | null;
  placa: string | null;
  marca_veiculo: string | null;
  motorista_nome: string | null;
  motorista_telefone: string | null;
  km_atual: number | null;
  km_proxima_troca: number;
  km_restante: number | null;
  status: 'OK' | 'Atenção' | 'Vencido';
}

interface VeiculoOption {
  veiculo_id: number;
  placa: string | null;
  marca_veiculo: string | null;
}

const fmtKm = (n: number | null | undefined) => {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('pt-BR') + ' km';
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'OK') return (
    <span data-testid="badge-status-ok" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
      <CheckCircle2 className="w-3 h-3 mr-1" /> OK
    </span>
  );
  if (status === 'Atenção') return (
    <span data-testid="badge-status-atencao" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
      <AlertTriangle className="w-3 h-3 mr-1" /> Atenção
    </span>
  );
  return (
    <span data-testid="badge-status-vencido" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
      <AlertTriangle className="w-3 h-3 mr-1" /> Vencido
    </span>
  );
};

interface ModalFormData {
  veiculo_id: number | '';
  intervalo_km: number;
  km_ultima_troca: number;
  km_aviso_antecipado: number;
  ativo: boolean;
}

const defaultForm: ModalFormData = {
  veiculo_id: '',
  intervalo_km: 5000,
  km_ultima_troca: 0,
  km_aviso_antecipado: 500,
  ativo: true,
};

const getWiseAppToken = (): string | null => {
  try {
    const session = localStorage.getItem('wiseapp_session');
    if (!session) return null;
    const parsed = JSON.parse(session);
    if (Date.now() > parsed.expiresAt) return null;
    return parsed.token || null;
  } catch {
    return null;
  }
};

const trocaOleoRequest = (url: string, options: RequestInit = {}) => {
  const wiseappToken = getWiseAppToken();
  return apiRequest(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> || {}),
      ...(wiseappToken ? { 'wiseapp-token': wiseappToken } : {}),
    },
  });
};

const ChecklistTrocaOleo = () => {
  const { companyId } = useCompanyData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TrocaOleoRecord | null>(null);
  const [form, setForm] = useState<ModalFormData>(defaultForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: records = [], isLoading } = useQuery<TrocaOleoRecord[]>({
    queryKey: ['/api/troca-oleo', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await trocaOleoRequest(`/api/troca-oleo/${companyId}`);
      if (!res.ok) throw new Error('Erro ao buscar registros');
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: allVeiculos = [] } = useQuery<VeiculoOption[]>({
    queryKey: ['/api/veiculos-empresa', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await trocaOleoRequest(`/api/veiculos-empresa/${companyId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const configuredVeiculoIds = new Set(records.map(r => r.veiculo_id));
  const availableVeiculos = allVeiculos.filter(v => !configuredVeiculoIds.has(v.veiculo_id));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await trocaOleoRequest('/api/troca-oleo', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar registro');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/troca-oleo', companyId] });
      toast.success('Veículo adicionado com sucesso!');
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await trocaOleoRequest(`/api/troca-oleo/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar registro');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/troca-oleo', companyId] });
      toast.success('Registro atualizado!');
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await trocaOleoRequest(`/api/troca-oleo/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/troca-oleo', companyId] });
      toast.success('Registro excluído!');
      setDeleteConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendAlertsMutation = useMutation({
    mutationFn: async () => {
      const res = await trocaOleoRequest(`/api/troca-oleo/verificar/${companyId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao enviar avisos');
      return res.json();
    },
    onSuccess: (result: { sent: number; skipped: number; errors: string[] }) => {
      const msg = `Avisos enviados: ${result.sent} | Ignorados: ${result.skipped}`;
      if (result.errors.length > 0) {
        toast.error(`${msg} | Erros: ${result.errors.length}`);
      } else {
        toast.success(msg);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/troca-oleo', companyId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingRecord(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (record: TrocaOleoRecord) => {
    setEditingRecord(record);
    setForm({
      veiculo_id: record.veiculo_id,
      intervalo_km: record.intervalo_km,
      km_ultima_troca: parseFloat(record.km_ultima_troca),
      km_aviso_antecipado: record.km_aviso_antecipado,
      ativo: record.ativo,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    setForm(defaultForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      updateMutation.mutate({
        id: editingRecord.id,
        data: {
          intervalo_km: form.intervalo_km,
          km_ultima_troca: form.km_ultima_troca,
          km_aviso_antecipado: form.km_aviso_antecipado,
          ativo: form.ativo,
        },
      });
    } else {
      if (!form.veiculo_id) {
        toast.error('Selecione um veículo');
        return;
      }
      createMutation.mutate({
        veiculo_id: form.veiculo_id,
        company_id: companyId,
        intervalo_km: form.intervalo_km,
        km_ultima_troca: form.km_ultima_troca,
        km_aviso_antecipado: form.km_aviso_antecipado,
      });
    }
  };

  const handleRegistrarNovaTroca = () => {
    if (!editingRecord) return;
    const kmAtual = editingRecord.km_atual;
    if (kmAtual == null) {
      toast.error('Nenhuma leitura de odômetro disponível para este veículo');
      return;
    }
    setForm(prev => ({ ...prev, km_ultima_troca: Math.round(kmAtual) }));
    toast.success(`KM da última troca atualizado para ${Math.round(kmAtual).toLocaleString('pt-BR')} km`);
  };

  const countAtencao = records.filter(r => r.status === 'Atenção').length;
  const countVencido = records.filter(r => r.status === 'Vencido').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="loading-troca-oleo">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-300">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Droplets className="text-blue-500 w-6 h-6" />
            Troca de Óleo
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie alertas de troca de óleo por quilometragem para cada veículo
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            data-testid="button-enviar-avisos"
            onClick={() => sendAlertsMutation.mutate()}
            disabled={sendAlertsMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {sendAlertsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Enviar Avisos Agora
          </button>
          <button
            data-testid="button-adicionar-veiculo"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Veículo
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div data-testid="stat-configurados" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Veículos Configurados</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{records.length}</p>
        </div>
        <div data-testid="stat-atencao" className="bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-700 p-4 shadow-sm">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">Em Atenção</p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mt-1">{countAtencao}</p>
        </div>
        <div data-testid="stat-vencidos" className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-4 shadow-sm">
          <p className="text-sm text-red-600 dark:text-red-400">Vencidos</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{countVencido}</p>
        </div>
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div data-testid="empty-state" className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Droplets className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum veículo configurado</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Clique em "Adicionar Veículo" para começar</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Veículo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">KM Atual</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Última Troca</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Próxima Troca</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Restam</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Intervalo</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    data-testid={`row-troca-oleo-${record.id}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white uppercase">
                          {record.placa || '—'}
                        </span>
                        {record.marca_veiculo && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{record.marca_veiculo}</span>
                        )}
                      </div>
                      {record.motorista_nome && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{record.motorista_nome}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {record.km_atual != null ? fmtKm(record.km_atual) : <span className="text-gray-400 italic text-xs">Sem leitura</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmtKm(parseFloat(record.km_ultima_troca))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmtKm(record.km_proxima_troca)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {record.km_restante != null ? (
                        <span className={record.km_restante <= 0 ? 'text-red-600 dark:text-red-400 font-medium' : record.km_restante <= record.km_aviso_antecipado ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-gray-700 dark:text-gray-300'}>
                          {fmtKm(record.km_restante)}
                        </span>
                      ) : <span className="text-gray-400 italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {fmtKm(record.intervalo_km)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          data-testid={`button-edit-${record.id}`}
                          onClick={() => openEdit(record)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`button-delete-${record.id}`}
                          onClick={() => setDeleteConfirm(record.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-troca-oleo">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingRecord ? 'Editar Configuração' : 'Adicionar Veículo'}
              </h3>
              <button
                data-testid="button-close-modal"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingRecord && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Veículo
                  </label>
                  <select
                    data-testid="select-veiculo"
                    value={form.veiculo_id}
                    onChange={e => setForm(prev => ({ ...prev, veiculo_id: parseInt(e.target.value) || '' }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione um veículo...</option>
                    {availableVeiculos.map(v => (
                      <option key={v.veiculo_id} value={v.veiculo_id}>
                        {(v.placa || '').toUpperCase()} {v.marca_veiculo ? `— ${v.marca_veiculo}` : ''}
                      </option>
                    ))}
                  </select>
                  {availableVeiculos.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Todos os veículos já estão configurados</p>
                  )}
                </div>
              )}

              {editingRecord && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold uppercase">{editingRecord.placa || '—'}</span>
                  {editingRecord.marca_veiculo && <span className="ml-2 text-gray-500">{editingRecord.marca_veiculo}</span>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Intervalo (km)
                </label>
                <input
                  data-testid="input-intervalo-km"
                  type="number"
                  min={100}
                  value={form.intervalo_km}
                  onChange={e => setForm(prev => ({ ...prev, intervalo_km: parseInt(e.target.value) || 0 }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  KM da última troca
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="input-km-ultima-troca"
                    type="number"
                    min={0}
                    value={form.km_ultima_troca}
                    onChange={e => setForm(prev => ({ ...prev, km_ultima_troca: parseFloat(e.target.value) || 0 }))}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {editingRecord && (
                    <button
                      type="button"
                      data-testid="button-registrar-nova-troca"
                      onClick={handleRegistrarNovaTroca}
                      title="Registrar Nova Troca (usar KM atual)"
                      className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      Registrar Nova Troca
                    </button>
                  )}
                </div>
                {editingRecord && editingRecord.km_atual != null && (
                  <p className="text-xs text-gray-400 mt-1">KM atual do veículo: {Math.round(editingRecord.km_atual).toLocaleString('pt-BR')} km</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  KM de aviso antecipado
                </label>
                <input
                  data-testid="input-km-aviso-antecipado"
                  type="number"
                  min={0}
                  value={form.km_aviso_antecipado}
                  onChange={e => setForm(prev => ({ ...prev, km_aviso_antecipado: parseInt(e.target.value) || 0 }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Alertar quando restar este número de km para a troca</p>
              </div>

              {editingRecord && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ativo</label>
                  <button
                    type="button"
                    data-testid="toggle-ativo"
                    onClick={() => setForm(prev => ({ ...prev, ativo: !prev.ativo }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.ativo ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-xs text-gray-500">{form.ativo ? 'Alertas habilitados' : 'Alertas desabilitados'}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  data-testid="button-cancelar-modal"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="button-salvar-modal"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-delete-confirm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Tem certeza que deseja remover este veículo da lista de avisos de troca de óleo?
            </p>
            <div className="flex gap-3">
              <button
                data-testid="button-cancelar-delete"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                data-testid="button-confirmar-delete"
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistTrocaOleo;
