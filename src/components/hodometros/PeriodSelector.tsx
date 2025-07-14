import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type PeriodType = '30days' | '15days' | '1day' | 'custom' | 'all';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface PeriodSelectorProps {
  periodType: PeriodType;
  dateRange: DateRange;
  pendingDateRange?: DateRange | null;
  onPeriodChange: (type: PeriodType) => void;
  onDateRangeChange: (range: DateRange) => void;
  onApplyCustomRange?: () => void;
}

const PeriodSelector = ({
  periodType,
  dateRange,
  pendingDateRange,
  onPeriodChange,
  onDateRangeChange,
  onApplyCustomRange
}: PeriodSelectorProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getPeriodLabel = () => {
    switch (periodType) {
      case '1day': return 'Hoje';
      case '15days': return 'Últimos 15 dias';
      case '30days': return 'Últimos 30 dias';
      case 'all': return 'Todos';
      case 'custom': return 'Personalizado';
      default: return 'Selecionar período';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-white dark:bg-[#0F1117] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <span>{getPeriodLabel()}</span>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#0F1117] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 space-y-1">
            <button
              onClick={() => {
                onPeriodChange('1day');
                setIsDropdownOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                periodType === '1day'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => {
                onPeriodChange('15days');
                setIsDropdownOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                periodType === '15days'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Últimos 15 dias
            </button>
            <button
              onClick={() => {
                onPeriodChange('30days');
                setIsDropdownOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                periodType === '30days'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Últimos 30 dias
            </button>
            <button
              onClick={() => {
                onPeriodChange('all');
                setIsDropdownOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                periodType === 'all'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                onPeriodChange('custom');
                setIsDropdownOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                periodType === 'custom'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Personalizado
            </button>
          </div>
        </div>
      )}

      {periodType === 'custom' && (
        <div className="mt-2 bg-gray-50 dark:bg-[#1F2937] p-2 rounded-lg">
          <div className="flex flex-col space-y-2">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 w-10">De:</label>
                <input
                  type="date"
                  value={pendingDateRange?.startDate || dateRange.startDate}
                  onChange={(e) => onDateRangeChange({ 
                    ...(pendingDateRange || dateRange), 
                    startDate: e.target.value 
                  })}
                  className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 w-10">Até:</label>
                <input
                  type="date"
                  value={pendingDateRange?.endDate || dateRange.endDate}
                  onChange={(e) => onDateRangeChange({ 
                    ...(pendingDateRange || dateRange), 
                    endDate: e.target.value 
                  })}
                  className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full"
                />
              </div>
              {pendingDateRange && onApplyCustomRange && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={onApplyCustomRange}
                    className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodSelector;