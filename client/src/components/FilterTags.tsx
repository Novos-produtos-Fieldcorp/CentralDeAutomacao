import React from 'react';
import { X, Calendar, MapPin, User, Tag as TagIcon, Truck, CheckCircle, AlertTriangle, Package } from 'lucide-react';

export interface FilterTagsProps {
  statusFilter?: string[];
  ativoFilter?: string;
  clienteFilter?: string[];
  cidadeFilter?: string[];
  funcaoFilter?: string[];
  tagFilter?: string[];
  tipoVeiculoFilter?: string[];
  bauFilter?: string[];
  areaAtuacaoFilter?: string[];
  dateFilter?: string;
  customDateRange?: {
    startDate: string | null;
    endDate: string | null;
  };
  onRemoveStatus?: (status: string) => void;
  onRemoveAtivo?: () => void;
  onRemoveCliente?: (cliente: string) => void;
  onRemoveCidade?: (cidade: string) => void;
  onRemoveFuncao?: (funcao: string) => void;
  onRemoveTag?: (tag: string) => void;
  onRemoveTipoVeiculo?: (tipo: string) => void;
  onRemoveBau?: (bau: string) => void;
  onRemoveAreaAtuacao?: (area: string) => void;
  onRemoveDate?: () => void;
  onClearAll?: () => void;
  
