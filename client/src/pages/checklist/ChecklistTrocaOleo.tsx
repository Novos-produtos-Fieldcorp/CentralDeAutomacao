import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useCurrentAccount } from '@/hooks/useCurrentAccount';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Droplets, Pencil, Trash2, Plus, AlertTriangle, CheckCircle2, Loader2, RefreshCw, ExternalLink, Gauge, Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

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
  km_atual: number | null;
  km_proxima_troca: number;
  km_restante: number | null;
  status: 'OK' | 'Atenção' | 'Vencido';
  ultima_viagem_data: string | null;
}

interface AlertLog {
  id: number;
  company_id: number;
  veiculo_id: number;
  placa: string | null;
  km_atual: number | null;
  km_proxima_troca: number | null;
  km_restante: number | null;
  status: string;
  lido: boolean;
  created_at: string;
}

interface VeiculoOption {
  veiculo_id: number;
  placa: string | null;
  marca: string | null;
}

const fmtKm = (n: number | null | undefined) => {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('pt-BR') + ' km';
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd/MM/yyyy');
  } catch {
    return '—';
  }
};

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd/MM/yyyy HH:mm');
  } catch {
    return '—';
  }
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
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
      ...(wiseappToken ? { 'wiseapp-token': wiseappToken } : {}),
    },
  });
};

