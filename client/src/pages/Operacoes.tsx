import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, Filter, Search, RefreshCw, ChevronDown, User, Truck, X, Clock, MapPin, Car, Package, FileText, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCurrentAccount } from '../hooks/useCurrentAccount';

interface Operacao {
  id: number;
  operacao: string;
  company_id: number;
}

interface Motorista {
  motorista_id: number;
  nome: string;
}

interface Veiculo {
  veiculo_id: number;
  placa: string;
}

interface ViagemBase {
  id: number;
  data_hora_inicial: string;
  km_inicial: string | null;
  motorista_id: number | null;
  ajudante_id: number | null;
  veiculo_id: number | null;
  km_final: string | null;
  data_hora_final: string | null;
  janta: boolean | null;
  cliente_id: number | null;
  hora_janta: string | null;
}

interface ViagemEnriquecida extends ViagemBase {
  motorista_nome?: string;
  veiculo_placa?: string;
  operacao_tipo?: string;
  operacao_dados?: any;
}

const OPERACOES_CONFIG: Record<string, { tabela: string; campos: { key: string; label: string }[] }> = {
  'Autoservice': {
    tabela: 'operacao_autoservice',
    campos: [
      { key: 'origem', label: 'Origem' },
      { key: 'destino', label: 'Destino' },
      { key: 'placa_veiculo', label: 'Placa Veículo' },
      { key: 'embarque', label: 'Embarque' },
      { key: 'nome_cliente', label: 'Nome Cliente' },
      { key: 'tel_cliente', label: 'Telefone Cliente' },
      { key: 'valor_frete', label: 'Valor Frete' },
      { key: 'destino_final', label: 'Destino Final' },
    ]
  },
  'Cesari': {
    tabela: 'operacao_cesari',
    campos: [
      { key: 'origem', label: 'Origem' },
      { key: 'destino', label: 'Destino' },
      { key: 'nr_manifesto', label: 'Nº Manifesto' },
      { key: 'ft_manifesto', label: 'Foto Manifesto' },
      { key: 'tipo_viagem', label: 'Tipo Viagem' },
      { key: 'pernoite', label: 'Pernoite' },
      { key: 'dia_nao_util', label: 'Dia Não Útil' },
      { key: 'v2_dt_hora', label: 'V2 Data/Hora' },
      { key: 'v2_origem', label: 'V2 Origem' },
      { key: 'v2_desitno', label: 'V2 Destino' },
      { key: 'v2_capacidade', label: 'V2 Capacidade' },
      { key: 'v2_nr_manifesto', label: 'V2 Nº Manifesto' },
      { key: 'v2_ft_manifesto', label: 'V2 Foto Manifesto' },
    ]
  },
  'Mitsubishi': {
    tabela: 'operacao_mitsubishi',
    campos: [
      { key: 'origem', label: 'Origem' },
      { key: 'destino', label: 'Destino' },
      { key: 'frota', label: 'Frota' },
      { key: 'tipo_carreta', label: 'Tipo Carreta' },
      { key: 'qtd_carro', label: 'Qtd Carros' },
      { key: 'modelo_carro', label: 'Modelo Carro' },
      { key: 'km_chegada_porto', label: 'KM Chegada Porto' },
      { key: 'data_hora_chegada_porto', label: 'Data/Hora Chegada Porto' },
    ]
  },
  'Sada': {
    tabela: 'operacao_sada',
    campos: [
      { key: 'origem', label: 'Origem' },
      { key: 'destino', label: 'Destino' },
      { key: 'destino2', label: 'Destino 2' },
      { key: 'tipo_carreta', label: 'Tipo Carreta' },
      { key: 'tipo_carga', label: 'Tipo Carga' },
      { key: 'frota', label: 'Frota' },
      { key: 'nr_viagem', label: 'Nº Viagem' },
      { key: 'qtd_carros', label: 'Qtd Carros' },
      { key: 'modelo', label: 'Modelo' },
    ]
  },
  'Superterminais': {
    tabela: 'operacao_superterminais',
    campos: [
      { key: 'embarque_desembarque', label: 'Embarque/Desembarque' },
      { key: 'nome_container', label: 'Nome Container' },
      { key: 'capacidade', label: 'Capacidade' },
      { key: 'nr_container', label: 'Nº Container' },
      { key: 'ft_tablet', label: 'Foto Tablet' },
      { key: 'fim_de_semana', label: 'Fim de Semana' },
    ]
  },
  'Tegma': {
    tabela: 'operacao_tegma',
    campos: [
      { key: 'tipo_viagem', label: 'Tipo Viagem' },
      { key: 'origem', label: 'Origem' },
      { key: 'destino', label: 'Destino' },
      { key: 'placa_carreta', label: 'Placa Carreta' },
      { key: 'nr_cautela', label: 'Nº Cautela' },
      { key: 'ft_cautela', label: 'Foto Cautela' },
      { key: 'nr_viagem', label: 'Nº Viagem' },
      { key: 'foto_viagem', label: 'Foto Viagem' },
      { key: 'empresa', label: 'Empresa' },
      { key: 'qtd_carros', label: 'Qtd Carros' },
      { key: 'veiculo_transportado', label: 'Veículo Transportado' },
      { key: 'placa_veiculo_transportado', label: 'Placa Veículo Transportado' },
      { key: 'retorno', label: 'Retorno' },
      { key: 'p2_origem', label: 'P2 Origem' },
      { key: 'p2_destino', label: 'P2 Destino' },
      { key: 'p2_placa_veiculo', label: 'P2 Placa Veículo' },
      { key: 'p2_nr_cautela', label: 'P2 Nº Cautela' },
      { key: 'p2_ft_cautela', label: 'P2 Foto Cautela' },
      { key: 'p2_data_hora', label: 'P2 Data/Hora' },
    ]
  },
};