  // Data para labels personalizados
  clientes?: Array<{ cliente_id: number; nome_cliente?: string; nome?: string }>;
  tags?: Array<{ id: number; nome: string; cor?: string }>;
  cidades?: string[];
  tiposVeiculo?: string[];
  areasAtuacao?: string[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'Cadastrado': { label: 'Cadastrado', color: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' },
  'qualificado': { label: 'Qualificado', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  'documentacao': { label: 'Documentação', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' },
  'contrato_enviado': { label: 'Contrato Enviado', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' },
  'contratado': { label: 'Contratado', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
  'repescagem': { label: 'Repescagem', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' },
  'gestao_risco': { label: 'Gestão de Risco', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300' },
  'rejeitado': { label: 'Rejeitado', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' }
};

const DATE_LABELS: Record<string, string> = {
  'today': 'Hoje',
  '2days': 'Últimos 2 dias',
  '15days': 'Últimos 15 dias', 
  '30days': 'Últimos 30 dias',
  'custom': 'Período personalizado'
};

const FilterTags: React.FC<FilterTagsProps> = ({
  statusFilter = [],
  ativoFilter = '',
  clienteFilter = [],
  cidadeFilter = [],
  funcaoFilter = [],
  tagFilter = [],
  tipoVeiculoFilter = [],
  bauFilter = [],
  areaAtuacaoFilter = [],
  dateFilter = 'all',
  customDateRange,
  onRemoveStatus,
  onRemoveAtivo,
  onRemoveCliente,
  onRemoveCidade,
  onRemoveFuncao,
  onRemoveTag,
  onRemoveTipoVeiculo,
  onRemoveBau,
  onRemoveAreaAtuacao,
  onRemoveDate,
  onClearAll,
  clientes = [],
  tags = [],
  cidades = [],
  tiposVeiculo = [],
  areasAtuacao = []
}) => {
  const hasFilters = 
    statusFilter.length > 0 ||
    ativoFilter !== '' ||
    clienteFilter.length > 0 ||
    cidadeFilter.length > 0 ||
    funcaoFilter.length > 0 ||
    tagFilter.length > 0 ||
    tipoVeiculoFilter.length > 0 ||
    bauFilter.length > 0 ||
    areaAtuacaoFilter.length > 0 ||
    (dateFilter !== 'all' && dateFilter !== '');

  if (!hasFilters) {
    return null;
  }

  const getClienteName = (clienteId: string | number) => {
    const cliente = clientes.find(c => c.cliente_id.toString() === clienteId.toString());
    return cliente?.nome_cliente || cliente?.nome || `Cliente ${clienteId}`;
  };

  const getTagInfo = (tagId: string | number) => {
    const tag = tags.find(t => t.id.toString() === tagId.toString());
    return tag ? { nome: tag.nome, cor: tag.cor } : { nome: `Tag ${tagId}`, cor: undefined };
  };

  const formatDateRange = () => {
    if (dateFilter === 'custom' && customDateRange?.startDate && customDateRange?.endDate) {
      const start = new Date(customDateRange.startDate).toLocaleDateString('pt-BR');
      const end = new Date(customDateRange.endDate).toLocaleDateString('pt-BR');
      return `${start} - ${end}`;
    }
    return DATE_LABELS[dateFilter] || dateFilter;
  };

  const activeFiltersCount =
    statusFilter.length +
    (ativoFilter ? 1 : 0) +
    clienteFilter.length +
    cidadeFilter.length +
    funcaoFilter.length +
    tagFilter.length +
    tipoVeiculoFilter.length +
    bauFilter.length +
    areaAtuacaoFilter.length +
    (dateFilter !== 'all' && dateFilter !== '' ? 1 : 0);

  const isActiveFilter = ativoFilter === 'ativo' || ativoFilter === 'true';

  return (
    <div className="filter-tags-panel" data-testid="filter-tags-container">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Filtros ativos
          </span>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {activeFiltersCount}
          </span>
        </div>

        {hasFilters && onClearAll && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
            data-testid="clear-all-filters"
          >
            <X className="h-3 w-3" />
            <span>Limpar todos</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">

        {/* Status Filters */}
        {statusFilter.map((status) => {
          const statusInfo = STATUS_LABELS[status];
          return (
            <div
              key={`status-${status}`}
              className={`filter-tags-chip ${statusInfo?.color || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}
              data-testid={`filter-tag-status-${status}`}
            >
              <CheckCircle className="h-3 w-3" />
              <span className="filter-tags-chip-label">Status: {statusInfo?.label || status}</span>
              {onRemoveStatus && (
                <button
                  onClick={() => onRemoveStatus(status)}
                  className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                  data-testid={`remove-status-${status}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Ativo Filter */}
        {ativoFilter && (
          <div
            className={`filter-tags-chip ${
              isActiveFilter
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
            }`}
            data-testid={`filter-tag-ativo-${ativoFilter}`}
          >
            {isActiveFilter ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            <span className="filter-tags-chip-label">{isActiveFilter ? 'Ativo' : 'Desativo'}</span>
            {onRemoveAtivo && (
              <button
                onClick={onRemoveAtivo}
                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                data-testid="remove-ativo"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Cliente Filters */}
        {clienteFilter.map((clienteId) => (
          <div
            key={`cliente-${clienteId}`}
            className="filter-tags-chip bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300"
            data-testid={`filter-tag-cliente-${clienteId}`}
          >
            <User className="h-3 w-3" />
            <span className="filter-tags-chip-label">Cliente: {getClienteName(clienteId)}</span>
            {onRemoveCliente && (
              <button
                onClick={() => onRemoveCliente(clienteId)}
                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                data-testid={`remove-cliente-${clienteId}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Área de Atuação Filters */}
        {areaAtuacaoFilter.map((area) => (
          <div
            key={`area-${area}`}
            className="filter-tags-chip bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
            data-testid={`filter-tag-area-atuacao-${area}`}
          >
            <MapPin className="h-3 w-3" />
            <span className="filter-tags-chip-label">Região: {area}</span>
            {onRemoveAreaAtuacao && (
              <button
                onClick={() => onRemoveAreaAtuacao(area)}
                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                data-testid={`remove-area-atuacao-${area}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Cidade Filters */}
        {cidadeFilter.map((cidade) => (
          <div
            key={`cidade-${cidade}`}
            className="filter-tags-chip bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300"
            data-testid={`filter-tag-cidade-${cidade}`}
          >
            <MapPin className="h-3 w-3" />
            <span className="filter-tags-chip-label">Cidade: {cidade}</span>
            {onRemoveCidade && (
              <button
                onClick={() => onRemoveCidade(cidade)}
                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                data-testid={`remove-cidade-${cidade}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Função Filters */}
        {funcaoFilter.map((funcao) => (
          <div
            key={`funcao-${funcao}`}
            className="filter-tags-chip bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300"
            data-testid={`filter-tag-funcao-${funcao}`}
          >
            <User className="h-3 w-3" />
            <span className="filter-tags-chip-label">
              Função: {funcao === 'sem_funcao' ? 'Sem função' : funcao}
            </span>
            {onRemoveFuncao && (
              <button
                onClick={() => onRemoveFuncao(funcao)}
                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                data-testid={`remove-funcao-${funcao}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Tag Filters */}
        {tagFilter.map((tagId) => {
          const tagInfo = getTagInfo(tagId);
          return (
            <div
              key={`tag-${tagId}`}
              className={`filter-tags-chip ${
                tagInfo.cor 
                  ? `text-white` 
                  : 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300'
              }`}
              style={tagInfo.cor ? { backgroundColor: tagInfo.cor } : undefined}
              data-testid={`filter-tag-tag-${tagId}`}
            >
              <TagIcon className="h-3 w-3" />
              <span className="filter-tags-chip-label">Tag: {tagInfo.nome}</span>
              {onRemoveTag && (
                <button
                  onClick={() => onRemoveTag(tagId.toString())}
                  className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                  data-testid={`remove-tag-${tagId}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Tipo Veículo Filters */}
        {tipoVeiculoFilter.map((tipo) => (
          <div
            key={`tipo-${tipo}`}
            className="filter-tags-chip bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
            data-testid={`filter-tag-tipo-veiculo-${tipo}`}
          >
            <Truck className="h-3 w-3" />
            <span className="filter-tags-chip-label">Tipo: {tipo}</span>
            {onRemoveTipoVeiculo && (
              <button
                onClick={() => onRemoveTipoVeiculo(tipo)}
                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                data-testid={`remove-tipo-veiculo-${tipo}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Baú Filters */}
        {bauFilter.map((bau) => (
          <div
            key={`bau-${bau}`}
            className="filter-tags-chip bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
            data-testid={`filter-tag-bau-${bau}`}
          >
            <Package className="h-3 w-3" />
            <span className="filter-tags-chip-label">Baú: {bau === 'sem_bau' ? 'Sem baú' : bau}</span>
            {onRemoveBau && (
              <button
                onClick={() => onRemoveBau(bau)}
                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                data-testid={`remove-bau-${bau}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Date Filter */}
        {dateFilter !== 'all' && dateFilter !== '' && (
          <div
            className="filter-tags-chip bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300"
            data-testid={`filter-tag-date-${dateFilter}`}
          >
            <Calendar className="h-3 w-3" />
            <span className="filter-tags-chip-label">Data: {formatDateRange()}</span>
            {onRemoveDate && (
              <button
                onClick={onRemoveDate}
                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-sm p-0.5 transition-colors"
                data-testid="remove-date"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default FilterTags;