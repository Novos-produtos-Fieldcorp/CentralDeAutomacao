import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, Filter, Search, RefreshCw, ChevronDown, User, Truck, X, Clock, MapPin, Car, Package, FileText, TrendingUp, Image, Ship, Building, CheckCircle, XCircle, Moon, Calendar, Phone, DollarSign, Hash, Navigation, Check, Layers, Factory, Container, Boxes } from 'lucide-react';
import { useState as useStateReact } from 'react';
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
  ajudante_nome?: string;
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
      { key: 'v2_dt_hora', label: '2ª Viagem Data/Hora' },
      { key: 'v2_origem', label: '2ª Viagem Origem' },
      { key: 'v2_destino', label: '2ª Viagem Destino' },
      { key: 'v2_capacidade', label: '2ª Viagem Capacidade' },
      { key: 'v2_nr_manifesto', label: '2ª Viagem Nº Manifesto' },
      { key: 'v2_ft_manifesto', label: '2ª Viagem Foto Manifesto' },
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
      { key: 'nome_navio', label: 'Nome Navio' },
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

const translateValue = (key: string, value: any): { text: string; type: 'text' | 'badge' | 'photo' } => {
  if (value === null || value === undefined) return { text: '-', type: 'text' };
  
  // Tradução de códigos numéricos
  if (key === 'tipo_carreta') {
    return { text: value === 0 ? 'Prancha' : value === 1 ? 'Cegonha' : String(value), type: 'badge' };
  }
  if (key === 'capacidade' || key === 'v2_capacidade') {
    const capacidadeTexto = value === 0 ? 'Vazio' : value === 1 ? 'Cheio' : value === 2 ? 'Manobra' : String(value);
    return { text: capacidadeTexto, type: 'badge' };
  }
  if (key === 'embarque_desembarque') {
    return { text: value === 0 ? 'Embarque' : value === 1 ? 'Desembarque' : String(value), type: 'badge' };
  }
  
  // Campos booleanos
  if (typeof value === 'boolean' || key === 'pernoite' || key === 'dia_nao_util' || key === 'fim_de_semana' || key === 'retorno') {
    return { text: value ? 'Sim' : 'Não', type: 'badge' };
  }
  
  // Campos de data/hora
  if (key.includes('data_hora') || key.includes('dt_hora') || key === 'v2_dt_hora') {
    try {
      return { text: new Date(value).toLocaleString('pt-BR'), type: 'text' };
    } catch {
      return { text: String(value), type: 'text' };
    }
  }
  
  // Campos de foto
  if (key.includes('ft_') || key.includes('foto')) {
    return { text: value || '', type: 'photo' };
  }
  
  return { text: String(value), type: 'text' };
};

const PhotoThumbnail = ({ url, label }: { url: string; label: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  if (!url || hasError) {
    return (
      <div className="w-full h-24 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center">
        <Image className="w-6 h-6 text-gray-400" />
      </div>
    );
  }
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full h-24 bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden hover:opacity-80 transition-opacity relative group"
      >
        <img 
          src={url} 
          alt={label}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs">Ampliar</span>
        </div>
      </button>
      
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img 
              src={url} 
              alt={label}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setIsOpen(false)}
              className="absolute -top-3 -right-3 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const BooleanBadge = ({ value, trueLabel = 'Sim', falseLabel = 'Não' }: { value: boolean; trueLabel?: string; falseLabel?: string }) => {
  return value ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle className="w-3 h-3" />
      {trueLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
      <XCircle className="w-3 h-3" />
      {falseLabel}
    </span>
  );
};

