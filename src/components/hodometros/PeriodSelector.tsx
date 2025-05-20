import React from 'react';
import { Calendar } from 'lucide-react';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface PeriodSelectorProps {
  periodType: '1month' | '15days' | '1day' | 'custom' | 'all';
  dateRange: DateRange;
  onPeriodChange: (type: '1month' | '15days' | '1day' | 'custom' | 'all') => void;
  onDateRangeChange: (range: DateRange) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  periodType,
  dateRange,
  onPeriodChange,
  onDateRangeChange
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onPeriodChange('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            periodType === 'all'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => onPeriodChange('1month')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            periodType === '1month'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          1 mês
        </button>
        <button
          onClick={() => onPeriodChange('15days')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            periodType === '15days'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          15 dias
        </button>
        <button
          onClick={() => onPeriodChange('1day')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            periodType === '1day'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          1 dia
        </button>
        <button
          onClick={() => onPeriodChange('custom')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            periodType === 'custom'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Personalizado
        </button>
      </div>

      {periodType === 'custom' && (
        <div className="flex items-center gap-2">
          <Calendar className="text-gray-400" size={18} />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => onDateRangeChange({ ...dateRange, startDate: e.target.value })}
              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <span className="text-gray-500">até</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => onDateRangeChange({ ...dateRange, endDate: e.target.value })}
              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodSelector;