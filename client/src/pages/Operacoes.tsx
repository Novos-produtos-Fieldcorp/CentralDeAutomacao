import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, Filter, Search, RefreshCw, ChevronDown, User, Truck, X, Clock, MapPin, Car, Package, FileText, TrendingUp, Image, Ship, Building, CheckCircle, XCircle, Moon, Calendar, Phone, DollarSign, Hash, Navigation, Check, Layers, Factory, Container, Boxes, Wallet, Settings, Edit, Save, Loader2 } from 'lucide-react';
import { useState as useStateReact } from 'react';
import { supabase } from '../lib/supabase';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import SpotlightCard from '../components/SpotlightCard';

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

  // Design monocromático - cores removidas

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
            <span className="flex items-center gap-1 text-gray-900 dark:text-white font-medium">
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
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  dados.v2_capacidade === 1 
                    ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800'
                    : dados.v2_capacidade === 2
                      ? 'bg-gray-400 text-white dark:bg-gray-500 dark:text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
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
              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                dados.tipo_carreta === 1 
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800'
                  : 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
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
              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                dados.tipo_carreta === 1 
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800'
                  : 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
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
        {/* Header monocromático */}
        <div className="bg-gray-900 dark:bg-gray-900 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">#{viagem.id}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Detalhes da Viagem
                </h2>
                {viagem.operacao_tipo && (
                  <span className="text-gray-400 text-sm">
                    Operação {viagem.operacao_tipo}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
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
                  <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${
                    viagem.data_hora_final 
                      ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
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

type HistogramaPeriodo = '30d' | '15d' | '7d' | '1d' | 'custom';

const PERIODOS_HISTOGRAMA = [
  { id: '30d' as HistogramaPeriodo, label: '30 dias', dias: 30 },
  { id: '15d' as HistogramaPeriodo, label: '15 dias', dias: 15 },
  { id: '7d' as HistogramaPeriodo, label: '7 dias', dias: 7 },
  { id: '1d' as HistogramaPeriodo, label: 'Hoje', dias: 1 },
  { id: 'custom' as HistogramaPeriodo, label: 'Personalizado', dias: 0 },
];

type StatsModalType = 'total' | 'hoje' | 'emAndamento' | 'concluidas' | null;

const OperacoesDashboard = ({ selectedOperacao }: { selectedOperacao: string }) => {
  const { companyId } = useCurrentAccount();
  const [histogramaPeriodo, setHistogramaPeriodo] = useState<HistogramaPeriodo>('30d');
  const [histogramaDataInicio, setHistogramaDataInicio] = useState<string>('');
  const [histogramaDataFim, setHistogramaDataFim] = useState<string>('');
  const [isPeriodoExpanded, setIsPeriodoExpanded] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState<StatsModalType>(null);

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
    queryKey: ['viagens-stats', companyId, selectedOperacao],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      // Se filtro por operação específica, buscar IDs das viagens dessa operação
      let viagemIdsFilter: number[] | null = null;
      
      if (selectedOperacao !== 'all') {
        const operacao = OPERACOES_TABELAS.find(op => op.nome === selectedOperacao);
        if (operacao) {
          // Primeiro buscar IDs de viagens da empresa
          const { data: viagensEmpresa } = await supabase
            .from('acompanhamento_viagem')
            .select('id')
            .eq('company_id', companyId);
          
          if (viagensEmpresa && viagensEmpresa.length > 0) {
            const viagemIds = viagensEmpresa.map((v: any) => v.id);
            
            // Buscar viagens dessa operação específica
            const { data: operacaoViagens } = await supabase
              .from(operacao.tabela)
              .select('id_viagem')
              .in('id_viagem', viagemIds);
            
            if (operacaoViagens) {
              viagemIdsFilter = operacaoViagens.map((ov: any) => ov.id_viagem);
            }
          }
          
          if (!viagemIdsFilter || viagemIdsFilter.length === 0) {
            return { total: 0, hoje: 0, concluidas: 0, emAndamento: 0 };
          }
        }
      }

      // Buscar total de viagens
      let totalQuery = supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      
      if (viagemIdsFilter) {
        totalQuery = totalQuery.in('id', viagemIdsFilter);
      }
      
      const { count: totalCount, error: totalError } = await totalQuery;
      
      if (totalError) {
        console.warn('Tabela acompanhamento_viagem não acessível:', totalError);
        return { total: 0, hoje: 0, concluidas: 0, emAndamento: 0 };
      }

      // Viagens de hoje
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1).toISOString();
      
      let hojeQuery = supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('data_hora_inicial', inicioHoje)
        .lt('data_hora_inicial', fimHoje);
      
      if (viagemIdsFilter) {
        hojeQuery = hojeQuery.in('id', viagemIdsFilter);
      }
      
      const { count: hojeCount } = await hojeQuery;

      // Viagens concluídas (com data_hora_final preenchida)
      let concluidasQuery = supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('data_hora_final', 'is', null);
      
      if (viagemIdsFilter) {
        concluidasQuery = concluidasQuery.in('id', viagemIdsFilter);
      }
      
      const { count: concluidasCount } = await concluidasQuery;

      // Viagens em andamento (sem data_hora_final)
      let emAndamentoQuery = supabase
        .from('acompanhamento_viagem')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('data_hora_final', null);
      
      if (viagemIdsFilter) {
        emAndamentoQuery = emAndamentoQuery.in('id', viagemIdsFilter);
      }
      
      const { count: emAndamentoCount } = await emAndamentoQuery;

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

  // Query para buscar viagens detalhadas para o modal (mesma lógica da lista de viagens)
  const { data: viagensDetalhadas = [], isLoading: isLoadingViagensDetalhadas, refetch: refetchViagensDetalhadas } = useQuery({
    queryKey: ['viagens-detalhadas-modal', companyId, selectedOperacao, statsModalOpen],
    queryFn: async () => {
      if (!statsModalOpen || !companyId) return [];
      
      // Buscar todas as viagens da empresa (mesma abordagem da lista de viagens)
      const { data: viagens, error } = await supabase
        .from('acompanhamento_viagem')
        .select('*')
        .eq('company_id', companyId)
        .order('data_hora_inicial', { ascending: false })
        .limit(500);
      
      if (error || !viagens || viagens.length === 0) return [];
      
      // Buscar operações para todas as viagens (incluindo dados como origem/destino)
      const viagemIds = viagens.map((v: any) => v.id);
      const operacoesMap: Record<number, { tipo: string; dados: any }> = {};
      
      await Promise.all(
        OPERACOES_TABELAS.map(async (op) => {
          const { data } = await supabase
            .from(op.tabela)
            .select('*')
            .in('id_viagem', viagemIds);
          
          if (data) {
            data.forEach((item: any) => {
              operacoesMap[item.id_viagem] = {
                tipo: op.nome,
                dados: item
              };
            });
          }
        })
      );
      
      // Enriquecer com tipo de operação e dados
      let viagensEnriquecidas = viagens.map((v: any) => ({
        ...v,
        operacao_tipo: operacoesMap[v.id]?.tipo || null,
        operacao_dados: operacoesMap[v.id]?.dados || null
      }));
      
      // Filtrar por operação se selecionada
      if (selectedOperacao !== 'all') {
        viagensEnriquecidas = viagensEnriquecidas.filter((v: any) => v.operacao_tipo === selectedOperacao);
      }
      
      // Aplicar filtros baseado no tipo de modal
      if (statsModalOpen === 'hoje') {
        const hoje = new Date();
        const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
        viagensEnriquecidas = viagensEnriquecidas.filter((v: any) => {
          const dataViagem = new Date(v.data_hora_inicial);
          return dataViagem >= inicioHoje && dataViagem < fimHoje;
        });
      } else if (statsModalOpen === 'emAndamento') {
        viagensEnriquecidas = viagensEnriquecidas.filter((v: any) => !v.data_hora_final);
      } else if (statsModalOpen === 'concluidas') {
        viagensEnriquecidas = viagensEnriquecidas.filter((v: any) => !!v.data_hora_final);
      }
      
      if (viagensEnriquecidas.length === 0) return [];
      
      // Enriquecer com nomes de motorista, ajudante e veículo
      const motoristaIds = [...new Set(viagensEnriquecidas.map((v: any) => v.motorista_id).filter(Boolean))];
      const ajudanteIds = [...new Set(viagensEnriquecidas.map((v: any) => v.ajudante_id).filter(Boolean))];
      const veiculoIds = [...new Set(viagensEnriquecidas.map((v: any) => v.veiculo_id).filter(Boolean))];
      
      const [motoristasRes, ajudantesRes, veiculosRes] = await Promise.all([
        motoristaIds.length > 0 
          ? supabase.from('motorista').select('motorista_id, nome').in('motorista_id', motoristaIds)
          : { data: [] },
        ajudanteIds.length > 0 
          ? supabase.from('documento_ajudante').select('id_ajudante, nome').in('id_ajudante', ajudanteIds)
          : { data: [] },
        veiculoIds.length > 0 
          ? supabase.from('veiculo').select('veiculo_id, placa').in('veiculo_id', veiculoIds)
          : { data: [] }
      ]);
      
      const motoristasMap: Record<number, string> = {};
      const ajudantesMap: Record<number, string> = {};
      const veiculosMap: Record<number, string> = {};
      (motoristasRes.data || []).forEach((m: any) => { motoristasMap[m.motorista_id] = m.nome; });
      (ajudantesRes.data || []).forEach((a: any) => { ajudantesMap[a.id_ajudante] = a.nome; });
      (veiculosRes.data || []).forEach((v: any) => { veiculosMap[v.veiculo_id] = v.placa; });
      
      return viagensEnriquecidas.map((v: any) => ({
        ...v,
        motorista_nome: motoristasMap[v.motorista_id] || '-',
        ajudante_nome: ajudantesMap[v.ajudante_id] || '-',
        veiculo_placa: veiculosMap[v.veiculo_id] || '-'
      }));
    },
    enabled: !!companyId && !!statsModalOpen,
    staleTime: 0,
    gcTime: 0,
  });
  
  // Forçar refetch quando o modal abrir
  useEffect(() => {
    if (statsModalOpen && companyId) {
      refetchViagensDetalhadas();
    }
  }, [statsModalOpen, companyId, refetchViagensDetalhadas]);

  // Bloquear scroll do body quando modal estiver aberta
  useEffect(() => {
    if (statsModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [statsModalOpen]);

  const getModalTitle = () => {
    switch (statsModalOpen) {
      case 'total': return 'Todas as Viagens';
      case 'hoje': return 'Viagens de Hoje';
      case 'emAndamento': return 'Viagens Em Andamento';
      case 'concluidas': return 'Viagens Concluídas';
      default: return 'Viagens';
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getOperacaoColor = (operacao: string | null) => {
    switch (operacao?.toLowerCase()) {
      case 'sada': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'tegma': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      case 'superterminais': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      case 'cesari': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const periodoAtual = PERIODOS_HISTOGRAMA.find(p => p.id === histogramaPeriodo);
  const diasPeriodo = histogramaPeriodo === 'custom' ? 0 : (periodoAtual?.dias || 30);

  const { data: viagensHistograma = [] } = useQuery({
    queryKey: ['viagens-histograma', companyId, histogramaPeriodo, histogramaDataInicio, histogramaDataFim, selectedOperacao],
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
      
      // Se filtro por operação específica, buscar IDs das viagens dessa operação
      let viagemIdsFilter: number[] | null = null;
      
      if (selectedOperacao !== 'all') {
        const operacao = OPERACOES_TABELAS.find(op => op.nome === selectedOperacao);
        if (operacao) {
          // Primeiro buscar IDs de viagens da empresa no período
          const { data: viagensEmpresa } = await supabase
            .from('acompanhamento_viagem')
            .select('id')
            .eq('company_id', companyId)
            .gte('data_hora_inicial', dataInicio.toISOString())
            .lte('data_hora_inicial', new Date(dataFim.getTime() + 24 * 60 * 60 * 1000).toISOString());
          
          if (viagensEmpresa && viagensEmpresa.length > 0) {
            const viagemIds = viagensEmpresa.map((v: any) => v.id);
            
            // Buscar viagens dessa operação específica
            const { data: operacaoViagens } = await supabase
              .from(operacao.tabela)
              .select('id_viagem')
              .in('id_viagem', viagemIds);
            
            if (operacaoViagens) {
              viagemIdsFilter = operacaoViagens.map((ov: any) => ov.id_viagem);
            }
          }
          
          if (!viagemIdsFilter || viagemIdsFilter.length === 0) {
            // Retornar dias vazios
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
            return Object.values(diasMap);
          }
        }
      }
      
      let query = supabase
        .from('acompanhamento_viagem')
        .select('id, data_hora_inicial')
        .eq('company_id', companyId)
        .gte('data_hora_inicial', dataInicio.toISOString())
        .lte('data_hora_inicial', new Date(dataFim.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .order('data_hora_inicial', { ascending: true });
      
      if (viagemIdsFilter) {
        query = query.in('id', viagemIdsFilter);
      }
      
      const { data, error } = await query;
      
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
      {/* Cards de estatísticas - Design monocromático */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <SpotlightCard
          as="button"
          type="button"
          onClick={() => setStatsModalOpen('total')}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-left hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer"
          data-testid="card-total-viagens"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Viagens</span>
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Map className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{viagensStats?.total || 0}</p>
        </SpotlightCard>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Operações</span>
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{OPERACOES_TABELAS.length}</p>
        </div>

        <SpotlightCard 
          as="button"
          type="button"
          onClick={() => setStatsModalOpen('hoje')}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-left hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer"
          data-testid="card-viagens-hoje"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hoje</span>
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{viagensStats?.hoje || 0}</p>
        </SpotlightCard>

        <SpotlightCard 
          as="button"
          type="button"
          onClick={() => setStatsModalOpen('emAndamento')}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-left hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer"
          data-testid="card-em-andamento"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Em Andamento</span>
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{viagensStats?.emAndamento || 0}</p>
        </SpotlightCard>

        <SpotlightCard 
          as="button"
          type="button"
          onClick={() => setStatsModalOpen('concluidas')}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-left hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer"
          data-testid="card-concluidas"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Concluídas</span>
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{viagensStats?.concluidas || 0}</p>
        </SpotlightCard>
      </div>

      {/* Modal de viagens detalhadas */}
      {statsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={() => setStatsModalOpen(null)}>
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{getModalTitle()}</h2>
              <button 
                onClick={() => setStatsModalOpen(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                data-testid="btn-close-modal"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            <div className="overflow-auto max-h-[calc(90vh-60px)] overscroll-contain">
              {isLoadingViagensDetalhadas ? (
                <div className="p-6">
                  <div className="animate-pulse space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
                    ))}
                  </div>
                </div>
              ) : viagensDetalhadas.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma viagem encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">ID</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Data/Hora</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Operação</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Motorista</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Ajudante</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Veículo</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Origem</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Destino</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {viagensDetalhadas.map((viagem: any) => (
                        <tr key={viagem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{viagem.id}</td>
                          <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(viagem.data_hora_inicial)}</td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">
                            {viagem.operacao_tipo ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getOperacaoColor(viagem.operacao_tipo)}`}>
                                {viagem.operacao_tipo}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900 dark:text-white max-w-[120px] truncate" title={viagem.motorista_nome}>{viagem.motorista_nome || '-'}</td>
                          <td className="px-3 py-3 text-sm text-gray-900 dark:text-white max-w-[100px] truncate" title={viagem.ajudante_nome}>{viagem.ajudante_nome || '-'}</td>
                          <td className="px-3 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">{viagem.veiculo_placa || '-'}</td>
                          <td className="px-3 py-3 text-sm text-gray-900 dark:text-white max-w-[100px] truncate" title={viagem.operacao_dados?.origem}>{viagem.operacao_dados?.origem || '-'}</td>
                          <td className="px-3 py-3 text-sm text-gray-900 dark:text-white max-w-[100px] truncate" title={viagem.operacao_dados?.destino}>{viagem.operacao_dados?.destino || '-'}</td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">
                            {viagem.data_hora_final ? (
                              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800 whitespace-nowrap">
                                Concluída
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 whitespace-nowrap">
                                Em Andamento
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Histograma de viagens - Design monocromático */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gray-800 dark:bg-gray-200 rounded-full" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Viagens</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Histórico diário de viagens realizadas</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {viagensHistograma.reduce((acc, d) => acc + d.total, 0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total período</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {viagensHistograma.length > 0 
                      ? (viagensHistograma.reduce((acc, d) => acc + d.total, 0) / viagensHistograma.length).toFixed(1) 
                      : '0'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Média/dia</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.max(...viagensHistograma.map(d => d.total), 0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pico</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPeriodoExpanded(!isPeriodoExpanded)}
                className={`w-10 h-10 rounded-lg transition-colors flex items-center justify-center ${
                  isPeriodoExpanded 
                    ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800' 
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
                          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
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
                                ? 'bg-blue-700 dark:bg-blue-300' 
                                : isWeekend 
                                  ? 'bg-blue-300 dark:bg-blue-700' 
                                  : 'bg-blue-500 dark:bg-blue-400'
                            } group-hover:opacity-70`}
                            style={{ height: `${Math.max(heightPercent, dia.total > 0 ? 8 : 2)}%` }}
                          />
                        </div>
                        
                        <div className="invisible group-hover:visible absolute -top-8 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
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
                    <div className="w-3 h-3 rounded-sm bg-blue-500 dark:bg-blue-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Dias úteis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-700" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Fim de semana</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-700 dark:bg-blue-300" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Hoje</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Dashboards específicos por operação - controlado pelo filtro global */}
      <div className="space-y-6">
        {(selectedOperacao === 'all' || selectedOperacao === 'Sada') && (
          <SadaDashboard companyId={companyId!} />
        )}
        {(selectedOperacao === 'all' || selectedOperacao === 'Tegma') && (
          <TegmaDashboard companyId={companyId!} />
        )}
        {(selectedOperacao === 'all' || selectedOperacao === 'Superterminais') && (
          <SuperterminaisDashboard companyId={companyId!} />
        )}
        {(selectedOperacao === 'all' || selectedOperacao === 'Cesari') && (
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
        .select('id, motorista_id, veiculo_id, km_rodado, janta, data_hora_inicial')
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

      const km = parseFloat(viagem.km_rodado) || 0;
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
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-yellow-500 dark:bg-yellow-400 rounded-full"></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SADA</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Análise detalhada da operação</p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HorizontalBarChart 
                title="KM por Motorista" 
                data={stats.kmPorMotorista}
                color="bg-blue-600 dark:bg-blue-400"
              />
              <HorizontalBarChart 
                title="Carros por Motorista" 
                data={stats.carrosPorMotorista}
                color="bg-blue-500 dark:bg-blue-500"
              />
              <HorizontalBarChart 
                title="KM por Cavalo" 
                data={stats.kmPorCavalo}
                color="bg-blue-400 dark:bg-blue-600"
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
                          className="w-12 bg-blue-500 dark:bg-blue-400 rounded-t"
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
            <StatCard label="Viagens" value={stats.totalViagens} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="KM Total" value={stats.kmTotal > 1000 ? `${(stats.kmTotal / 1000).toFixed(1)} Mil` : stats.kmTotal} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="Volume de Jantas" value={stats.volumeJantas} color="text-blue-600 dark:text-blue-400" />
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
        .select('id, motorista_id, veiculo_id, km_rodado, janta, data_hora_inicial')
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

      const km = parseFloat(viagem.km_rodado) || 0;
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
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-orange-500 dark:bg-orange-400 rounded-full"></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">TEGMA</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Análise detalhada da operação</p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HorizontalBarChart 
                title="KM por Motorista" 
                data={stats.kmPorMotorista}
                color="bg-blue-600 dark:bg-blue-400"
              />
              <HorizontalBarChart 
                title="Carros por Motorista" 
                data={stats.carrosPorMotorista}
                color="bg-blue-500 dark:bg-blue-500"
              />
              <HorizontalBarChart 
                title="KM por Cavalo" 
                data={stats.kmPorCavalo}
                color="bg-blue-400 dark:bg-blue-600"
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
                          className="w-12 bg-blue-500 dark:bg-blue-400 rounded-t"
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
            <StatCard label="Viagens" value={stats.totalViagens} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="KM Total" value={stats.kmTotal > 1000 ? `${(stats.kmTotal / 1000).toFixed(1)} Mil` : stats.kmTotal} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="Volume de Jantas" value={stats.volumeJantas} color="text-blue-600 dark:text-blue-400" />
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
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-purple-500 dark:bg-purple-400 rounded-full"></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SUPER TERMINAIS</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Análise detalhada da operação portuária</p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HorizontalBarChart 
                title="Containers por Motorista" 
                data={stats.containersPorMotorista}
                color="bg-blue-600 dark:bg-blue-400"
              />
              <HorizontalBarChart 
                title="Containers por Cavalo" 
                data={stats.containersPorCavalo}
                color="bg-blue-500 dark:bg-blue-500"
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
                          className="w-12 bg-blue-500 dark:bg-blue-400 rounded-t"
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
            <StatCard label="Volume de Viagens" value={stats.totalViagens} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="Containers Cheio" value={stats.containersCheio} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="Containers Vazio" value={stats.containersVazio} color="text-blue-600 dark:text-blue-400" />
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
        .select('id, motorista_id, veiculo_id, km_rodado, data_hora_inicial')
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

      const km = parseFloat(viagem.km_rodado) || 0;
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
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-green-500 dark:bg-green-400 rounded-full"></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">CESARI</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Análise detalhada da operação</p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HorizontalBarChart 
                title="KM por Motorista" 
                data={stats.kmPorMotorista}
                color="bg-blue-600 dark:bg-blue-400"
              />
              <HorizontalBarChart 
                title="KM por Cavalo" 
                data={stats.kmPorCavalo}
                color="bg-blue-500 dark:bg-blue-500"
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
                          className="w-12 bg-blue-500 dark:bg-blue-400 rounded-t"
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
            <StatCard label="Viagens" value={stats.totalViagens} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="KM Total" value={stats.kmTotal > 1000 ? `${(stats.kmTotal / 1000).toFixed(2)} Mil` : stats.kmTotal} color="text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

const OperacoesViagens = ({ selectedOperacao, setSelectedOperacao }: { selectedOperacao: string; setSelectedOperacao: (op: string) => void }) => {
  const { companyId } = useCurrentAccount();
  const [selectedMotorista, setSelectedMotorista] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
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
    // Badges de operação coloridos para identificação visual
    const colors: Record<string, string> = {
      'Autoservice': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'Cesari': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'Mitsubishi': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'Sada': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Superterminais': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'Tegma': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[tipo || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Filtros - Design monocromático */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por motorista, placa, origem ou destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:bg-white"
              data-testid="input-search-viagens"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsMotoristaDropdownOpen(!isMotoristaDropdownOpen);
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

      {/* Tabela de viagens - Design monocromático */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
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
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Operação</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Destino</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredViagens.map((viagem) => (
                  <tr 
                    key={viagem.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedViagem(viagem)}
                    data-testid={`row-viagem-${viagem.id}`}
                  >
                    <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{viagem.id}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-900 dark:text-white font-medium">
                      {formatDateTime(viagem.data_hora_inicial)}
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      {viagem.operacao_tipo ? (
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getOperacaoColor(viagem.operacao_tipo)}`}>
                          {viagem.operacao_tipo}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">{viagem.motorista_nome || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{viagem.veiculo_placa || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                      {viagem.operacao_dados?.origem || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                      {viagem.operacao_dados?.destino || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                        viagem.data_hora_final 
                          ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
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

// Interface para faturamento
interface FaturamentoSada {
  id: number;
  created_at: string;
  updated_at: string | null;
  company_id?: number;
  familia_basica: string | null;
  compass: string | null;
  toro: string | null;
  commander: string | null;
  jlr: string | null;
  rampage: string | null;
  titano: string | null;
  scudo: string | null;
  ducato: string | null;
  caminhoes: string | null;
  comissao_motorista_prancha: string | null;
  comissao_motorista_cegonha: string | null;
}

interface FaturamentoSuperterminais {
  id: number;
  ganho_por_viagem: number | null;
  comissao_motorista: number | null;
  created_at: string;
}

interface FaturamentoMitsubishi {
  id: number;
  preco_por_veiculo: string | null;
  comissao_motorista: string | null;
  comissao_ajudante: string | null;
  created_at: string;
  updated_at: string | null;
}

interface FaturamentoAutoservice {
  id: number;
  valor_por_veiculo: number | null;
  comissao_motorista: number | null;
  comissao_ajudante: number | null;
  forma_pagamento_motorista: string | null;
  forma_pagamento_ajudante: string | null;
  created_at: string;
  updated_at: string | null;
}

// Componente Financeiro - Lista de viagens com cálculo de faturamento
const OperacoesFinanceiro = ({ selectedOperacao }: { selectedOperacao: string }) => {
  const { companyId } = useCurrentAccount();
  const [filtroPeriodo, setFiltroPeriodo] = useState<'15' | '30' | 'custom'>('30');
  const [isDateFilterExpanded, setIsDateFilterExpanded] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Função para filtrar viagens por período (usada por todas as operações)
  const filtrarPorPeriodo = (viagens: any[]) => {
    const agora = new Date();
    return viagens.filter((v: any) => {
      const dataViagem = v.data_viagem ? new Date(v.data_viagem) : null;
      if (!dataViagem) return false;
      
      if (filtroPeriodo === 'custom') {
        const inicio = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
        const fim = dataFim ? new Date(dataFim + 'T23:59:59') : null;
        if (inicio && dataViagem < inicio) return false;
        if (fim && dataViagem > fim) return false;
        return true;
      }
      
      const diasAtras = filtroPeriodo === '15' ? 15 : 30;
      const dataLimite = new Date(agora.getTime() - diasAtras * 24 * 60 * 60 * 1000);
      return dataViagem >= dataLimite;
    });
  };

  // Query para buscar os preços atuais da SADA
  const { data: precosSada } = useQuery({
    queryKey: ['faturamento-sada-precos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_sada')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data?.[0] as FaturamentoSada) || null;
    },
    enabled: selectedOperacao === 'all' || selectedOperacao === 'Sada',
  });

  // Query para buscar os preços atuais da SUPERTERMINAIS
  const { data: precosSuperterminais } = useQuery({
    queryKey: ['faturamento-superterminais-precos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_superterminais')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data?.[0] as FaturamentoSuperterminais) || null;
    },
    enabled: selectedOperacao === 'all' || selectedOperacao === 'Superterminais',
  });

  const { data: precosMitsubishi } = useQuery({
    queryKey: ['faturamento-mitsubishi-precos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_mitsubishi')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data?.[0] as FaturamentoMitsubishi) || null;
    },
    enabled: selectedOperacao === 'all' || selectedOperacao === 'Mitsubishi',
  });

  const { data: precosAutoservice } = useQuery({
    queryKey: ['faturamento-autoservice-precos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_autoservice')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as FaturamentoAutoservice) || null;
    },
    enabled: selectedOperacao === 'all' || selectedOperacao === 'Autoservice',
  });

  // Query para buscar viagens SADA com dados de faturamento
  const { data: viagensSada = [], isLoading: isLoadingSada, isError: isErrorSada } = useQuery({
    queryKey: ['financeiro-sada-viagens', companyId, selectedOperacao],
    queryFn: async () => {
      if (!companyId) return [];
      
      // Buscar viagens da empresa
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, data_hora_inicial, km_rodado')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) return [];
      
      const viagemIds = viagensEmpresa.map((v: any) => v.id);
      
      // Buscar operações SADA
      const { data: opData, error: opError } = await supabase
        .from('operacao_sada')
        .select('*')
        .in('id_viagem', viagemIds);
      
      if (opError || !opData) return [];
      
      // Buscar motoristas
      const motoristaIds = [...new Set(viagensEmpresa.map((v: any) => v.motorista_id).filter(Boolean))];
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .in('motorista_id', motoristaIds);
      
      const motoristasMap: Record<number, string> = {};
      (motoristasData || []).forEach((m: any) => { motoristasMap[m.motorista_id] = m.nome; });
      
      // Combinar dados
      return opData.map((op: any) => {
        const viagem = viagensEmpresa.find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          data_viagem: viagem?.data_hora_inicial,
          motorista_nome: viagem ? motoristasMap[viagem.motorista_id] || 'Desconhecido' : 'Desconhecido',
        };
      }).sort((a: any, b: any) => new Date(b.data_viagem || 0).getTime() - new Date(a.data_viagem || 0).getTime());
    },
    enabled: !!companyId && (selectedOperacao === 'all' || selectedOperacao === 'Sada'),
  });

  // Query para buscar viagens SUPERTERMINAIS com dados de faturamento
  const { data: viagensSuperterminais = [], isLoading: isLoadingSuperterminais, isError: isErrorSuperterminais } = useQuery({
    queryKey: ['financeiro-superterminais-viagens', companyId, selectedOperacao],
    queryFn: async () => {
      if (!companyId) return [];
      
      // Buscar viagens da empresa
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, data_hora_inicial, km_rodado')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) return [];
      
      const viagemIds = viagensEmpresa.map((v: any) => v.id);
      
      // Buscar operações SUPERTERMINAIS
      const { data: opData, error: opError } = await supabase
        .from('operacao_superterminais')
        .select('*')
        .in('id_viagem', viagemIds);
      
      if (opError || !opData) return [];
      
      // Buscar motoristas
      const motoristaIds = [...new Set(viagensEmpresa.map((v: any) => v.motorista_id).filter(Boolean))];
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .in('motorista_id', motoristaIds);
      
      const motoristasMap: Record<number, string> = {};
      motoristasData?.forEach((m: any) => {
        motoristasMap[m.motorista_id] = m.nome;
      });
      
      // Combinar dados
      return opData.map((op: any) => {
        const viagem = viagensEmpresa.find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          data_viagem: viagem?.data_hora_inicial,
          motorista_nome: viagem ? motoristasMap[viagem.motorista_id] || 'Desconhecido' : 'Desconhecido',
        };
      }).sort((a: any, b: any) => new Date(b.data_viagem || 0).getTime() - new Date(a.data_viagem || 0).getTime());
    },
    enabled: !!companyId && (selectedOperacao === 'all' || selectedOperacao === 'Superterminais'),
  });

  const { data: viagensMitsubishi = [], isLoading: isLoadingMitsubishiViagens, isError: isErrorMitsubishiViagens } = useQuery({
    queryKey: ['financeiro-mitsubishi-viagens', companyId, selectedOperacao],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, data_hora_inicial, km_rodado')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) return [];
      
      const viagemIds = viagensEmpresa.map((v: any) => v.id);
      
      const { data: opData, error: opError } = await supabase
        .from('operacao_mitsubishi')
        .select('*')
        .in('id_viagem', viagemIds);
      
      if (opError || !opData) return [];
      
      const motoristaIds = [...new Set(viagensEmpresa.map((v: any) => v.motorista_id).filter(Boolean))];
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .in('motorista_id', motoristaIds);
      
      const motoristasMap: Record<number, string> = {};
      (motoristasData || []).forEach((m: any) => { motoristasMap[m.motorista_id] = m.nome; });
      
      return opData.map((op: any) => {
        const viagem = viagensEmpresa.find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          data_viagem: viagem?.data_hora_inicial,
          motorista_nome: viagem ? motoristasMap[viagem.motorista_id] || 'Desconhecido' : 'Desconhecido',
        };
      }).sort((a: any, b: any) => new Date(b.data_viagem || 0).getTime() - new Date(a.data_viagem || 0).getTime());
    },
    enabled: !!companyId && (selectedOperacao === 'all' || selectedOperacao === 'Mitsubishi'),
  });

  const { data: viagensAutoservice = [], isLoading: isLoadingAutoserviceViagens, isError: isErrorAutoserviceViagens } = useQuery({
    queryKey: ['financeiro-autoservice-viagens', companyId, selectedOperacao],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data: viagensEmpresa } = await supabase
        .from('acompanhamento_viagem')
        .select('id, motorista_id, veiculo_id, data_hora_inicial, km_rodado')
        .eq('company_id', companyId);
      
      if (!viagensEmpresa || viagensEmpresa.length === 0) return [];
      
      const viagemIds = viagensEmpresa.map((v: any) => v.id);
      
      const { data: opData, error: opError } = await supabase
        .from('operacao_autoservice')
        .select('*')
        .in('id_viagem', viagemIds);
      
      if (opError || !opData) return [];
      
      const motoristaIds = [...new Set(viagensEmpresa.map((v: any) => v.motorista_id).filter(Boolean))];
      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .in('motorista_id', motoristaIds);
      
      const motoristasMap: Record<number, string> = {};
      (motoristasData || []).forEach((m: any) => { motoristasMap[m.motorista_id] = m.nome; });
      
      return opData.map((op: any) => {
        const viagem = viagensEmpresa.find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          data_viagem: viagem?.data_hora_inicial,
          motorista_nome: viagem ? motoristasMap[viagem.motorista_id] || 'Desconhecido' : 'Desconhecido',
        };
      }).sort((a: any, b: any) => new Date(b.data_viagem || 0).getTime() - new Date(a.data_viagem || 0).getTime());
    },
    enabled: !!companyId && (selectedOperacao === 'all' || selectedOperacao === 'Autoservice'),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Converte string de preço (formato BR ou US) para número
  const parsePreco = (valor: string | null): number => {
    if (!valor) return 0;
    // Remove espaços e R$
    let limpo = valor.replace(/[R$\s]/g, '').trim();
    // Se tem vírgula e ponto, assume formato BR (1.234,56)
    if (limpo.includes(',') && limpo.includes('.')) {
      limpo = limpo.replace(/\./g, '').replace(',', '.');
    } else if (limpo.includes(',')) {
      // Apenas vírgula, assume formato BR (234,56)
      limpo = limpo.replace(',', '.');
    }
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Mapeamento de modelo para chave do banco
  const modeloParaChave: Record<string, keyof FaturamentoSada> = {
    'familia_basica': 'familia_basica',
    'familia basica': 'familia_basica',
    'familia básica': 'familia_basica',
    'familiabasica': 'familia_basica',
    'familia': 'familia_basica',
    'basica': 'familia_basica',
    'compass': 'compass',
    'toro': 'toro',
    'commander': 'commander',
    'jlr': 'jlr',
    'rampage': 'rampage',
    'ram rampage': 'rampage',
    'ram': 'rampage',
    'titano': 'titano',
    'scudo': 'scudo',
    'ducato': 'ducato',
    'caminhoes': 'caminhoes',
    'caminhões': 'caminhoes',
    'caminhao': 'caminhoes',
    'caminhão': 'caminhoes',
  };

  // Função para extrair veículos e quantidades do texto do modelo
  // Ex: "2 compass e 1 toro" → [{modelo: 'compass', qtd: 2}, {modelo: 'toro', qtd: 1}]
  const parseModeloTexto = (texto: string): { modelo: string; qtd: number }[] => {
    const resultado: { modelo: string; qtd: number }[] = [];
    const textoLower = texto.toLowerCase().trim();
    
    // Padrão: número seguido de nome do modelo
    // Exemplos: "2 compass", "1 toro", "3 familia basica"
    const regex = /(\d+)\s*([a-záàâãéèêíïóôõöúçñ\s]+?)(?=\s*(?:e\s+\d|\+|\,|$))/gi;
    
    let match;
    while ((match = regex.exec(textoLower)) !== null) {
      const qtd = parseInt(match[1], 10);
      const modeloTexto = match[2].trim();
      
      if (qtd > 0 && modeloTexto) {
        resultado.push({ modelo: modeloTexto, qtd });
      }
    }
    
    // Se não encontrou com regex, tenta parsing simples
    if (resultado.length === 0) {
      // Tenta encontrar apenas o modelo (sem quantidade explícita)
      for (const chaveModelo of Object.keys(modeloParaChave)) {
        if (textoLower.includes(chaveModelo)) {
          resultado.push({ modelo: chaveModelo, qtd: 1 });
          break;
        }
      }
    }
    
    return resultado;
  };

  // Calcular valor do frete baseado no texto do modelo (parsing inteligente)
  const calcularValorFrete = (modelo: string | null, qtdCarrosTotal: number | null): number => {
    if (!modelo || !precosSada) return 0;
    
    const veiculosParsed = parseModeloTexto(modelo);
    
    if (veiculosParsed.length === 0) {
      // Fallback: se não conseguiu parsear, usa modelo direto com qtd_carros
      const modeloLower = modelo.toLowerCase().trim();
      const chave = modeloParaChave[modeloLower];
      if (chave && qtdCarrosTotal) {
        const precoUnitario = parsePreco(precosSada[chave] as string);
        return precoUnitario * qtdCarrosTotal;
      }
      return 0;
    }
    
    // Soma o valor de cada tipo de veículo encontrado
    let valorTotal = 0;
    for (const item of veiculosParsed) {
      const chave = modeloParaChave[item.modelo];
      if (chave) {
        const precoUnitario = parsePreco(precosSada[chave] as string);
        valorTotal += precoUnitario * item.qtd;
      }
    }
    
    return valorTotal;
  };

  // Calcular quantidade total de veículos do texto do modelo
  const calcularQtdTotal = (modelo: string | null, qtdCarrosFallback: number | null): number => {
    if (!modelo) return qtdCarrosFallback || 0;
    
    const veiculosParsed = parseModeloTexto(modelo);
    if (veiculosParsed.length > 0) {
      return veiculosParsed.reduce((sum, item) => sum + item.qtd, 0);
    }
    return qtdCarrosFallback || 0;
  };

  // Calcular comissão do motorista
  const calcularComissao = (tipoCarreta: number | null, modelo: string | null, qtdCarros: number | null): number => {
    if (!precosSada) return 0;
    
    const qtdTotal = calcularQtdTotal(modelo, qtdCarros);
    
    // tipo_carreta: 0 = Prancha (fixo), 1 = Cegonha (por veículo)
    if (tipoCarreta === 0) {
      return parsePreco(precosSada.comissao_motorista_prancha);
    } else if (tipoCarreta === 1) {
      const valorPorVeiculo = parsePreco(precosSada.comissao_motorista_cegonha);
      return valorPorVeiculo * qtdTotal;
    }
    return 0;
  };

  const renderSadaFinanceiro = () => {
    if (isLoadingSada) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando...</span>
        </div>
      );
    }

    if (isErrorSada) {
      return (
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-500 dark:text-red-400">Erro ao carregar dados de faturamento.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Por favor, tente novamente mais tarde.</p>
        </div>
      );
    }

    if (!precosSada) {
      return (
        <div className="text-center py-12">
          <Settings className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Preços não configurados para SADA.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Configure os preços na aba "Preços" para visualizar o faturamento.</p>
        </div>
      );
    }

    if (viagensSada.length === 0) {
      return (
        <div className="text-center py-12">
          <Wallet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma viagem SADA encontrada.</p>
        </div>
      );
    }

    // Filtrar viagens por período
    const viagensFiltradas = filtrarPorPeriodo(viagensSada);

    // Calcular totais
    let totalFrete = 0;
    let totalComissao = 0;
    viagensFiltradas.forEach((v: any) => {
      totalFrete += calcularValorFrete(v.modelo, v.qtd_carros);
      totalComissao += calcularComissao(v.tipo_carreta, v.modelo, v.qtd_carros);
    });

    return (
      <div className="space-y-6">
        {/* Cards de resumo - Design monocromático */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Frete</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalFrete)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Comissões</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalComissao)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Viagens</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{viagensFiltradas.length}</p>
          </div>
        </div>

        {/* Tabela de viagens - Layout limpo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modelo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qtd</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor Frete</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {viagensFiltradas.map((viagem: any) => {
                  const valorFrete = calcularValorFrete(viagem.modelo, viagem.qtd_carros);
                  const comissao = calcularComissao(viagem.tipo_carreta, viagem.modelo, viagem.qtd_carros);
                  const tipoCarreta = viagem.tipo_carreta === 0 ? 'Prancha' : viagem.tipo_carreta === 1 ? 'Cegonha' : '-';
                  
                  return (
                    <tr key={viagem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                        {formatDate(viagem.data_viagem)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {viagem.motorista_nome}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {viagem.modelo || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-center">
                        {viagem.qtd_carros || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                          viagem.tipo_carreta === 0 
                            ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            : 'bg-gray-800 text-white dark:bg-gray-600 dark:text-gray-100'
                        }`}>
                          {tipoCarreta}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                        {formatCurrency(valorFrete)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300 text-right">
                        {formatCurrency(comissao)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Função de renderização para SUPERTERMINAIS
  const renderSuperterminaisFinanceiro = () => {
    if (isLoadingSuperterminais) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando viagens...</span>
        </div>
      );
    }

    if (isErrorSuperterminais) {
      return (
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-500 dark:text-red-400">Erro ao carregar dados de faturamento.</p>
        </div>
      );
    }

    if (!viagensSuperterminais || viagensSuperterminais.length === 0) {
      return (
        <div className="text-center py-12">
          <Wallet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma viagem SUPERTERMINAIS encontrada.</p>
        </div>
      );
    }

    // Filtrar viagens por período
    const viagensFiltradas = filtrarPorPeriodo(viagensSuperterminais);

    // Valores de preço (usa preço da tabela ou valores padrão)
    const valorViagem = precosSuperterminais?.ganho_por_viagem ?? 135;
    const comissaoMotorista = precosSuperterminais?.comissao_motorista ?? 10;

    // Calcular totais (valor fixo por viagem)
    const totalFrete = viagensFiltradas.length * valorViagem;
    const totalComissao = viagensFiltradas.length * comissaoMotorista;

    return (
      <div className="space-y-6">
        {/* Cards de resumo - Design monocromático */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Recebido</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalFrete)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(valorViagem)} por viagem</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Comissões</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalComissao)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(comissaoMotorista)} por viagem</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Viagens</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{viagensFiltradas.length}</p>
          </div>
        </div>

        {/* Tabela de viagens - Layout limpo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {viagensFiltradas.map((viagem: any) => (
                  <tr key={viagem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                      {formatDate(viagem.data_viagem)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {viagem.motorista_nome}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                      {formatCurrency(valorViagem)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300 text-right">
                      {formatCurrency(comissaoMotorista)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMitsubishiFinanceiro = () => {
    if (isLoadingMitsubishiViagens) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400" data-testid="text-loading-mitsubishi">Carregando viagens...</span>
        </div>
      );
    }

    if (isErrorMitsubishiViagens) {
      return (
        <div className="text-center py-12" data-testid="text-error-mitsubishi">
          <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-500 dark:text-red-400">Erro ao carregar dados de faturamento.</p>
        </div>
      );
    }

    if (!viagensMitsubishi || viagensMitsubishi.length === 0) {
      return (
        <div className="text-center py-12" data-testid="text-empty-mitsubishi">
          <Wallet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma viagem MITSUBISHI encontrada.</p>
        </div>
      );
    }

    const viagensFiltradas = filtrarPorPeriodo(viagensMitsubishi);

    const precoPorVeiculo = parsePreco(precosMitsubishi?.preco_por_veiculo || '0');
    const comissaoMotorista = parsePreco(precosMitsubishi?.comissao_motorista || '0');
    const comissaoAjudante = parsePreco(precosMitsubishi?.comissao_ajudante || '0');

    let totalRecebido = 0;
    viagensFiltradas.forEach((v: any) => {
      totalRecebido += precoPorVeiculo * (v.qtd_carro || 0);
    });
    const totalComissaoMotorista = viagensFiltradas.length * comissaoMotorista;
    const totalComissaoAjudante = viagensFiltradas.length * comissaoAjudante;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-mitsubishi-total-recebido">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Recebido</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-mitsubishi-total-recebido">{formatCurrency(totalRecebido)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(precoPorVeiculo)} por veículo</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-mitsubishi-comissao-motorista">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Comissões Motorista</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-mitsubishi-comissao-motorista">{formatCurrency(totalComissaoMotorista)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(comissaoMotorista)} por viagem</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-mitsubishi-comissao-ajudante">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Comissões Ajudante</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-mitsubishi-comissao-ajudante">{formatCurrency(totalComissaoAjudante)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(comissaoAjudante)} por viagem</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-mitsubishi-total-viagens">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Viagens</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-mitsubishi-total-viagens">{viagensFiltradas.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full" data-testid="table-mitsubishi-financeiro">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origem → Destino</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qtd Veículos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modelo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comissão Mot.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {viagensFiltradas.map((viagem: any) => {
                  const valorViagem = precoPorVeiculo * (viagem.qtd_carro || 0);
                  
                  return (
                    <tr key={viagem.id_operacao} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors" data-testid={`row-mitsubishi-${viagem.id_operacao}`}>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                        {formatDate(viagem.data_viagem)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {viagem.motorista_nome}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {viagem.origem || '-'} → {viagem.destino || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-center">
                        {viagem.qtd_carro || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {viagem.modelo_carro || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                        {formatCurrency(valorViagem)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300 text-right">
                        {formatCurrency(comissaoMotorista)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAutoserviceFinanceiro = () => {
    if (isLoadingAutoserviceViagens) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400" data-testid="text-loading-autoservice">Carregando viagens...</span>
        </div>
      );
    }

    if (isErrorAutoserviceViagens) {
      return (
        <div className="text-center py-12" data-testid="text-error-autoservice">
          <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-500 dark:text-red-400">Erro ao carregar dados de faturamento.</p>
        </div>
      );
    }

    if (!viagensAutoservice || viagensAutoservice.length === 0) {
      return (
        <div className="text-center py-12" data-testid="text-empty-autoservice">
          <Wallet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma viagem AUTOSERVICE encontrada.</p>
        </div>
      );
    }

    const viagensFiltradas = filtrarPorPeriodo(viagensAutoservice);

    const valorPorVeiculo = precosAutoservice?.valor_por_veiculo ?? 0;
    const comissaoMotorista = precosAutoservice?.comissao_motorista ?? 0;
    const comissaoAjudante = precosAutoservice?.comissao_ajudante ?? 0;

    let totalRecebido = 0;
    viagensFiltradas.forEach((v: any) => {
      totalRecebido += valorPorVeiculo * (v.qtd_carro || 0);
    });
    const totalComissaoMotorista = viagensFiltradas.length * comissaoMotorista;
    const totalComissaoAjudante = viagensFiltradas.length * comissaoAjudante;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-autoservice-total-recebido">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Recebido</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-autoservice-total-recebido">{formatCurrency(totalRecebido)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(valorPorVeiculo)} por veículo</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-autoservice-comissao-motorista">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Comissões Motorista</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-autoservice-comissao-motorista">{formatCurrency(totalComissaoMotorista)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(comissaoMotorista)} por viagem</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-autoservice-comissao-ajudante">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Comissões Ajudante</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-autoservice-comissao-ajudante">{formatCurrency(totalComissaoAjudante)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatCurrency(comissaoAjudante)} por viagem</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-autoservice-total-viagens">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Viagens</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-autoservice-total-viagens">{viagensFiltradas.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full" data-testid="table-autoservice-financeiro">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origem → Destino</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qtd Veículos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modelo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comissão Mot.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {viagensFiltradas.map((viagem: any) => {
                  const valorViagem = valorPorVeiculo * (viagem.qtd_carro || 0);
                  
                  return (
                    <tr key={viagem.id_operacao} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors" data-testid={`row-autoservice-${viagem.id_operacao}`}>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                        {formatDate(viagem.data_viagem)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {viagem.motorista_nome}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {viagem.origem || '-'} → {viagem.destino || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-center">
                        {viagem.qtd_carro || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {viagem.modelo_carro || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                        {formatCurrency(valorViagem)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300 text-right">
                        {formatCurrency(comissaoMotorista)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderFinanceiroContent = () => {
    if (selectedOperacao === 'all') {
      return (
        <div className="space-y-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-yellow-500 dark:bg-yellow-400 rounded-full" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SADA</h3>
            </div>
            {renderSadaFinanceiro()}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-purple-500 dark:bg-purple-400 rounded-full" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SUPERTERMINAIS</h3>
            </div>
            {renderSuperterminaisFinanceiro()}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-red-500 dark:bg-red-400 rounded-full" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="text-mitsubishi-section-title">MITSUBISHI</h3>
            </div>
            {renderMitsubishiFinanceiro()}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-blue-500 dark:bg-blue-400 rounded-full" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="text-autoservice-section-title">AUTOSERVICE</h3>
            </div>
            {renderAutoserviceFinanceiro()}
          </div>
        </div>
      );
    }

    if (selectedOperacao === 'Sada') {
      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-yellow-500 dark:bg-yellow-400 rounded-full" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SADA</h3>
          </div>
          {renderSadaFinanceiro()}
        </div>
      );
    }

    if (selectedOperacao === 'Superterminais') {
      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-purple-500 dark:bg-purple-400 rounded-full" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SUPERTERMINAIS</h3>
          </div>
          {renderSuperterminaisFinanceiro()}
        </div>
      );
    }

    if (selectedOperacao === 'Mitsubishi') {
      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-red-500 dark:bg-red-400 rounded-full" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="text-mitsubishi-financeiro-title">MITSUBISHI</h3>
          </div>
          {renderMitsubishiFinanceiro()}
        </div>
      );
    }

    if (selectedOperacao === 'Autoservice') {
      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-blue-500 dark:bg-blue-400 rounded-full" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white" data-testid="text-autoservice-financeiro-title">AUTOSERVICE</h3>
          </div>
          {renderAutoserviceFinanceiro()}
        </div>
      );
    }

    return (
      <div className="text-center py-12">
        <Wallet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Faturamento para {selectedOperacao} ainda não está disponível.</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Esta funcionalidade será implementada em breve.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Financeiro</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Registros de comissão e recebimento por operação</p>
        </div>

        {/* Filtro de período global */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            <button
              onClick={() => { setFiltroPeriodo('15'); setDataInicio(''); setDataFim(''); }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filtroPeriodo === '15'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              data-testid="filter-15-days"
            >
              15 dias
            </button>
            <button
              onClick={() => { setFiltroPeriodo('30'); setDataInicio(''); setDataFim(''); }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filtroPeriodo === '30'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              data-testid="filter-30-days"
            >
              30 dias
            </button>
          </div>

          <button
            onClick={() => setIsDateFilterExpanded(!isDateFilterExpanded)}
            className={`p-2 border rounded-lg transition-colors ${
              filtroPeriodo === 'custom'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            title="Filtrar por Data Personalizada"
            data-testid="button-toggle-date-filter-financeiro"
          >
            <Calendar className="w-4 h-4" />
          </button>

          {isDateFilterExpanded && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => { setDataInicio(e.target.value); setFiltroPeriodo('custom'); }}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                data-testid="input-data-inicio-financeiro"
              />
              <span className="text-gray-400 text-sm">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => { setDataFim(e.target.value); setFiltroPeriodo('custom'); }}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                data-testid="input-data-fim-financeiro"
              />
              {(dataInicio || dataFim) && (
                <button
                  onClick={() => { setDataInicio(''); setDataFim(''); setFiltroPeriodo('30'); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Limpar filtro de data"
                  data-testid="button-limpar-data-financeiro"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {renderFinanceiroContent()}
    </div>
  );
};

// Componente Preços - Edição de preços e comissões
const OperacoesPrecos = ({ selectedOperacao }: { selectedOperacao: string }) => {
  const { companyId } = useCurrentAccount();
  const [editingSada, setEditingSada] = useState(false);
  const [sadaForm, setSadaForm] = useState<Partial<FaturamentoSada>>({});
  const [editingSuperterminais, setEditingSuperterminais] = useState(false);
  const [superterminaisForm, setSuperterminaisForm] = useState<Partial<FaturamentoSuperterminais>>({});
  const [editingMitsubishi, setEditingMitsubishi] = useState(false);
  const [mitsubishiForm, setMitsubishiForm] = useState<Partial<FaturamentoMitsubishi>>({});
  const [editingAutoservice, setEditingAutoservice] = useState(false);
  const [autoserviceForm, setAutoserviceForm] = useState<Partial<FaturamentoAutoservice>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Query para buscar último registro de faturamento SADA
  // NOTA: A tabela atual não tem company_id. Para multi-tenancy, adicionar coluna company_id à tabela.
  const { data: currentSadaPrices, isLoading: isLoadingSada, isError: isErrorSada, refetch: refetchSada } = useQuery({
    queryKey: ['faturamento-sada-current', selectedOperacao],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_sada')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data?.[0] as FaturamentoSada) || null;
    },
    enabled: selectedOperacao === 'all' || selectedOperacao === 'Sada',
  });

  // Query para buscar último registro de faturamento SUPERTERMINAIS
  const { data: currentSuperterminaisPrices, isLoading: isLoadingSuperterminais, isError: isErrorSuperterminais, refetch: refetchSuperterminais } = useQuery({
    queryKey: ['faturamento-superterminais-current', selectedOperacao],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_superterminais')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data?.[0] as FaturamentoSuperterminais) || null;
    },
    enabled: selectedOperacao === 'all' || selectedOperacao === 'Superterminais',
  });

  const { data: currentMitsubishiPrices, isLoading: isLoadingMitsubishi, isError: isErrorMitsubishi, refetch: refetchMitsubishi } = useQuery({
    queryKey: ['faturamento-mitsubishi-current', selectedOperacao],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_mitsubishi')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data?.[0] as FaturamentoMitsubishi) || null;
    },
    enabled: selectedOperacao === 'all' || selectedOperacao === 'Mitsubishi',
  });

  const { data: currentAutoservicePrices, isLoading: isLoadingAutoservice, isError: isErrorAutoservice, refetch: refetchAutoservice } = useQuery({
    queryKey: ['faturamento-autoservice-current', selectedOperacao],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faturamento_autoservice')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return (data?.[0] as FaturamentoAutoservice) || null;
    },
    enabled: selectedOperacao === 'all' || selectedOperacao === 'Autoservice',
  });

  useEffect(() => {
    if (currentSadaPrices) {
      setSadaForm(currentSadaPrices);
    }
  }, [currentSadaPrices]);

  useEffect(() => {
    if (currentSuperterminaisPrices) {
      setSuperterminaisForm(currentSuperterminaisPrices);
    }
  }, [currentSuperterminaisPrices]);

  useEffect(() => {
    if (currentMitsubishiPrices) {
      setMitsubishiForm(currentMitsubishiPrices);
    }
  }, [currentMitsubishiPrices]);

  useEffect(() => {
    if (currentAutoservicePrices) {
      setAutoserviceForm(currentAutoservicePrices);
    }
  }, [currentAutoservicePrices]);

  useEffect(() => {
    setEditingSada(false);
    setEditingSuperterminais(false);
    setEditingMitsubishi(false);
    setEditingAutoservice(false);
    setSaveError(null);
  }, [companyId]);

  const handleSadaChange = (field: string, value: string) => {
    setSadaForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSada = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const updateData = {
        familia_basica: sadaForm.familia_basica || null,
        compass: sadaForm.compass || null,
        toro: sadaForm.toro || null,
        commander: sadaForm.commander || null,
        jlr: sadaForm.jlr || null,
        rampage: sadaForm.rampage || null,
        titano: sadaForm.titano || null,
        scudo: sadaForm.scudo || null,
        ducato: sadaForm.ducato || null,
        caminhoes: sadaForm.caminhoes || null,
        comissao_motorista_prancha: sadaForm.comissao_motorista_prancha || null,
        comissao_motorista_cegonha: sadaForm.comissao_motorista_cegonha || null,
        updated_at: new Date().toISOString(),
      };

      if (currentSadaPrices?.id) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('faturamento_sada')
          .update(updateData)
          .eq('id', currentSadaPrices.id);
        
        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('faturamento_sada')
          .insert([updateData]);
        
        if (error) throw error;
      }

      await refetchSada();
      setEditingSada(false);
    } catch (error: any) {
      console.error('Erro ao salvar preços SADA:', error);
      setSaveError(error?.message || 'Erro ao salvar preços. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuperterminaisChange = (field: string, value: string) => {
    setSuperterminaisForm(prev => ({ ...prev, [field]: value }));
  };

  const handleMitsubishiChange = (field: string, value: string) => {
    setMitsubishiForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAutoserviceChange = (field: string, value: string) => {
    setAutoserviceForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveMitsubishi = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const updateData = {
        preco_por_veiculo: mitsubishiForm.preco_por_veiculo || null,
        comissao_motorista: mitsubishiForm.comissao_motorista || null,
        comissao_ajudante: mitsubishiForm.comissao_ajudante || null,
        updated_at: new Date().toISOString(),
      };

      if (currentMitsubishiPrices?.id) {
        const { error } = await supabase
          .from('faturamento_mitsubishi')
          .update(updateData)
          .eq('id', currentMitsubishiPrices.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('faturamento_mitsubishi')
          .insert([updateData]);
        
        if (error) throw error;
      }

      await refetchMitsubishi();
      setEditingMitsubishi(false);
    } catch (error: any) {
      console.error('Erro ao salvar preços MITSUBISHI:', error);
      setSaveError(error?.message || 'Erro ao salvar preços. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSuperterminais = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const updateData = {
        ganho_por_viagem: superterminaisForm.ganho_por_viagem !== null && superterminaisForm.ganho_por_viagem !== undefined ? Number(superterminaisForm.ganho_por_viagem) : null,
        comissao_motorista: superterminaisForm.comissao_motorista !== null && superterminaisForm.comissao_motorista !== undefined ? Number(superterminaisForm.comissao_motorista) : null,
      };

      if (currentSuperterminaisPrices?.id) {
        const { error } = await supabase
          .from('faturamento_superterminais')
          .update(updateData)
          .eq('id', currentSuperterminaisPrices.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('faturamento_superterminais')
          .insert([updateData]);
        
        if (error) throw error;
      }

      await refetchSuperterminais();
      setEditingSuperterminais(false);
    } catch (error: any) {
      console.error('Erro ao salvar preços SUPERTERMINAIS:', error);
      setSaveError(error?.message || 'Erro ao salvar preços. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAutoservice = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const updateData = {
        valor_por_veiculo: autoserviceForm.valor_por_veiculo !== null && autoserviceForm.valor_por_veiculo !== undefined ? Number(autoserviceForm.valor_por_veiculo) : null,
        comissao_motorista: autoserviceForm.comissao_motorista !== null && autoserviceForm.comissao_motorista !== undefined ? Number(autoserviceForm.comissao_motorista) : null,
        comissao_ajudante: autoserviceForm.comissao_ajudante !== null && autoserviceForm.comissao_ajudante !== undefined ? Number(autoserviceForm.comissao_ajudante) : null,
        forma_pagamento_motorista: autoserviceForm.forma_pagamento_motorista || null,
        forma_pagamento_ajudante: autoserviceForm.forma_pagamento_ajudante || null,
        updated_at: new Date().toISOString(),
      };

      if (currentAutoservicePrices?.id) {
        const { error } = await supabase
          .from('faturamento_autoservice')
          .update(updateData)
          .eq('id', currentAutoservicePrices.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('faturamento_autoservice')
          .insert([updateData]);
        
        if (error) throw error;
      }

      await refetchAutoservice();
      setEditingAutoservice(false);
    } catch (error: any) {
      console.error('Erro ao salvar preços AUTOSERVICE:', error);
      setSaveError(error?.message || 'Erro ao salvar preços. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const sadaCampos = [
    { key: 'familia_basica', label: 'Família Básica', group: 'veiculos' },
    { key: 'compass', label: 'Compass', group: 'veiculos' },
    { key: 'toro', label: 'Toro', group: 'veiculos' },
    { key: 'commander', label: 'Commander', group: 'veiculos' },
    { key: 'jlr', label: 'JLR', group: 'veiculos' },
    { key: 'rampage', label: 'RAM Rampage', group: 'veiculos' },
    { key: 'titano', label: 'Titano', group: 'veiculos' },
    { key: 'scudo', label: 'Scudo', group: 'veiculos' },
    { key: 'ducato', label: 'Ducato', group: 'veiculos' },
    { key: 'caminhoes', label: 'Caminhões', group: 'veiculos' },
    { key: 'comissao_motorista_cegonha', label: 'Cegonha (por veículo)', group: 'comissao' },
    { key: 'comissao_motorista_prancha', label: 'Prancha (fixo por viagem)', group: 'comissao' },
  ];

  const renderSadaPrecos = () => {
    if (isLoadingSada) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando...</span>
        </div>
      );
    }

    if (isErrorSada) {
      return (
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-500 dark:text-red-400">Erro ao carregar preços.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Por favor, tente novamente mais tarde.</p>
        </div>
      );
    }

    const veiculosCampos = sadaCampos.filter(c => c.group === 'veiculos');
    const comissaoCampos = sadaCampos.filter(c => c.group === 'comissao');

    return (
      <div className="space-y-6">
        {saveError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-400 text-sm">{saveError}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentSadaPrices ? 'Última atualização: ' + new Date(currentSadaPrices.updated_at || currentSadaPrices.created_at).toLocaleDateString('pt-BR') : 'Nenhum preço configurado'}
          </p>
          {!editingSada ? (
            <button
              onClick={() => setEditingSada(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="button-edit-sada-prices"
            >
              <Edit className="w-4 h-4" />
              Editar Preços
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingSada(false);
                  setSadaForm(currentSadaPrices || {});
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSada}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                data-testid="button-save-sada-prices"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          )}
        </div>

        {/* Preços por Veículo */}
        <div>
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Car className="w-4 h-4" />
            Preços por Modelo de Veículo (por carro)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {veiculosCampos.map((campo) => (
              <div key={campo.key} className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {campo.label}
                </label>
                {editingSada ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">R$</span>
                    <input
                      type="text"
                      value={sadaForm[campo.key as keyof FaturamentoSada] || ''}
                      onChange={(e) => handleSadaChange(campo.key, e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      data-testid={`input-sada-${campo.key}`}
                    />
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white flex items-center gap-1">
                    <span className="text-gray-500 dark:text-gray-400">R$</span>
                    {currentSadaPrices?.[campo.key as keyof FaturamentoSada] || '-'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Comissões */}
        <div>
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Comissões do Motorista (por viagem)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comissaoCampos.map((campo) => (
              <div key={campo.key} className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {campo.label}
                </label>
                {editingSada ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">R$</span>
                    <input
                      type="text"
                      value={sadaForm[campo.key as keyof FaturamentoSada] || ''}
                      onChange={(e) => handleSadaChange(campo.key, e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      data-testid={`input-sada-${campo.key}`}
                    />
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white flex items-center gap-1">
                    <span className="text-gray-500 dark:text-gray-400">R$</span>
                    {currentSadaPrices?.[campo.key as keyof FaturamentoSada] || '-'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Função de renderização de preços para SUPERTERMINAIS
  const renderSuperterminaisPrecos = () => {
    if (isLoadingSuperterminais) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando...</span>
        </div>
      );
    }

    if (isErrorSuperterminais) {
      return (
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-500 dark:text-red-400">Erro ao carregar preços.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Por favor, tente novamente mais tarde.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {saveError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-400 text-sm">{saveError}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentSuperterminaisPrices ? 'Criado em: ' + new Date(currentSuperterminaisPrices.created_at).toLocaleDateString('pt-BR') : 'Nenhum preço configurado'}
          </p>
          {!editingSuperterminais ? (
            <button
              onClick={() => setEditingSuperterminais(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="button-edit-superterminais-prices"
            >
              <Edit className="w-4 h-4" />
              Editar Preços
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingSuperterminais(false);
                  setSuperterminaisForm(currentSuperterminaisPrices || {});
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSuperterminais}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                data-testid="button-save-superterminais-prices"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          )}
        </div>

        {/* Valores por Viagem */}
        <div>
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Valores por Viagem (valor fixo)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Valor por Viagem (Recebido)
              </label>
              {editingSuperterminais ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={superterminaisForm.ganho_por_viagem ?? ''}
                    onChange={(e) => handleSuperterminaisChange('ganho_por_viagem', e.target.value)}
                    placeholder="135"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    data-testid="input-superterminais-ganho_por_viagem"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-400">R$</span>
                  {currentSuperterminaisPrices?.ganho_por_viagem ?? '135'}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Comissão do Motorista (por viagem)
              </label>
              {editingSuperterminais ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={superterminaisForm.comissao_motorista ?? ''}
                    onChange={(e) => handleSuperterminaisChange('comissao_motorista', e.target.value)}
                    placeholder="10"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    data-testid="input-superterminais-comissao_motorista"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-400">R$</span>
                  {currentSuperterminaisPrices?.comissao_motorista ?? '10'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <p className="text-sm text-purple-700 dark:text-purple-300">
            <strong>Modelo de Precificação SUPERTERMINAIS:</strong> Valor fixo por viagem, independente do tipo de carga ou distância.
          </p>
        </div>
      </div>
    );
  };

  const renderMitsubishiPrecos = () => {
    if (isLoadingMitsubishi) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando...</span>
        </div>
      );
    }

    if (isErrorMitsubishi) {
      return (
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-500 dark:text-red-400">Erro ao carregar preços.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Por favor, tente novamente mais tarde.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {saveError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-400 text-sm">{saveError}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentMitsubishiPrices ? 'Última atualização: ' + new Date(currentMitsubishiPrices.updated_at || currentMitsubishiPrices.created_at).toLocaleDateString('pt-BR') : 'Nenhum preço configurado'}
          </p>
          {!editingMitsubishi ? (
            <button
              onClick={() => setEditingMitsubishi(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="button-edit-mitsubishi-prices"
            >
              <Edit className="w-4 h-4" />
              Editar Preços
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingMitsubishi(false);
                  setMitsubishiForm(currentMitsubishiPrices || {});
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMitsubishi}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                data-testid="button-save-mitsubishi-prices"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Valores e Comissões
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Preço por Veículo
              </label>
              {editingMitsubishi ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={mitsubishiForm.preco_por_veiculo || ''}
                    onChange={(e) => handleMitsubishiChange('preco_por_veiculo', e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    data-testid="input-mitsubishi-preco_por_veiculo"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-400">R$</span>
                  {currentMitsubishiPrices?.preco_por_veiculo || '-'}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Comissão do Motorista
              </label>
              {editingMitsubishi ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={mitsubishiForm.comissao_motorista || ''}
                    onChange={(e) => handleMitsubishiChange('comissao_motorista', e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    data-testid="input-mitsubishi-comissao_motorista"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-400">R$</span>
                  {currentMitsubishiPrices?.comissao_motorista || '-'}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Comissão do Ajudante
              </label>
              {editingMitsubishi ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={mitsubishiForm.comissao_ajudante || ''}
                    onChange={(e) => handleMitsubishiChange('comissao_ajudante', e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    data-testid="input-mitsubishi-comissao_ajudante"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-400">R$</span>
                  {currentMitsubishiPrices?.comissao_ajudante || '-'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">
            <strong>Modelo de Precificação MITSUBISHI:</strong> Valor fixo por veículo transportado, com comissões separadas para motorista e ajudante.
          </p>
        </div>
      </div>
    );
  };

  const renderAutoservicePrecos = () => {
    if (isLoadingAutoservice) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500 dark:text-gray-400" data-testid="text-loading-autoservice-precos">Carregando preços...</span>
        </div>
      );
    }

    if (isErrorAutoservice) {
      return (
        <div className="text-center py-8" data-testid="text-error-autoservice-precos">
          <XCircle className="w-10 h-10 mx-auto text-red-400 mb-3" />
          <p className="text-red-500 dark:text-red-400">Erro ao carregar preços.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white" data-testid="text-autoservice-precos-title">Valores por Veículo e Comissões</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Configure os valores de faturamento para operação Autoservice</p>
          </div>
          <div className="flex items-center gap-2">
            {editingAutoservice ? (
              <>
                <button
                  onClick={() => {
                    setEditingAutoservice(false);
                    if (currentAutoservicePrices) setAutoserviceForm(currentAutoservicePrices);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  data-testid="button-cancel-autoservice"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAutoservice}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                  data-testid="button-save-autoservice"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salvar
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditingAutoservice(true)}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                data-testid="button-edit-autoservice"
              >
                <Edit2 className="w-3 h-3" />
                Editar
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-600 dark:text-red-400" data-testid="text-error-save-autoservice">{saveError}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Valor por Veículo</label>
              {editingAutoservice ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                  <input
                    type="text"
                    value={autoserviceForm.valor_por_veiculo ?? ''}
                    onChange={(e) => handleAutoserviceChange('valor_por_veiculo', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    data-testid="input-autoservice-valor-por-veiculo"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm font-medium text-gray-900 dark:text-white" data-testid="text-autoservice-valor-por-veiculo">
                  R$ {currentAutoservicePrices?.valor_por_veiculo ?? '-'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Comissão Motorista</label>
              {editingAutoservice ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                  <input
                    type="text"
                    value={autoserviceForm.comissao_motorista ?? ''}
                    onChange={(e) => handleAutoserviceChange('comissao_motorista', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    data-testid="input-autoservice-comissao-motorista"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm font-medium text-gray-900 dark:text-white" data-testid="text-autoservice-comissao-motorista">
                  R$ {currentAutoservicePrices?.comissao_motorista ?? '-'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Comissão Ajudante</label>
              {editingAutoservice ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                  <input
                    type="text"
                    value={autoserviceForm.comissao_ajudante ?? ''}
                    onChange={(e) => handleAutoserviceChange('comissao_ajudante', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    data-testid="input-autoservice-comissao-ajudante"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm font-medium text-gray-900 dark:text-white" data-testid="text-autoservice-comissao-ajudante">
                  R$ {currentAutoservicePrices?.comissao_ajudante ?? '-'}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Forma de Pagamento Motorista</label>
              {editingAutoservice ? (
                <input
                  type="text"
                  value={autoserviceForm.forma_pagamento_motorista ?? ''}
                  onChange={(e) => handleAutoserviceChange('forma_pagamento_motorista', e.target.value)}
                  placeholder="Ex: PIX, Transferência"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="input-autoservice-forma-pagamento-motorista"
                />
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm font-medium text-gray-900 dark:text-white" data-testid="text-autoservice-forma-pagamento-motorista">
                  {currentAutoservicePrices?.forma_pagamento_motorista || '-'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Forma de Pagamento Ajudante</label>
              {editingAutoservice ? (
                <input
                  type="text"
                  value={autoserviceForm.forma_pagamento_ajudante ?? ''}
                  onChange={(e) => handleAutoserviceChange('forma_pagamento_ajudante', e.target.value)}
                  placeholder="Ex: PIX, Transferência"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="input-autoservice-forma-pagamento-ajudante"
                />
              ) : (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm font-medium text-gray-900 dark:text-white" data-testid="text-autoservice-forma-pagamento-ajudante">
                  {currentAutoservicePrices?.forma_pagamento_ajudante || '-'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Modelo de Precificação AUTOSERVICE:</strong> Valor fixo por veículo transportado, com comissões separadas para motorista e ajudante.
          </p>
        </div>
      </div>
    );
  };

  const renderPrecosContent = () => {
    if (selectedOperacao === 'all') {
      return (
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-900 dark:bg-gray-900 px-4 py-3">
              <h3 className="text-lg font-semibold text-white">SADA - Configuração de Preços</h3>
            </div>
            <div className="p-4">
              {renderSadaPrecos()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-900 dark:bg-gray-900 px-4 py-3">
              <h3 className="text-lg font-semibold text-white">SUPERTERMINAIS - Configuração de Preços</h3>
            </div>
            <div className="p-4">
              {renderSuperterminaisPrecos()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-900 dark:bg-gray-900 px-4 py-3">
              <h3 className="text-lg font-semibold text-white">MITSUBISHI - Configuração de Preços</h3>
            </div>
            <div className="p-4">
              {renderMitsubishiPrecos()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-900 dark:bg-gray-900 px-4 py-3">
              <h3 className="text-lg font-semibold text-white">AUTOSERVICE - Configuração de Preços</h3>
            </div>
            <div className="p-4">
              {renderAutoservicePrecos()}
            </div>
          </div>
        </div>
      );
    }

    if (selectedOperacao === 'Sada') {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-900 dark:bg-gray-900 px-4 py-3">
            <h3 className="text-lg font-semibold text-white">SADA - Configuração de Preços</h3>
          </div>
          <div className="p-4">
            {renderSadaPrecos()}
          </div>
        </div>
      );
    }

    if (selectedOperacao === 'Superterminais') {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-900 dark:bg-gray-900 px-4 py-3">
            <h3 className="text-lg font-semibold text-white">SUPERTERMINAIS - Configuração de Preços</h3>
          </div>
          <div className="p-4">
            {renderSuperterminaisPrecos()}
          </div>
        </div>
      );
    }

    if (selectedOperacao === 'Mitsubishi') {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-900 dark:bg-gray-900 px-4 py-3">
            <h3 className="text-lg font-semibold text-white">MITSUBISHI - Configuração de Preços</h3>
          </div>
          <div className="p-4">
            {renderMitsubishiPrecos()}
          </div>
        </div>
      );
    }

    if (selectedOperacao === 'Autoservice') {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-900 dark:bg-gray-900 px-4 py-3">
            <h3 className="text-lg font-semibold text-white">AUTOSERVICE - Configuração de Preços</h3>
          </div>
          <div className="p-4">
            {renderAutoservicePrecos()}
          </div>
        </div>
      );
    }

    return (
      <div className="text-center py-12">
        <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Configuração de preços para {selectedOperacao} ainda não está disponível.</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Esta funcionalidade será implementada em breve.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Preços</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configure os valores de comissão e recebimento por operação</p>
        </div>
      </div>

      {renderPrecosContent()}
    </div>
  );
};

const Operacoes = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [selectedOperacao, setSelectedOperacao] = useState<string>('all');
  const [isOperacaoDropdownOpen, setIsOperacaoDropdownOpen] = useState(false);

  const tabs = [
    { path: '/operacoes', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/operacoes/viagens', label: 'Viagens', icon: Map },
    { path: '/operacoes/financeiro', label: 'Financeiro', icon: Wallet },
    { path: '/operacoes/precos', label: 'Preços', icon: Settings },
  ];

  const isActiveTab = (path: string) => {
    if (path === '/operacoes') {
      return currentPath === '/operacoes' || currentPath === '/operacoes/';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Operações</h1>
        
        <div className="relative">
          <button
            onClick={() => setIsOperacaoDropdownOpen(!isOperacaoDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 min-w-[180px] justify-between"
            data-testid="button-filter-operacao-global"
          >
            <Filter className="w-4 h-4" />
            <span className="truncate">
              {selectedOperacao === 'all' ? 'Todas Operações' : selectedOperacao}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOperacaoDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOperacaoDropdownOpen && (
            <div className="absolute right-0 z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
              {OPERACOES_TABELAS.map((op) => {
                const getOperacaoColor = (nome: string) => {
                  switch (nome) {
                    case 'Autoservice': return 'bg-blue-500 dark:bg-blue-400';
                    case 'Cesari': return 'bg-green-500 dark:bg-green-400';
                    case 'Mitsubishi': return 'bg-red-500 dark:bg-red-400';
                    case 'Sada': return 'bg-yellow-500 dark:bg-yellow-400';
                    case 'Superterminais': return 'bg-purple-500 dark:bg-purple-400';
                    case 'Tegma': return 'bg-orange-500 dark:bg-orange-400';
                    default: return 'bg-gray-500 dark:bg-gray-400';
                  }
                };
                return (
                  <button
                    key={op.nome}
                    onClick={() => {
                      setSelectedOperacao(op.nome);
                      setIsOperacaoDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                      selectedOperacao === op.nome ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${getOperacaoColor(op.nome)}`} />
                    {op.nome}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
        <Route path="/" element={<OperacoesDashboard selectedOperacao={selectedOperacao} />} />
        <Route path="/viagens" element={<OperacoesViagens selectedOperacao={selectedOperacao} setSelectedOperacao={setSelectedOperacao} />} />
        <Route path="/financeiro" element={<OperacoesFinanceiro selectedOperacao={selectedOperacao} />} />
        <Route path="/precos" element={<OperacoesPrecos selectedOperacao={selectedOperacao} />} />
      </Routes>
    </div>
  );
};

export default Operacoes;