const ViagemDetailModal = ({ 
  viagem, 
  onClose 
}: { 
  viagem: ViagemEnriquecida; 
  onClose: () => void;
}) => {
  const dados = viagem.operacao_dados || {};

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const getOperacaoColor = (tipo: string | undefined) => {
    const colors: Record<string, { bg: string; gradient: string }> = {
      'Autoservice': { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', gradient: 'from-blue-500 to-blue-600' },
      'Cesari': { bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', gradient: 'from-green-500 to-green-600' },
      'Mitsubishi': { bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', gradient: 'from-red-500 to-red-600' },
      'Sada': { bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', gradient: 'from-yellow-500 to-yellow-600' },
      'Superterminais': { bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', gradient: 'from-purple-500 to-purple-600' },
      'Tegma': { bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', gradient: 'from-orange-500 to-orange-600' },
    };
    return colors[tipo || ''] || { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400', gradient: 'from-gray-500 to-gray-600' };
  };

  const operacaoColors = getOperacaoColor(viagem.operacao_tipo);

  // Componente para seção
  const Section = ({ title, icon: Icon, children, className = '' }: { title: string; icon: any; children: React.ReactNode; className?: string }) => (
    <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  // Componente para campo
  const Field = ({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) => (
    <div className={className}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{value || '-'}</div>
    </div>
  );

  // Renderização específica por operação
  const renderAutoservice = () => (
    <div className="space-y-4">
      <Section title="Rota" icon={Navigation}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Origem" value={dados.origem} />
          <Field label="Destino" value={dados.destino} />
          <Field label="Local de Embarque" value={dados.embarque} />
          <Field label="Destino Final" value={dados.destino_final} />
        </div>
      </Section>
      
      <Section title="Cliente" icon={User}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Nome do Cliente" value={dados.nome_cliente} />
          <Field label="Telefone" value={dados.tel_cliente ? (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {dados.tel_cliente}
            </span>
          ) : '-'} />
          <Field label="Valor do Frete" value={dados.valor_frete ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <DollarSign className="w-3 h-3" />
              {dados.valor_frete}
            </span>
          ) : '-'} />
        </div>
      </Section>
      
      <Section title="Veículo Transportado" icon={Car}>
        <Field label="Placa do Veículo" value={dados.placa_veiculo} />
      </Section>
    </div>
  );

  const renderCesari = () => (
    <div className="space-y-4">
      <Section title="1ª Viagem" icon={Navigation}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Origem" value={dados.origem} />
          <Field label="Destino" value={dados.destino} />
          <Field label="Nº Manifesto" value={dados.nr_manifesto ? (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {dados.nr_manifesto}
            </span>
          ) : '-'} />
        </div>
        {dados.ft_manifesto && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Foto do Manifesto</p>
            <PhotoThumbnail url={dados.ft_manifesto} label="Manifesto 1" />
          </div>
        )}
      </Section>
      
      {(dados.v2_origem || dados.v2_desitno) && (
        <Section title="2ª Viagem" icon={Navigation}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Data/Hora" value={dados.v2_dt_hora ? new Date(dados.v2_dt_hora).toLocaleString('pt-BR') : '-'} />
            <Field label="Origem" value={dados.v2_origem} />
            <Field label="Destino" value={dados.v2_destino} />
            <Field label="Capacidade" value={
              dados.v2_capacidade !== null && dados.v2_capacidade !== undefined ? (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  dados.v2_capacidade === 1 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : dados.v2_capacidade === 2
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {dados.v2_capacidade === 0 ? 'Vazio' : dados.v2_capacidade === 1 ? 'Cheio' : dados.v2_capacidade === 2 ? 'Manobra' : dados.v2_capacidade}
                </span>
              ) : '-'
            } />
            <Field label="Nº Manifesto" value={dados.v2_nr_manifesto} />
          </div>
          {dados.v2_ft_manifesto && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Foto do Manifesto</p>
              <PhotoThumbnail url={dados.v2_ft_manifesto} label="Manifesto 2" />
            </div>
          )}
        </Section>
      )}
      
      <Section title="Informações Adicionais" icon={Calendar}>
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pernoite</p>
            <BooleanBadge value={dados.pernoite} />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fim de Semana/Feriado</p>
            <BooleanBadge value={dados.dia_nao_util} trueLabel="Sim" falseLabel="Dia útil" />
          </div>
        </div>
      </Section>
    </div>
  );

  const renderMitsubishi = () => (
    <div className="space-y-4">
      <Section title="Rota" icon={Navigation}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Origem" value={dados.origem} />
          <Field label="Destino" value={dados.destino} />
          <Field label="Frota" value={dados.frota} />
        </div>
      </Section>
      
      <Section title="Veículos" icon={Truck}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Tipo de Carreta" value={
            dados.tipo_carreta !== null && dados.tipo_carreta !== undefined ? (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                dados.tipo_carreta === 1 
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                {dados.tipo_carreta === 1 ? 'Cegonha' : 'Prancha'}
              </span>
            ) : '-'
          } />
          <Field label="Quantidade de Carros" value={dados.qtd_carro} />
          <Field label="Modelo do Carro" value={dados.modelo_carro} />
          <Field label="KM Chegada Porto" value={dados.km_chegada_porto} />
        </div>
      </Section>
    </div>
  );

  const renderSada = () => (
    <div className="space-y-4">
      <Section title="Rota" icon={Navigation}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Origem" value={dados.origem} />
          <Field label="Destino" value={dados.destino} />
          <Field label="Frota" value={dados.frota} />
          <Field label="Nº Viagem" value={dados.nr_viagem ? (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {dados.nr_viagem}
            </span>
          ) : '-'} />
          <Field label="Tipo de Carga" value={dados.tipo_carga} />
        </div>
      </Section>
      
      <Section title="Veículos" icon={Truck}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Tipo de Carreta" value={
            dados.tipo_carreta !== null && dados.tipo_carreta !== undefined ? (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                dados.tipo_carreta === 1 
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                {dados.tipo_carreta === 1 ? 'Cegonha' : 'Prancha'}
              </span>
            ) : '-'
          } />
          <Field label="Quantidade de Carros" value={dados.qtd_carros} />
          <Field label="Modelo" value={dados.modelo} />
        </div>
      </Section>
    </div>
  );

  const renderSuperterminais = () => (
    <div className="space-y-4">
      <Section title="Operação Portuária" icon={Ship}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Tipo" value={
            dados.embarque_desembarque !== null && dados.embarque_desembarque !== undefined ? (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                dados.embarque_desembarque === 0 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {dados.embarque_desembarque === 0 ? 'Embarque' : 'Desembarque'}
              </span>
            ) : '-'
          } />
          <Field label="Nome do Navio" value={dados.nome_navio} />
          <Field label="Capacidade" value={
            dados.capacidade !== null && dados.capacidade !== undefined ? (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                dados.capacidade === 1 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : dados.capacidade === 2
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {dados.capacidade === 0 ? 'Vazio' : dados.capacidade === 1 ? 'Cheio' : dados.capacidade === 2 ? 'Manobra' : dados.capacidade}
              </span>
            ) : '-'
          } />
          <Field label="Nº Container" value={dados.nr_container ? (
            <span className="flex items-center gap-1 font-mono">
              <Package className="w-3 h-3" />
              {dados.nr_container}
            </span>
          ) : '-'} />
        </div>
      </Section>
      
      <Section title="Informações Adicionais" icon={Calendar}>
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Diária de Fim de Semana</p>
            <BooleanBadge value={dados.fim_de_semana} />
          </div>
        </div>
      </Section>
      
      {dados.ft_tablet && (
        <Section title="Foto do Tablet" icon={Image}>
          <PhotoThumbnail url={dados.ft_tablet} label="Foto do Tablet" />
        </Section>
      )}
    </div>
  );

  const renderTegma = () => (
    <div className="space-y-4">
      <Section title="Tipo de Viagem" icon={Truck}>
        <Field label="Tipo" value={
          dados.tipo_viagem ? (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
              {dados.tipo_viagem}
            </span>
          ) : '-'
        } />
      </Section>
      
      <Section title="1ª Puxada" icon={Navigation}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Origem" value={dados.origem} />
          <Field label="Destino" value={dados.destino} />
          <Field label="Placa da Carreta" value={dados.placa_carreta} />
          <Field label="Nº Cautela" value={dados.nr_cautela ? (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {dados.nr_cautela}
            </span>
          ) : '-'} />
          <Field label="Nº Viagem" value={dados.nr_viagem} />
          <Field label="Empresa" value={dados.empresa} />
          <Field label="Qtd. Carros" value={dados.qtd_carros} />
        </div>
        {dados.ft_cautela && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Foto da Cautela</p>
            <PhotoThumbnail url={dados.ft_cautela} label="Cautela 1" />
          </div>
        )}
      </Section>
      
      {(dados.p2_origem || dados.p2_destino) && (
        <Section title="2ª Puxada" icon={Navigation}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Origem" value={dados.p2_origem} />
            <Field label="Destino" value={dados.p2_destino} />
            <Field label="Placa do Veículo" value={dados.p2_placa_veiculo} />
            <Field label="Veículo Transportado" value={dados.veiculo_transportado} />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Retorno</p>
              <BooleanBadge value={dados.retorno} />
            </div>
          </div>
        </Section>
      )}
      
      {dados.foto_viagem && (
        <Section title="Foto da Viagem" icon={Image}>
          <PhotoThumbnail url={dados.foto_viagem} label="Foto da Viagem" />
        </Section>
      )}
    </div>
  );

  const renderOperacaoContent = () => {
    if (!viagem.operacao_tipo || !viagem.operacao_dados) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
          <p className="text-yellow-700 dark:text-yellow-400">
            Esta viagem não possui dados de operação específica vinculados.
          </p>
        </div>
      );
    }

    switch (viagem.operacao_tipo) {
      case 'Autoservice': return renderAutoservice();
      case 'Cesari': return renderCesari();
      case 'Mitsubishi': return renderMitsubishi();
      case 'Sada': return renderSada();
      case 'Superterminais': return renderSuperterminais();
      case 'Tegma': return renderTegma();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com gradiente */}
        <div className={`bg-gradient-to-r ${operacaoColors.gradient} p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">#{viagem.id}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Detalhes da Viagem
                </h2>
                {viagem.operacao_tipo && (
                  <span className="text-white/80 text-sm">
                    Operação {viagem.operacao_tipo}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              data-testid="button-close-modal"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-4">
            {/* Informações básicas da viagem */}
            <Section title="Informações da Viagem" icon={Clock}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Data/Hora Inicial" value={formatDateTime(viagem.data_hora_inicial)} />
                <Field label="Data/Hora Final" value={formatDateTime(viagem.data_hora_final)} />
                <Field label="Status" value={
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    viagem.data_hora_final 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {viagem.data_hora_final ? 'Concluída' : 'Em Andamento'}
                  </span>
                } />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Janta</p>
                  <BooleanBadge value={viagem.janta || false} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <Field label="Motorista" value={
                  viagem.motorista_nome ? (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {viagem.motorista_nome}
                    </span>
                  ) : '-'
                } />
                <Field label="Veículo" value={
                  viagem.veiculo_placa ? (
                    <span className="flex items-center gap-1 font-mono">
                      <Truck className="w-3 h-3" />
                      {viagem.veiculo_placa}
                    </span>
                  ) : '-'
                } />
                <Field label="KM Inicial" value={viagem.km_inicial} />
                <Field label="KM Final" value={viagem.km_final} />
              </div>
            </Section>

            {/* Conteúdo específico da operação */}
            {renderOperacaoContent()}
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

const DASHBOARD_OPERATIONS = [
  { id: 'all', nome: 'Todas', descricao: 'Visualizar todos', icon: Layers, cor: 'from-blue-600 to-indigo-700', bgLight: 'bg-gradient-to-br from-blue-50 to-indigo-100', bgDark: 'dark:bg-gradient-to-br dark:from-blue-900/30 dark:to-indigo-900/40', borderColor: 'border-blue-300 dark:border-blue-700' },
  { id: 'sada', nome: 'SADA', descricao: 'Transporte veicular', icon: Car, cor: 'from-yellow-500 to-amber-600', bgLight: 'bg-gradient-to-br from-yellow-50 to-amber-100', bgDark: 'dark:bg-gradient-to-br dark:from-yellow-900/30 dark:to-amber-900/40', borderColor: 'border-yellow-300 dark:border-yellow-700' },
  { id: 'tegma', nome: 'TEGMA', descricao: 'Logística automotiva', icon: Truck, cor: 'from-orange-500 to-red-600', bgLight: 'bg-gradient-to-br from-orange-50 to-red-100', bgDark: 'dark:bg-gradient-to-br dark:from-orange-900/30 dark:to-red-900/40', borderColor: 'border-orange-300 dark:border-orange-700' },
  { id: 'superterminais', nome: 'Super Terminais', descricao: 'Operação portuária', icon: Container, cor: 'from-purple-500 to-indigo-600', bgLight: 'bg-gradient-to-br from-purple-50 to-indigo-100', bgDark: 'dark:bg-gradient-to-br dark:from-purple-900/30 dark:to-indigo-900/40', borderColor: 'border-purple-300 dark:border-purple-700' },
  { id: 'cesari', nome: 'CESARI', descricao: 'Distribuição', icon: Boxes, cor: 'from-green-500 to-emerald-600', bgLight: 'bg-gradient-to-br from-green-50 to-emerald-100', bgDark: 'dark:bg-gradient-to-br dark:from-green-900/30 dark:to-emerald-900/40', borderColor: 'border-green-300 dark:border-green-700' },
];

type HistogramaPeriodo = '30d' | '15d' | '7d' | '1d' | 'custom';

const PERIODOS_HISTOGRAMA = [
  { id: '30d' as HistogramaPeriodo, label: '30 dias', dias: 30 },
  { id: '15d' as HistogramaPeriodo, label: '15 dias', dias: 15 },
  { id: '7d' as HistogramaPeriodo, label: '7 dias', dias: 7 },
  { id: '1d' as HistogramaPeriodo, label: 'Hoje', dias: 1 },
  { id: 'custom' as HistogramaPeriodo, label: 'Personalizado', dias: 0 },
];

const OperacoesDashboard = () => {
  const { companyId } = useCurrentAccount();
  const [selectedOperation, setSelectedOperation] = useState<string>('all');
  const [histogramaPeriodo, setHistogramaPeriodo] = useState<HistogramaPeriodo>('30d');
  const [histogramaDataInicio, setHistogramaDataInicio] = useState<string>('');
  const [histogramaDataFim, setHistogramaDataFim] = useState<string>('');
  const [isPeriodoExpanded, setIsPeriodoExpanded] = useState(false);

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
      // Buscar total de viagens
      const { count: totalCount, error: totalError } = await supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      
      if (totalError) {
        console.warn('Tabela acompanhamento_viagem não acessível:', totalError);
        return { total: 0, hoje: 0, concluidas: 0, emAndamento: 0 };
      }

      // Viagens de hoje
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1).toISOString();
      
      const { count: hojeCount } = await supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('data_hora_inicial', inicioHoje)
        .lt('data_hora_inicial', fimHoje);

      // Viagens concluídas (com data_hora_final preenchida)
      const { count: concluidasCount } = await supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('data_hora_final', 'is', null);

      // Viagens em andamento (sem data_hora_final)
      const { count: emAndamentoCount } = await supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('data_hora_final', null);

      return { 
        total: totalCount || 0, 
        hoje: hojeCount || 0, 
        concluidas: concluidasCount || 0,
        emAndamento: emAndamentoCount || 0
      };
    },
    enabled: !!companyId,
  });

  const { data: operacoesStats = [] } = useQuery({
    queryKey: ['operacoes-stats', companyId],
    queryFn: async () => {
      // Primeiro buscar IDs de viagens da empresa
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) {
        return OPERACOES_TABELAS.map(op => ({ nome: op.nome, total: 0 }));
      }
      
      const viagemIds = viagensEmpresa.map((v: any) => v.id);
      
      const stats = await Promise.all(
        OPERACOES_TABELAS.map(async (op) => {
          const { count, error } = await supabase
            .from(op.tabela)
            .select('*', { count: 'exact', head: true })
            .in('id_viagem', viagemIds);
          
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

  // Query para contar operações por tipo de dashboard (filtrado por company_id via viagens)
  const { data: dashboardCounts = { sada: 0, tegma: 0, superterminais: 0, cesari: 0, total: 0 } } = useQuery({
    queryKey: ['dashboard-counts', companyId],
    queryFn: async () => {
      // Buscar IDs de viagens da empresa
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) {
        return { sada: 0, tegma: 0, superterminais: 0, cesari: 0, total: 0 };
      }
      
      const viagemIds = viagensEmpresa.map((v: any) => v.id);
      
      // Contar operações que pertencem às viagens da empresa
      const [sadaRes, tegmaRes, superRes, cesariRes] = await Promise.all([
        supabase.from('operacao_sada').select('id', { count: 'exact', head: true }).in('id_viagem', viagemIds),
        supabase.from('operacao_tegma').select('id', { count: 'exact', head: true }).in('id_viagem', viagemIds),
        supabase.from('operacao_superterminais').select('id', { count: 'exact', head: true }).in('id_viagem', viagemIds),
        supabase.from('operacao_cesari').select('id', { count: 'exact', head: true }).in('id_viagem', viagemIds),
      ]);
      
      const sada = sadaRes.count || 0;
      const tegma = tegmaRes.count || 0;
      const superterminais = superRes.count || 0;
      const cesari = cesariRes.count || 0;
      
      return {
        sada,
        tegma,
        superterminais,
        cesari,
        total: sada + tegma + superterminais + cesari
      };
    },
    enabled: !!companyId,
  });

  const periodoAtual = PERIODOS_HISTOGRAMA.find(p => p.id === histogramaPeriodo);
  const diasPeriodo = histogramaPeriodo === 'custom' ? 0 : (periodoAtual?.dias || 30);

  const { data: viagensHistograma = [] } = useQuery({
    queryKey: ['viagens-histograma', companyId, histogramaPeriodo, histogramaDataInicio, histogramaDataFim],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const hoje = new Date();
      let dataInicio: Date;
      let dataFim: Date = hoje;
      let numDias: number;
      
      if (histogramaPeriodo === 'custom' && histogramaDataInicio && histogramaDataFim) {
        dataInicio = new Date(histogramaDataInicio);
        dataFim = new Date(histogramaDataFim);
        numDias = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } else {
        numDias = diasPeriodo;
        dataInicio = new Date(hoje);
        dataInicio.setDate(dataInicio.getDate() - (numDias - 1));
      }
      
      const { data, error } = await supabase
        .from('acompanhamento_viagem')
        .select('id, data_hora_inicial')
        .eq('company_id', companyId)
        .gte('data_hora_inicial', dataInicio.toISOString())
        .lte('data_hora_inicial', new Date(dataFim.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .order('data_hora_inicial', { ascending: true });
      
      if (error) {
        console.warn('Erro ao buscar histograma:', error);
        return [];
      }
      
      const diasMap: Record<string, { data: string; total: number; diaSemana: string }> = {};
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      
      for (let i = 0; i < numDias; i++) {
        const d = new Date(dataInicio);
        d.setDate(d.getDate() + i);
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
    enabled: !!companyId && (histogramaPeriodo !== 'custom' || (!!histogramaDataInicio && !!histogramaDataFim)),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Map className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Total Viagens</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{viagensStats?.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Operações</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{OPERACOES_TABELAS.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Hoje</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{viagensStats?.hoje || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Em Andamento</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{viagensStats?.emAndamento || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Check className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Concluídas</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{viagensStats?.concluidas || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Viagens</h3>
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
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPeriodoExpanded(!isPeriodoExpanded)}
                className={`w-10 h-10 rounded-lg transition-colors flex items-center justify-center ${
                  isPeriodoExpanded 
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={isPeriodoExpanded ? 'Fechar seletor de período' : 'Abrir seletor de período'}
                data-testid="btn-toggle-periodo"
              >
                <Calendar className="w-5 h-5" />
              </button>
              
              {!isPeriodoExpanded && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {histogramaPeriodo === 'custom' && histogramaDataInicio && histogramaDataFim
                    ? `${histogramaDataInicio.split('-').reverse().join('/')} - ${histogramaDataFim.split('-').reverse().join('/')}`
                    : periodoAtual?.label}
                </span>
              )}
              
              {isPeriodoExpanded && (
                <div className="flex items-center gap-2 flex-wrap">
                  {PERIODOS_HISTOGRAMA.map((periodo) => (
                    <button
                      key={periodo.id}
                      onClick={() => setHistogramaPeriodo(periodo.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        histogramaPeriodo === periodo.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      data-testid={`btn-periodo-${periodo.id}`}
                    >
                      {periodo.label}
                    </button>
                  ))}
                  
                  {histogramaPeriodo === 'custom' && (
                    <div className="flex items-center gap-2 ml-2">
                      <input
                        type="date"
                        value={histogramaDataInicio}
                        onChange={(e) => setHistogramaDataInicio(e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        data-testid="input-histograma-data-inicio"
                      />
                      <span className="text-gray-400 text-sm">até</span>
                      <input
                        type="date"
                        value={histogramaDataFim}
                        onChange={(e) => setHistogramaDataFim(e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        data-testid="input-histograma-data-fim"
                      />
                    </div>
                  )}
                </div>
              )}
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
                  <p>Nenhuma viagem no período selecionado</p>
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
                  {viagensHistograma.length > 2 && (
                    <span className="text-center">
                      {Math.floor(viagensHistograma.length / 2)} dias atrás
                    </span>
                  )}
                  <span>{viagensHistograma[viagensHistograma.length - 1]?.data}</span>
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

      {/* Filtros de Operações */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filtrar por Operação</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Selecione uma operação para ver seus detalhes</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {DASHBOARD_OPERATIONS.map((op) => {
              const isSelected = selectedOperation === op.id;
              const IconComponent = op.icon;
              
              // Obter contagem baseada no tipo de operação
              const getCount = () => {
                switch (op.id) {
                  case 'all': return dashboardCounts.total;
                  case 'sada': return dashboardCounts.sada;
                  case 'tegma': return dashboardCounts.tegma;
                  case 'superterminais': return dashboardCounts.superterminais;
                  case 'cesari': return dashboardCounts.cesari;
                  default: return 0;
                }
              };
              const count = getCount();
              
              return (
                <button
                  key={op.id}
                  onClick={() => setSelectedOperation(op.id)}
                  className={`group relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                    isSelected 
                      ? `${op.borderColor} shadow-xl scale-[1.02] ${op.bgLight} ${op.bgDark}` 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg bg-white dark:bg-gray-800'
                  }`}
                  data-testid={`filter-operacao-${op.id}`}
                >
                  {isSelected && (
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${op.cor}`} />
                  )}
                  
                  <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${op.cor} flex items-center justify-center shadow-lg transition-transform duration-300 ${
                    isSelected ? 'scale-110' : 'group-hover:scale-105'
                  }`}>
                    <IconComponent className="w-7 h-7 text-white" />
                    {count > 0 && (
                      <div className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 bg-red-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
                        <span className="text-xs font-bold text-white">
                          {count > 99 ? '99+' : count}
                        </span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <p className={`font-semibold text-sm ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {op.nome}
                    </p>
                    <p className={`text-xs mt-0.5 ${isSelected ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {op.descricao}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dashboards específicos por operação */}
      <div className="space-y-6">
        {(selectedOperation === 'all' || selectedOperation === 'sada') && (
          <SadaDashboard companyId={companyId!} />
        )}
        {(selectedOperation === 'all' || selectedOperation === 'tegma') && (
          <TegmaDashboard companyId={companyId!} />
        )}
        {(selectedOperation === 'all' || selectedOperation === 'superterminais') && (
          <SuperterminaisDashboard companyId={companyId!} />
        )}
        {(selectedOperation === 'all' || selectedOperation === 'cesari') && (
          <CesariDashboard companyId={companyId!} />
        )}
      </div>
    </div>
  );
};

// Componente de gráfico de barras horizontais reutilizável
const HorizontalBarChart = ({ 
  title, 
  data, 
  valueKey = 'value',
  labelKey = 'label',
  color = 'bg-primary'
}: { 
  title: string; 
  data: Array<{ label: string; value: number }>; 
  valueKey?: string;
  labelKey?: string;
  color?: string;
}) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">{title}</h4>
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          Sem dados disponíveis
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">{title}</h4>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {data.slice(0, 15).map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-24 text-xs text-gray-600 dark:text-gray-400 truncate" title={item.label}>
              {item.label}
            </div>
            <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
              <div 
                className={`h-full ${color} transition-all duration-300`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
            <div className="w-16 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
              {item.value.toLocaleString('pt-BR')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Card de estatística
const StatCard = ({ 
  label, 
  value, 
  icon: Icon,
  color = 'text-primary'
}: { 
  label: string; 
  value: string | number; 
  icon?: any;
  color?: string;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>
      {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
    </p>
  </div>
);

// Dashboard SADA
const SadaDashboard = ({ companyId }: { companyId: number }) => {
  const { data: sadaData = [], isLoading } = useQuery({
    queryKey: ['sada-dashboard', companyId],
    queryFn: async () => {
      // Primeiro buscar viagens da empresa
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, km_inicial, km_final, janta, data_hora_inicial')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) return [];
      
      const viagemIdsEmpresa = viagensEmpresa.map((v: any) => v.id);
      
      // Buscar operações SADA que pertencem às viagens da empresa
      const { data: opData, error: opError } = await supabase
        .from('operacao_sada')
        .select('*')
        .in('id_viagem', viagemIdsEmpresa);
      
      if (opError || !opData || opData.length === 0) return [];
      
      const viagensData = viagensEmpresa;
      
      // Buscar motoristas
      const motoristaIds = [...new Set((viagensData || []).map((v: any) => v.motorista_id).filter(Boolean))];
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .in('motorista_id', motoristaIds);
      
      const motoristasMap: Record<number, string> = {};
      (motoristasData || []).forEach((m: any) => { motoristasMap[m.motorista_id] = m.nome; });
      
      // Buscar veículos
      const veiculoIds = [...new Set((viagensData || []).map((v: any) => v.veiculo_id).filter(Boolean))];
      const { data: veiculosData } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .in('veiculo_id', veiculoIds);
      
      const veiculosMap: Record<number, string> = {};
      (veiculosData || []).forEach((v: any) => { veiculosMap[v.veiculo_id] = v.placa; });
      
      // Combinar dados
      return opData.map((op: any) => {
        const viagem = (viagensData || []).find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          viagem: viagem ? {
            ...viagem,
            motorista_nome: motoristasMap[viagem.motorista_id] || 'Desconhecido',
            veiculo_placa: veiculosMap[viagem.veiculo_id] || 'Desconhecido'
          } : null
        };
      });
    },
    enabled: !!companyId,
  });

  const stats = useMemo(() => {
    const totalViagens = sadaData.length;
    let kmTotal = 0;
    let volumeJantas = 0;
    const kmPorMotorista: Record<string, number> = {};
    const carrosPorMotorista: Record<string, number> = {};
    const kmPorCavalo: Record<string, number> = {};
    const viagensPorMes: Record<string, number> = {};

    sadaData.forEach((item: any) => {
      const viagem = item.viagem;
      if (!viagem) return;

      const kmInicial = parseFloat(viagem.km_inicial) || 0;
      const kmFinal = parseFloat(viagem.km_final) || 0;
      const km = kmFinal - kmInicial;
      if (km > 0) kmTotal += km;
      if (viagem.janta) volumeJantas++;

      const motoristaNome = viagem.motorista_nome || 'Desconhecido';
      const veiculoPlaca = viagem.veiculo_placa || 'Desconhecido';

      kmPorMotorista[motoristaNome] = (kmPorMotorista[motoristaNome] || 0) + (km > 0 ? km : 0);
      carrosPorMotorista[motoristaNome] = (carrosPorMotorista[motoristaNome] || 0) + (item.qtd_carros || 0);
      kmPorCavalo[veiculoPlaca] = (kmPorCavalo[veiculoPlaca] || 0) + (km > 0 ? km : 0);

      if (viagem.data_hora_inicial) {
        const mes = viagem.data_hora_inicial.substring(0, 7);
        viagensPorMes[mes] = (viagensPorMes[mes] || 0) + 1;
      }
    });

    return {
      totalViagens,
      kmTotal,
      volumeJantas,
      kmPorMotorista: Object.entries(kmPorMotorista)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      carrosPorMotorista: Object.entries(carrosPorMotorista)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      kmPorCavalo: Object.entries(kmPorCavalo)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      viagensPorMes: Object.entries(viagensPorMes)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  }, [sadaData]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SADA</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Análise detalhada da operação</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HorizontalBarChart 
                title="KM por Motorista" 
                data={stats.kmPorMotorista}
                color="bg-yellow-500 dark:bg-yellow-600"
              />
              <HorizontalBarChart 
                title="Carros por Motorista" 
                data={stats.carrosPorMotorista}
                color="bg-yellow-500 dark:bg-yellow-600"
              />
              <HorizontalBarChart 
                title="KM por Cavalo" 
                data={stats.kmPorCavalo}
                color="bg-yellow-500 dark:bg-yellow-600"
              />
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Total de Viagens por Ano e Mês</h4>
              {stats.viagensPorMes.length > 0 ? (
                <div className="flex items-end gap-2 h-32 overflow-x-auto pb-2">
                  {stats.viagensPorMes.map((item, index) => {
                    const maxVal = Math.max(...stats.viagensPorMes.map(v => v.value), 1);
                    const heightPercent = (item.value / maxVal) * 100;
                    return (
                      <div key={index} className="flex flex-col items-center min-w-[60px]">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{item.value}</span>
                        <div 
                          className="w-12 bg-yellow-500 dark:bg-yellow-600 rounded-t"
                          style={{ height: `${Math.max(heightPercent, 8)}%`, minHeight: '8px' }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.label.substring(5)}/{item.label.substring(2, 4)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">Sem dados disponíveis</div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <StatCard label="Viagens" value={stats.totalViagens} color="text-yellow-600 dark:text-yellow-400" />
            <StatCard label="KM Total" value={stats.kmTotal > 1000 ? `${(stats.kmTotal / 1000).toFixed(1)} Mil` : stats.kmTotal} color="text-yellow-600 dark:text-yellow-400" />
            <StatCard label="Volume de Jantas" value={stats.volumeJantas} color="text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard TEGMA
const TegmaDashboard = ({ companyId }: { companyId: number }) => {
  const { data: tegmaData = [], isLoading } = useQuery({
    queryKey: ['tegma-dashboard', companyId],
    queryFn: async () => {
      // Primeiro buscar viagens da empresa
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, km_inicial, km_final, janta, data_hora_inicial')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) return [];
      
      const viagemIdsEmpresa = viagensEmpresa.map((v: any) => v.id);
      
      // Buscar operações TEGMA que pertencem às viagens da empresa
      const { data: opData, error: opError } = await supabase
        .from('operacao_tegma')
        .select('*')
        .in('id_viagem', viagemIdsEmpresa);
      
      if (opError || !opData || opData.length === 0) return [];
      
      const viagensData = viagensEmpresa;
      
      // Buscar motoristas
      const motoristaIds = [...new Set((viagensData || []).map((v: any) => v.motorista_id).filter(Boolean))];
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .in('motorista_id', motoristaIds);
      
      const motoristasMap: Record<number, string> = {};
      (motoristasData || []).forEach((m: any) => { motoristasMap[m.motorista_id] = m.nome; });
      
      // Buscar veículos
      const veiculoIds = [...new Set((viagensData || []).map((v: any) => v.veiculo_id).filter(Boolean))];
      const { data: veiculosData } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .in('veiculo_id', veiculoIds);
      
      const veiculosMap: Record<number, string> = {};
      (veiculosData || []).forEach((v: any) => { veiculosMap[v.veiculo_id] = v.placa; });
      
      return opData.map((op: any) => {
        const viagem = (viagensData || []).find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          viagem: viagem ? {
            ...viagem,
            motorista_nome: motoristasMap[viagem.motorista_id] || 'Desconhecido',
            veiculo_placa: veiculosMap[viagem.veiculo_id] || 'Desconhecido'
          } : null
        };
      });
    },
    enabled: !!companyId,
  });

  const stats = useMemo(() => {
    const totalViagens = tegmaData.length;
    let kmTotal = 0;
    let volumeJantas = 0;
    const kmPorMotorista: Record<string, number> = {};
    const carrosPorMotorista: Record<string, number> = {};
    const kmPorCavalo: Record<string, number> = {};
    const viagensPorMes: Record<string, number> = {};

    tegmaData.forEach((item: any) => {
      const viagem = item.viagem;
      if (!viagem) return;

      const kmInicial = parseFloat(viagem.km_inicial) || 0;
      const kmFinal = parseFloat(viagem.km_final) || 0;
      const km = kmFinal - kmInicial;
      if (km > 0) kmTotal += km;
      if (viagem.janta) volumeJantas++;

      const motoristaNome = viagem.motorista_nome || 'Desconhecido';
      const veiculoPlaca = viagem.veiculo_placa || 'Desconhecido';

      kmPorMotorista[motoristaNome] = (kmPorMotorista[motoristaNome] || 0) + (km > 0 ? km : 0);
      carrosPorMotorista[motoristaNome] = (carrosPorMotorista[motoristaNome] || 0) + (item.qtd_carros || 0);
      kmPorCavalo[veiculoPlaca] = (kmPorCavalo[veiculoPlaca] || 0) + (km > 0 ? km : 0);

      if (viagem.data_hora_inicial) {
        const mes = viagem.data_hora_inicial.substring(0, 7);
        viagensPorMes[mes] = (viagensPorMes[mes] || 0) + 1;
      }
    });

    return {
      totalViagens,
      kmTotal,
      volumeJantas,
      kmPorMotorista: Object.entries(kmPorMotorista)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      carrosPorMotorista: Object.entries(carrosPorMotorista)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      kmPorCavalo: Object.entries(kmPorCavalo)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      viagensPorMes: Object.entries(viagensPorMes)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  }, [tegmaData]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">TEGMA</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Análise detalhada da operação</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HorizontalBarChart 
                title="KM por Motorista" 
                data={stats.kmPorMotorista}
                color="bg-orange-500 dark:bg-orange-600"
              />
              <HorizontalBarChart 
                title="Carros por Motorista" 
                data={stats.carrosPorMotorista}
                color="bg-orange-500 dark:bg-orange-600"
              />
              <HorizontalBarChart 
                title="KM por Cavalo" 
                data={stats.kmPorCavalo}
                color="bg-orange-500 dark:bg-orange-600"
              />
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Total de Viagens por Ano e Mês</h4>
              {stats.viagensPorMes.length > 0 ? (
                <div className="flex items-end gap-2 h-32 overflow-x-auto pb-2">
                  {stats.viagensPorMes.map((item, index) => {
                    const maxVal = Math.max(...stats.viagensPorMes.map(v => v.value), 1);
                    const heightPercent = (item.value / maxVal) * 100;
                    return (
                      <div key={index} className="flex flex-col items-center min-w-[60px]">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{item.value}</span>
                        <div 
                          className="w-12 bg-orange-500 dark:bg-orange-600 rounded-t"
                          style={{ height: `${Math.max(heightPercent, 8)}%`, minHeight: '8px' }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.label.substring(5)}/{item.label.substring(2, 4)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">Sem dados disponíveis</div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <StatCard label="Viagens" value={stats.totalViagens} color="text-orange-600 dark:text-orange-400" />
            <StatCard label="KM Total" value={stats.kmTotal > 1000 ? `${(stats.kmTotal / 1000).toFixed(1)} Mil` : stats.kmTotal} color="text-orange-600 dark:text-orange-400" />
            <StatCard label="Volume de Jantas" value={stats.volumeJantas} color="text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard SUPERTERMINAIS
const SuperterminaisDashboard = ({ companyId }: { companyId: number }) => {
  const { data: superData = [], isLoading } = useQuery({
    queryKey: ['superterminais-dashboard', companyId],
    queryFn: async () => {
      // Primeiro buscar viagens da empresa
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, data_hora_inicial')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) return [];
      
      const viagemIdsEmpresa = viagensEmpresa.map((v: any) => v.id);
      
      // Buscar operações SUPERTERMINAIS que pertencem às viagens da empresa
      const { data: opData, error: opError } = await supabase
        .from('operacao_superterminais')
        .select('*')
        .in('id_viagem', viagemIdsEmpresa);
      
      if (opError || !opData || opData.length === 0) return [];
      
      const viagensData = viagensEmpresa;
      
      // Buscar motoristas
      const motoristaIds = [...new Set((viagensData || []).map((v: any) => v.motorista_id).filter(Boolean))];
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .in('motorista_id', motoristaIds);
      
      const motoristasMap: Record<number, string> = {};
      (motoristasData || []).forEach((m: any) => { motoristasMap[m.motorista_id] = m.nome; });
      
      // Buscar veículos
      const veiculoIds = [...new Set((viagensData || []).map((v: any) => v.veiculo_id).filter(Boolean))];
      const { data: veiculosData } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .in('veiculo_id', veiculoIds);
      
      const veiculosMap: Record<number, string> = {};
      (veiculosData || []).forEach((v: any) => { veiculosMap[v.veiculo_id] = v.placa; });
      
      return opData.map((op: any) => {
        const viagem = (viagensData || []).find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          viagem: viagem ? {
            ...viagem,
            motorista_nome: motoristasMap[viagem.motorista_id] || 'Desconhecido',
            veiculo_placa: veiculosMap[viagem.veiculo_id] || 'Desconhecido'
          } : null
        };
      });
    },
    enabled: !!companyId,
  });

  const stats = useMemo(() => {
    const totalViagens = superData.length;
    let containersCheio = 0;
    let containersVazio = 0;
    const containersPorMotorista: Record<string, number> = {};
    const containersPorCavalo: Record<string, number> = {};
    const viagensPorMes: Record<string, number> = {};

    superData.forEach((item: any) => {
      const viagem = item.viagem;
      if (!viagem) return;

      if (item.capacidade === 1) containersCheio++;
      else containersVazio++;

      const motoristaNome = viagem.motorista_nome || 'Desconhecido';
      const veiculoPlaca = viagem.veiculo_placa || 'Desconhecido';

      containersPorMotorista[motoristaNome] = (containersPorMotorista[motoristaNome] || 0) + 1;
      containersPorCavalo[veiculoPlaca] = (containersPorCavalo[veiculoPlaca] || 0) + 1;

      if (viagem.data_hora_inicial) {
        const mes = viagem.data_hora_inicial.substring(0, 7);
        viagensPorMes[mes] = (viagensPorMes[mes] || 0) + 1;
      }
    });

    return {
      totalViagens,
      containersCheio,
      containersVazio,
      containersPorMotorista: Object.entries(containersPorMotorista)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      containersPorCavalo: Object.entries(containersPorCavalo)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      viagensPorMes: Object.entries(viagensPorMes)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  }, [superData]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SUPER TERMINAIS</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Análise detalhada da operação portuária</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HorizontalBarChart 
                title="Containers por Motorista" 
                data={stats.containersPorMotorista}
                color="bg-purple-500 dark:bg-purple-600"
              />
              <HorizontalBarChart 
                title="Containers por Cavalo" 
                data={stats.containersPorCavalo}
                color="bg-purple-500 dark:bg-purple-600"
              />
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Volume de Viagens - Super Terminais por Ano e Mês</h4>
              {stats.viagensPorMes.length > 0 ? (
                <div className="flex items-end gap-2 h-32 overflow-x-auto pb-2">
                  {stats.viagensPorMes.map((item, index) => {
                    const maxVal = Math.max(...stats.viagensPorMes.map(v => v.value), 1);
                    const heightPercent = (item.value / maxVal) * 100;
                    return (
                      <div key={index} className="flex flex-col items-center min-w-[60px]">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{item.value}</span>
                        <div 
                          className="w-12 bg-purple-500 dark:bg-purple-600 rounded-t"
                          style={{ height: `${Math.max(heightPercent, 8)}%`, minHeight: '8px' }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.label.substring(5)}/{item.label.substring(2, 4)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">Sem dados disponíveis</div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <StatCard label="Volume de Viagens" value={stats.totalViagens} color="text-purple-600 dark:text-purple-400" />
            <StatCard label="Containers Cheio" value={stats.containersCheio} color="text-purple-600 dark:text-purple-400" />
            <StatCard label="Containers Vazio" value={stats.containersVazio} color="text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard CESARI
const CesariDashboard = ({ companyId }: { companyId: number }) => {
  const { data: cesariData = [], isLoading } = useQuery({
    queryKey: ['cesari-dashboard', companyId],
    queryFn: async () => {
      // Primeiro buscar viagens da empresa
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, km_inicial, km_final, data_hora_inicial')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) return [];
      
      const viagemIdsEmpresa = viagensEmpresa.map((v: any) => v.id);
      
      // Buscar operações CESARI que pertencem às viagens da empresa
      const { data: opData, error: opError } = await supabase
        .from('operacao_cesari')
        .select('*')
        .in('id_viagem', viagemIdsEmpresa);
      
      if (opError || !opData || opData.length === 0) return [];
      
      const viagensData = viagensEmpresa;
      
      // Buscar motoristas
      const motoristaIds = [...new Set((viagensData || []).map((v: any) => v.motorista_id).filter(Boolean))];
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .in('motorista_id', motoristaIds);
      
      const motoristasMap: Record<number, string> = {};
      (motoristasData || []).forEach((m: any) => { motoristasMap[m.motorista_id] = m.nome; });
      
      // Buscar veículos
      const veiculoIds = [...new Set((viagensData || []).map((v: any) => v.veiculo_id).filter(Boolean))];
      const { data: veiculosData } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .in('veiculo_id', veiculoIds);
      
      const veiculosMap: Record<number, string> = {};
      (veiculosData || []).forEach((v: any) => { veiculosMap[v.veiculo_id] = v.placa; });
      
      return opData.map((op: any) => {
        const viagem = (viagensData || []).find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          viagem: viagem ? {
            ...viagem,
            motorista_nome: motoristasMap[viagem.motorista_id] || 'Desconhecido',
            veiculo_placa: veiculosMap[viagem.veiculo_id] || 'Desconhecido'
          } : null
        };
      });
    },
    enabled: !!companyId,
  });

  const stats = useMemo(() => {
    const totalViagens = cesariData.length;
    let kmTotal = 0;
    const kmPorMotorista: Record<string, number> = {};
    const kmPorCavalo: Record<string, number> = {};
    const viagensPorMes: Record<string, number> = {};

    cesariData.forEach((item: any) => {
      const viagem = item.viagem;
      if (!viagem) return;

      const kmInicial = parseFloat(viagem.km_inicial) || 0;
      const kmFinal = parseFloat(viagem.km_final) || 0;
      const km = kmFinal - kmInicial;
      if (km > 0) kmTotal += km;

      const motoristaNome = viagem.motorista_nome || 'Desconhecido';
      const veiculoPlaca = viagem.veiculo_placa || 'Desconhecido';

      kmPorMotorista[motoristaNome] = (kmPorMotorista[motoristaNome] || 0) + (km > 0 ? km : 0);
      kmPorCavalo[veiculoPlaca] = (kmPorCavalo[veiculoPlaca] || 0) + (km > 0 ? km : 0);

      if (viagem.data_hora_inicial) {
        const mes = viagem.data_hora_inicial.substring(0, 7);
        viagensPorMes[mes] = (viagensPorMes[mes] || 0) + 1;
      }
    });

    return {
      totalViagens,
      kmTotal,
      kmPorMotorista: Object.entries(kmPorMotorista)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      kmPorCavalo: Object.entries(kmPorCavalo)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      viagensPorMes: Object.entries(viagensPorMes)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  }, [cesariData]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">CESARI</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Análise detalhada da operação</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HorizontalBarChart 
                title="KM por Motorista" 
                data={stats.kmPorMotorista}
                color="bg-green-500 dark:bg-green-600"
              />
              <HorizontalBarChart 
                title="KM por Cavalo" 
                data={stats.kmPorCavalo}
                color="bg-green-500 dark:bg-green-600"
              />
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Total de Viagens - CESARI por Ano e Mês</h4>
              {stats.viagensPorMes.length > 0 ? (
                <div className="flex items-end gap-2 h-32 overflow-x-auto pb-2">
                  {stats.viagensPorMes.map((item, index) => {
                    const maxVal = Math.max(...stats.viagensPorMes.map(v => v.value), 1);
                    const heightPercent = (item.value / maxVal) * 100;
                    return (
                      <div key={index} className="flex flex-col items-center min-w-[60px]">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{item.value}</span>
                        <div 
                          className="w-12 bg-green-500 dark:bg-green-600 rounded-t"
                          style={{ height: `${Math.max(heightPercent, 8)}%`, minHeight: '8px' }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.label.substring(5)}/{item.label.substring(2, 4)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">Sem dados disponíveis</div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <StatCard label="Viagens" value={stats.totalViagens} color="text-green-600 dark:text-green-400" />
            <StatCard label="KM Total" value={stats.kmTotal > 1000 ? `${(stats.kmTotal / 1000).toFixed(2)} Mil` : stats.kmTotal} color="text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

const OperacoesViagens = () => {
  const { companyId } = useCurrentAccount();
  const [selectedOperacao, setSelectedOperacao] = useState<string>('all');
  const [selectedMotorista, setSelectedMotorista] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [isOperacaoDropdownOpen, setIsOperacaoDropdownOpen] = useState(false);
  const [isMotoristaDropdownOpen, setIsMotoristaDropdownOpen] = useState(false);
  const [selectedViagem, setSelectedViagem] = useState<ViagemEnriquecida | null>(null);
  const [isDateFilterExpanded, setIsDateFilterExpanded] = useState(false);

  const { data: motoristas = [] } = useQuery<Motorista[]>({
    queryKey: ['motoristas-operacoes', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .order('nome');
      
      if (error) {
        console.warn('Erro ao buscar motoristas:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: ajudantes = [] } = useQuery<{ id_ajudante: number; nome: string }[]>({
    queryKey: ['ajudantes-operacoes', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documento_ajudante')
        .select('id_ajudante, nome')
        .order('nome');
      
      if (error) {
        console.warn('Erro ao buscar ajudantes:', error);
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
    queryKey: ['viagens', companyId, selectedMotorista, dataInicio, dataFim],
    queryFn: async () => {
      let query = supabase
        .from('acompanhamento_viagem')
        .select('*')
        .eq('company_id', companyId)
        .order('data_hora_inicial', { ascending: false })
        .limit(500);

      if (selectedMotorista !== 'all') {
        query = query.eq('motorista_id', parseInt(selectedMotorista));
      }
      
      if (dataInicio) {
        query = query.gte('data_hora_inicial', `${dataInicio}T00:00:00`);
      }
      
      if (dataFim) {
        query = query.lte('data_hora_inicial', `${dataFim}T23:59:59`);
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
      const ajudante = ajudantes.find(a => a.id_ajudante === viagem.ajudante_id);
      const veiculo = veiculos.find(v => v.veiculo_id === viagem.veiculo_id);
      const operacaoInfo = operacoesData[viagem.id];
      
      return {
        ...viagem,
        motorista_nome: motorista?.nome,
        ajudante_nome: ajudante?.nome,
        veiculo_placa: veiculo?.placa,
        operacao_tipo: operacaoInfo?.tipo,
        operacao_dados: operacaoInfo?.dados
      };
    });
  }, [viagens, motoristas, ajudantes, veiculos, operacoesData]);

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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDateFilterExpanded(!isDateFilterExpanded)}
              className={`p-2 border rounded-lg transition-colors ${
                (dataInicio || dataFim) 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              title="Filtrar por Data"
              data-testid="button-toggle-date-filter"
            >
              <Calendar className="w-4 h-4" />
            </button>
            
            {isDateFilterExpanded && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  data-testid="input-data-inicio"
                />
                <span className="text-gray-400">até</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  data-testid="input-data-fim"
                />
                {(dataInicio || dataFim) && (
                  <button
                    onClick={() => {
                      setDataInicio('');
                      setDataFim('');
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Limpar filtro de data"
                    data-testid="button-limpar-data"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora Inicial</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Operação</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ajudante</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Destino</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ajudante</th>
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
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{viagem.ajudante_nome || '-'}</td>
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
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Operações</h1>
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