const OPERACOES_TABELAS = Object.entries(OPERACOES_CONFIG).map(([nome, config]) => ({
  nome,
  tabela: config.tabela,
  campos: config.campos.map(c => c.key)
}));

const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (key.includes('data_hora') || key.includes('dt_hora')) {
    try {
      return new Date(value).toLocaleString('pt-BR');
    } catch {
      return String(value);
    }
  }
  if (key.includes('ft_') || key.includes('foto')) {
    return value ? 'Disponível' : '-';
  }
  return String(value);
};

const ViagemDetailModal = ({ 
  viagem, 
  onClose 
}: { 
  viagem: ViagemEnriquecida; 
  onClose: () => void;
}) => {
  const operacaoConfig = viagem.operacao_tipo ? OPERACOES_CONFIG[viagem.operacao_tipo] : null;

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const getOperacaoColor = (tipo: string | undefined) => {
    const colors: Record<string, string> = {
      'Autoservice': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Cesari': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Mitsubishi': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Sada': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Superterminais': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'Tegma': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[tipo || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Detalhes da Viagem #{viagem.id}
            </h2>
            {viagem.operacao_tipo && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOperacaoColor(viagem.operacao_tipo)}`}>
                {viagem.operacao_tipo}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Informações da Viagem
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Data/Hora Inicial</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(viagem.data_hora_inicial)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Data/Hora Final</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(viagem.data_hora_final)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    viagem.data_hora_final 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {viagem.data_hora_final ? 'Concluída' : 'Em Andamento'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Motorista</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{viagem.motorista_nome || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Veículo</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{viagem.veiculo_placa || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">KM Inicial</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{viagem.km_inicial || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">KM Final</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{viagem.km_final || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Janta</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {viagem.janta ? `Sim${viagem.hora_janta ? ` (${viagem.hora_janta})` : ''}` : 'Não'}
                  </p>
                </div>
              </div>
            </div>

            {viagem.operacao_tipo && operacaoConfig && viagem.operacao_dados && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Dados da Operação {viagem.operacao_tipo}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {operacaoConfig.campos.map((campo) => {
                    const value = viagem.operacao_dados[campo.key];
                    
                    return (
                      <div key={campo.key} data-testid={`field-${campo.key}`}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{campo.label}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatValue(campo.key, value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!viagem.operacao_tipo && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                <p className="text-yellow-700 dark:text-yellow-400">
                  Esta viagem não possui dados de operação específica vinculados.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const OperacoesDashboard = () => {
  const { companyId } = useCurrentAccount();

  const { data: operacoes = [] } = useQuery<Operacao[]>({
    queryKey: ['operacoes', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operacao')
        .select('*')
        .order('operacao');
      
      if (error) {
        console.warn('Erro ao buscar operações:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: viagensStats } = useQuery({
    queryKey: ['viagens-stats', companyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.warn('Tabela acompanhamento_viagem não acessível:', error);
        return { total: 0 };
      }
      return { total: count || 0 };
    },
    enabled: !!companyId,
  });

  const { data: operacoesStats = [] } = useQuery({
    queryKey: ['operacoes-stats'],
    queryFn: async () => {
      const stats = await Promise.all(
        OPERACOES_TABELAS.map(async (op) => {
          const { count, error } = await supabase
            .from(op.tabela)
            .select('*', { count: 'exact', head: true });
          
          return {
            nome: op.nome,
            total: error ? 0 : (count || 0)
          };
        })
      );
      return stats;
    },
    enabled: !!companyId,
  });

  const { data: viagensHistograma = [] } = useQuery({
    queryKey: ['viagens-histograma', companyId],
    queryFn: async () => {
      const hoje = new Date();
      const dataInicio = new Date(hoje);
      dataInicio.setDate(dataInicio.getDate() - 29);
      
      const { data, error } = await supabase
        .from('acompanhamento_viagem')
        .select('id, data_hora_inicial')
        .gte('data_hora_inicial', dataInicio.toISOString())
        .order('data_hora_inicial', { ascending: true });
      
      if (error) {
        console.warn('Erro ao buscar histograma:', error);
        return [];
      }
      
      const diasMap: Record<string, { data: string; total: number; diaSemana: string }> = {};
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      
      for (let i = 0; i < 30; i++) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - (29 - i));
        const key = d.toISOString().split('T')[0];
        diasMap[key] = { 
          data: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
          total: 0,
          diaSemana: diasSemana[d.getDay()]
        };
      }
      
      (data || []).forEach((v: any) => {
        if (v.data_hora_inicial) {
          const key = v.data_hora_inicial.split('T')[0];
          if (diasMap[key]) {
            diasMap[key].total++;
          }
        }
      });
      
      return Object.values(diasMap);
    },
    enabled: !!companyId,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Map className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total de Viagens</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{viagensStats?.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Operações Ativas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{OPERACOES_TABELAS.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Viagens Hoje</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">-</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Truck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Concluídas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">-</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Viagens - Últimos 30 Dias</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Histórico diário de viagens realizadas</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {viagensHistograma.reduce((acc, d) => acc + d.total, 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total período</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {viagensHistograma.length > 0 
                    ? (viagensHistograma.reduce((acc, d) => acc + d.total, 0) / viagensHistograma.length).toFixed(1) 
                    : '0'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Média/dia</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {Math.max(...viagensHistograma.map(d => d.total), 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pico</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {(() => {
            const totalViagens = viagensHistograma.reduce((acc, d) => acc + d.total, 0);
            const maxValue = Math.max(...viagensHistograma.map(d => d.total), 1);
            
            if (totalViagens === 0) {
              return (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma viagem nos últimos 30 dias</p>
                </div>
              );
            }
            
            return (
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-1 h-48">
                  {viagensHistograma.map((dia, index) => {
                    const heightPercent = (dia.total / maxValue) * 100;
                    const isWeekend = dia.diaSemana === 'Sáb' || dia.diaSemana === 'Dom';
                    const isToday = index === viagensHistograma.length - 1;
                    
                    return (
                      <div 
                        key={index} 
                        className="flex-1 flex flex-col items-center group relative"
                        title={`${dia.data} (${dia.diaSemana}): ${dia.total} viagens`}
                      >
                        <div className="w-full flex flex-col items-center justify-end h-40">
                          <div 
                            className={`w-full max-w-[20px] rounded-t-sm transition-all duration-300 ${
                              isToday 
                                ? 'bg-gradient-to-t from-blue-600 to-blue-400' 
                                : isWeekend 
                                  ? 'bg-gradient-to-t from-gray-400 to-gray-300 dark:from-gray-600 dark:to-gray-500' 
                                  : 'bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-500'
                            } group-hover:opacity-80`}
                            style={{ height: `${Math.max(heightPercent, dia.total > 0 ? 8 : 2)}%` }}
                          />
                        </div>
                        
                        <div className="invisible group-hover:visible absolute -top-8 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {dia.data}: {dia.total} viagens
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>{viagensHistograma[0]?.data}</span>
                  <span className="text-center">15 dias atrás</span>
                  <span>{viagensHistograma[viagensHistograma.length - 1]?.data} (Hoje)</span>
                </div>
                
                <div className="flex items-center justify-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-blue-500 to-blue-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Dias úteis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-gray-400 to-gray-300 dark:from-gray-600 dark:to-gray-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Fim de semana</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-blue-600 to-blue-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Hoje</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {operacoes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Operações Personalizadas</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{operacoes.length} operações cadastradas</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {operacoes.map((op, index) => {
                const colors = [
                  'from-blue-500 to-blue-600',
                  'from-green-500 to-green-600',
                  'from-purple-500 to-purple-600',
                  'from-orange-500 to-orange-600',
                  'from-pink-500 to-pink-600',
                  'from-teal-500 to-teal-600',
                  'from-indigo-500 to-indigo-600',
                  'from-red-500 to-red-600',
                ];
                const bgColor = colors[index % colors.length];
                
                return (
                  <div
                    key={op.id}
                    className="group relative bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                    data-testid={`operacao-card-${op.id}`}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r ${bgColor}`} />
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${bgColor} flex items-center justify-center shadow-sm`}>
                        <span className="text-white text-sm font-bold">{op.operacao.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{op.operacao}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">ID: {op.id}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OperacoesViagens = () => {
  const { companyId } = useCurrentAccount();
  const [selectedOperacao, setSelectedOperacao] = useState<string>('all');
  const [selectedMotorista, setSelectedMotorista] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOperacaoDropdownOpen, setIsOperacaoDropdownOpen] = useState(false);
  const [isMotoristaDropdownOpen, setIsMotoristaDropdownOpen] = useState(false);
  const [selectedViagem, setSelectedViagem] = useState<ViagemEnriquecida | null>(null);

  const { data: motoristas = [] } = useQuery<Motorista[]>({
    queryKey: ['motoristas-operacoes', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .order('nome');
      
      if (error) {
        console.warn('Erro ao buscar motoristas:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: veiculos = [] } = useQuery<Veiculo[]>({
    queryKey: ['veiculos-operacoes', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .eq('company_id', companyId)
        .order('placa');
      
      if (error) {
        console.warn('Erro ao buscar veículos:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: viagens = [], isLoading } = useQuery<ViagemBase[]>({
    queryKey: ['viagens', companyId, selectedMotorista],
    queryFn: async () => {
      let query = supabase
        .from('acompanhamento_viagem')
        .select('*')
        .order('data_hora_inicial', { ascending: false })
        .limit(100);

      if (selectedMotorista !== 'all') {
        query = query.eq('motorista_id', parseInt(selectedMotorista));
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.warn('Erro ao buscar viagens:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!companyId,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const { data: operacoesData = {} } = useQuery({
    queryKey: ['operacoes-viagens-data', viagens.map(v => v.id).join(',')],
    queryFn: async () => {
      if (viagens.length === 0) return {};
      
      const viagemIds = viagens.map(v => v.id);
      const operacoesMap: Record<number, { tipo: string; dados: any }> = {};
      
      await Promise.all(
        OPERACOES_TABELAS.map(async (op) => {
          const { data, error } = await supabase
            .from(op.tabela)
            .select('*')
            .in('id_viagem', viagemIds);
          
          if (!error && data) {
            data.forEach((item: any) => {
              operacoesMap[item.id_viagem] = {
                tipo: op.nome,
                dados: item
              };
            });
          }
        })
      );
      
      return operacoesMap;
    },
    enabled: viagens.length > 0,
  });

  const viagensEnriquecidas = useMemo<ViagemEnriquecida[]>(() => {
    return viagens.map(viagem => {
      const motorista = motoristas.find(m => m.motorista_id === viagem.motorista_id);
      const veiculo = veiculos.find(v => v.veiculo_id === viagem.veiculo_id);
      const operacaoInfo = operacoesData[viagem.id];
      
      return {
        ...viagem,
        motorista_nome: motorista?.nome,
        veiculo_placa: veiculo?.placa,
        operacao_tipo: operacaoInfo?.tipo,
        operacao_dados: operacaoInfo?.dados
      };
    });
  }, [viagens, motoristas, veiculos, operacoesData]);

  const filteredViagens = useMemo(() => {
    return viagensEnriquecidas.filter(viagem => {
      if (selectedOperacao !== 'all' && viagem.operacao_tipo !== selectedOperacao) {
        return false;
      }
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        
        // Busca em campos base
        let matchesSearch = 
          viagem.motorista_nome?.toLowerCase().includes(search) ||
          viagem.veiculo_placa?.toLowerCase().includes(search) ||
          viagem.operacao_tipo?.toLowerCase().includes(search) ||
          String(viagem.id).includes(search);
        
        // Busca em todos os campos da operação
        if (!matchesSearch && viagem.operacao_dados) {
          matchesSearch = Object.values(viagem.operacao_dados).some(value => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(search);
          });
        }
        
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  }, [viagensEnriquecidas, selectedOperacao, searchTerm]);

  const getMotoristaName = (id: string) => {
    if (id === 'all') return 'Todos os Motoristas';
    const motorista = motoristas.find(m => m.motorista_id.toString() === id);
    return motorista?.nome || 'Motorista';
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getOperacaoColor = (tipo: string | undefined) => {
    const colors: Record<string, string> = {
      'Autoservice': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Cesari': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Mitsubishi': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Sada': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Superterminais': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'Tegma': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[tipo || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por motorista, placa, origem ou destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="input-search-viagens"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsOperacaoDropdownOpen(!isOperacaoDropdownOpen);
                setIsMotoristaDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 min-w-[180px] justify-between"
              data-testid="button-filter-operacao"
            >
              <Filter className="w-4 h-4" />
              <span className="truncate">
                {selectedOperacao === 'all' ? 'Todas Operações' : selectedOperacao}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOperacaoDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOperacaoDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedOperacao('all');
                    setIsOperacaoDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedOperacao === 'all' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  Todas Operações
                </button>
                {OPERACOES_TABELAS.map((op) => (
                  <button
                    key={op.nome}
                    onClick={() => {
                      setSelectedOperacao(op.nome);
                      setIsOperacaoDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedOperacao === op.nome ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {op.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsMotoristaDropdownOpen(!isMotoristaDropdownOpen);
                setIsOperacaoDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 min-w-[180px] justify-between"
              data-testid="button-filter-motorista"
            >
              <User className="w-4 h-4" />
              <span className="truncate">
                {getMotoristaName(selectedMotorista)}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isMotoristaDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMotoristaDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedMotorista('all');
                    setIsMotoristaDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedMotorista === 'all' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  Todos os Motoristas
                </button>
                {motoristas.map((motorista) => (
                  <button
                    key={motorista.motorista_id}
                    onClick={() => {
                      setSelectedMotorista(motorista.motorista_id.toString());
                      setIsMotoristaDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedMotorista === motorista.motorista_id.toString() ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {motorista.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Carregando viagens...
          </div>
        ) : filteredViagens.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhuma viagem encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora Inicial</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Operação</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Destino</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredViagens.map((viagem) => (
                  <tr 
                    key={viagem.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedViagem(viagem)}
                    data-testid={`row-viagem-${viagem.id}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{viagem.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDateTime(viagem.data_hora_inicial)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {viagem.operacao_tipo ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOperacaoColor(viagem.operacao_tipo)}`}>
                          {viagem.operacao_tipo}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{viagem.motorista_nome || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{viagem.veiculo_placa || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {viagem.operacao_dados?.origem || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {viagem.operacao_dados?.destino || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        viagem.data_hora_final 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {viagem.data_hora_final ? 'Concluída' : 'Em Andamento'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedViagem && (
        <ViagemDetailModal 
          viagem={selectedViagem} 
          onClose={() => setSelectedViagem(null)} 
        />
      )}
    </div>
  );
};

const Operacoes = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { path: '/operacoes', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/operacoes/viagens', label: 'Viagens', icon: Map },
  ];

  const isActiveTab = (path: string) => {
    if (path === '/operacoes') {
      return currentPath === '/operacoes' || currentPath === '/operacoes/';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Operações</h1>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActiveTab(tab.path)
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
              data-testid={`tab-${tab.label.toLowerCase()}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <Routes>
        <Route path="/" element={<OperacoesDashboard />} />
        <Route path="/viagens" element={<OperacoesViagens />} />
      </Routes>
    </div>
  );
};

export default Operacoes;