const ChecklistTrocaOleo = () => {
  const { companyId } = useCurrentAccount();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TrocaOleoRecord | null>(null);
  const [form, setForm] = useState<ModalFormData>(defaultForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [alertsBannerOpen, setAlertsBannerOpen] = useState(true);

  const numericCompanyId = companyId ? Number(companyId) : null;

  const { data: records = [], isLoading } = useQuery<TrocaOleoRecord[]>({
    queryKey: ['/api/troca-oleo', numericCompanyId],
    queryFn: async () => {
      if (!numericCompanyId) return [];

      const { data: baseRecords, error: baseErr } = await supabase
        .from('aviso_troca_oleo')
        .select('*')
        .eq('company_id', numericCompanyId);

      if (baseErr) throw baseErr;
      if (!baseRecords || baseRecords.length === 0) return [];

      const veiculoIds = [...new Set(baseRecords.map((r: any) => r.veiculo_id))];

      const [veiculosRes, hodsRes, viagensRes, ultimasViagensRes] = await Promise.all([
        supabase
          .from('veiculo')
          .select('veiculo_id, placa, marca, motorista_id')
          .in('veiculo_id', veiculoIds),
        supabase
          .from('hodometro')
          .select('veiculo_id, hod_informado')
          .in('veiculo_id', veiculoIds)
          .order('hod_informado', { ascending: false }),
        supabase
          .from('acompanhamento_viagem')
          .select('veiculo_id, km_final')
          .in('veiculo_id', veiculoIds)
          .not('km_final', 'is', null),
        supabase
          .from('acompanhamento_viagem')
          .select('veiculo_id, data_hora_inicial')
          .in('veiculo_id', veiculoIds)
          .order('data_hora_inicial', { ascending: false }),
      ]);

      const veiculoMap = new Map<number, any>(
        (veiculosRes.data || []).map((v: any) => [v.veiculo_id, v])
      );

      const hodKmMap = new Map<number, number>();
      for (const h of (hodsRes.data || [])) {
        const km = parseFloat(h.hod_informado);
        if (!isNaN(km) && (!hodKmMap.has(h.veiculo_id) || km > hodKmMap.get(h.veiculo_id)!)) {
          hodKmMap.set(h.veiculo_id, km);
        }
      }

      const viagemKmMap = new Map<number, number>();
      for (const v of (viagensRes.data || [])) {
        const km = parseFloat(v.km_final);
        if (!isNaN(km) && (!viagemKmMap.has(v.veiculo_id) || km > viagemKmMap.get(v.veiculo_id)!)) {
          viagemKmMap.set(v.veiculo_id, km);
        }
      }

      const ultimaViagemMap = new Map<number, string>();
      for (const v of (ultimasViagensRes.data || [])) {
        if (!ultimaViagemMap.has(v.veiculo_id) && v.data_hora_inicial) {
          ultimaViagemMap.set(v.veiculo_id, v.data_hora_inicial);
        }
      }

      return baseRecords.map((r: any) => {
        const veiculo = veiculoMap.get(r.veiculo_id);
        const hodKm = hodKmMap.get(r.veiculo_id) ?? null;
        const viagemKm = viagemKmMap.get(r.veiculo_id) ?? null;
        const km_atual = (hodKm !== null || viagemKm !== null)
          ? Math.max(hodKm ?? 0, viagemKm ?? 0)
          : null;

        const kmUltimaTroca = parseFloat(r.km_ultima_troca);
        const kmProximaTroca = kmUltimaTroca + r.intervalo_km;
        const kmRestante = km_atual !== null ? kmProximaTroca - km_atual : null;

        let status: 'OK' | 'Atenção' | 'Vencido' = 'OK';
        if (kmRestante !== null) {
          if (kmRestante <= 0) status = 'Vencido';
          else if (kmRestante <= r.km_aviso_antecipado) status = 'Atenção';
        }

        return {
          ...r,
          placa: veiculo?.placa || null,
          marca_veiculo: veiculo?.marca || null,
          motorista_nome: null,
          km_atual,
          km_proxima_troca: kmProximaTroca,
          km_restante: kmRestante,
          status,
          ultima_viagem_data: ultimaViagemMap.get(r.veiculo_id) || null,
        } as TrocaOleoRecord;
      });
    },
    enabled: !!numericCompanyId,
  });

  const { data: alertLogs = [], isLoading: alertsLoading } = useQuery<AlertLog[]>({
    queryKey: ['/api/oil-change-alerts', numericCompanyId],
    queryFn: async () => {
      if (!numericCompanyId) return [];
      const res = await trocaOleoRequest(`/api/troca-oleo/alertas/${numericCompanyId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!numericCompanyId,
  });

  const { data: allVeiculos = [] } = useQuery<VeiculoOption[]>({
    queryKey: ['/api/veiculos-empresa', numericCompanyId],
    queryFn: async () => {
      if (!numericCompanyId) return [];
      const { data, error } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa, marca')
        .eq('company_id', numericCompanyId)
        .eq('status_veiculo', true)
        .order('placa');
      if (error) {
        console.error('Erro ao buscar veículos:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!numericCompanyId,
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
      queryClient.invalidateQueries({ queryKey: ['/api/troca-oleo', numericCompanyId] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/troca-oleo', numericCompanyId] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/troca-oleo', numericCompanyId] });
      toast.success('Registro excluído!');
      setDeleteConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markAlertReadMutation = useMutation({
    mutationFn: async (alertId: number) => {
      const res = await trocaOleoRequest(`/api/troca-oleo/alertas/${alertId}/ler`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Erro ao marcar alerta como lido');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/oil-change-alerts', numericCompanyId] });
    },
  });

  const markAllAlertsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await trocaOleoRequest(`/api/troca-oleo/alertas/lerTodos/${numericCompanyId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao marcar alertas como lidos');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/oil-change-alerts', numericCompanyId] });
      toast.success('Todos os alertas marcados como lidos');
    },
  });

  const verificarMutation = useMutation({
    mutationFn: async () => {
      const res = await trocaOleoRequest(`/api/troca-oleo/verificar/${numericCompanyId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao verificar alertas');
      return res.json();
    },
    onSuccess: (result: { sent: number; skipped: number; errors: string[] }) => {
      const msg = result.sent > 0
        ? `${result.sent} alerta(s) gerado(s) | ${result.skipped} ignorado(s)`
        : `Nenhum alerta novo | ${result.skipped} veículo(s) OK`;
      if (result.errors.length > 0) {
        toast.error(`${msg} | ${result.errors.length} erro(s)`);
      } else {
        toast.success(msg);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/troca-oleo', numericCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/oil-change-alerts', numericCompanyId] });
      setAlertsBannerOpen(true);
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
        company_id: numericCompanyId,
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
  const unreadAlerts = alertLogs.filter(a => !a.lido);

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
            {unreadAlerts.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
                {unreadAlerts.length}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie alertas de troca de óleo por quilometragem para cada veículo
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            data-testid="button-verificar-agora"
            onClick={() => verificarMutation.mutate()}
            disabled={verificarMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {verificarMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Verificar Agora
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

      {/* Alerts Banner */}
      {alertsBannerOpen && unreadAlerts.length > 0 && (
        <div data-testid="alerts-banner" className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
              <Bell className="w-4 h-4 flex-shrink-0" />
              {unreadAlerts.length === 1
                ? '1 alerta de troca de óleo pendente'
                : `${unreadAlerts.length} alertas de troca de óleo pendentes`}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                data-testid="button-marcar-todos-lidos"
                onClick={() => markAllAlertsReadMutation.mutate()}
                disabled={markAllAlertsReadMutation.isPending}
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline"
              >
                Marcar todos como lido
              </button>
              <button
                data-testid="button-fechar-banner"
                onClick={() => setAlertsBannerOpen(false)}
                className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {unreadAlerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                data-testid={`alert-item-${alert.id}`}
                className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-sm border border-amber-100 dark:border-amber-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={alert.status} />
                  <span className="font-semibold text-gray-900 dark:text-white uppercase">
                    {alert.placa || '—'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 truncate">
                    KM atual: {fmtKm(alert.km_atual)} · Próxima: {fmtKm(alert.km_proxima_troca)}
                    {alert.km_restante !== null && alert.km_restante <= 0
                      ? ` · Vencido em ${fmtKm(Math.abs(alert.km_restante ?? 0))}`
                      : alert.km_restante !== null
                      ? ` · Restam ${fmtKm(alert.km_restante)}`
                      : ''}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{fmtDateTime(alert.created_at)}</span>
                </div>
                <button
                  data-testid={`button-marcar-lido-${alert.id}`}
                  onClick={() => markAlertReadMutation.mutate(alert.id)}
                  disabled={markAlertReadMutation.isPending}
                  className="flex-shrink-0 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline"
                >
                  Lido
                </button>
              </div>
            ))}
            {unreadAlerts.length > 5 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                + {unreadAlerts.length - 5} alertas adicionais
              </p>
            )}
          </div>
        </div>
      )}

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
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Última Viagem</th>
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
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 text-xs">
                      {fmtDate(record.ultima_viagem_data)}
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
                      <div className="flex items-center justify-center gap-1">
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
                        {record.placa && (
                          <Link
                            data-testid={`link-viagens-${record.id}`}
                            to={`/operacoes/viagens?placa=${encodeURIComponent(record.placa)}`}
                            className="p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                            title="Ver viagens deste veículo"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}
                        {record.placa && (
                          <Link
                            data-testid={`link-hodometros-${record.id}`}
                            to={`/hodometros?placa=${encodeURIComponent(record.placa)}`}
                            className="p-1.5 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            title="Ver hodômetros deste veículo"
                          >
                            <Gauge className="w-4 h-4" />
                          </Link>
                        )}
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
                        {(v.placa || '').toUpperCase()} {v.marca ? `— ${v.marca}` : ''}
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
