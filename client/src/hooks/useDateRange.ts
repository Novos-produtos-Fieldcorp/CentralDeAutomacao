import { useState, useCallback } from 'react';

type PeriodType = '30days' | '15days' | '1day' | 'custom' | 'all';

interface DateRange {
  startDate: string;
  endDate: string;
}

export const useDateRange = (initialPeriod: PeriodType = '30days', debounceCustomUpdate: boolean = false) => {
  const [periodType, setPeriodType] = useState<PeriodType>(initialPeriod);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | null>(null);
  
  const calculateDateRange = useCallback((type: PeriodType): DateRange => {
    const end = new Date();
    const start = new Date();
    
    // For 'all' type, set dates to a very wide range to include all records
    if (type === 'all') {
      start.setFullYear(start.getFullYear() - 20); // 20 years ago
      return {
        startDate: start.toLocaleDateString('en-CA'),
        endDate: end.toLocaleDateString('en-CA'),
      };
    }

    switch (type) {
      case '30days':
        // Set start date to 29 days before today (today + 29 previous days = 30 days total)
        start.setDate(end.getDate() - 29);
        break;
      case '15days':
        // Set start date to 14 days before today (today + 14 previous days = 15 days total)
        start.setDate(end.getDate() - 14);
        break;
      case '1day':
        // For 1 day, set both start and end to today
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom': {
        // Default to first day of current month → today
        const firstOfMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        return {
          startDate: firstOfMonth.toLocaleDateString('en-CA'),
          endDate: end.toLocaleDateString('en-CA'),
        };
      }
    }

    return {
      startDate: start.toLocaleDateString('en-CA'),
      endDate: end.toLocaleDateString('en-CA'),
    };
  }, []);

  const [dateRange, setDateRange] = useState<DateRange>(() => calculateDateRange(initialPeriod));

  const updatePeriod = useCallback((type: PeriodType) => {
    setPeriodType(type);
    const newRange = calculateDateRange(type);
    setDateRange(newRange);
    setPendingDateRange(null);
  }, [calculateDateRange]);

  const updateDateRange = useCallback((newRange: DateRange) => {
    if (debounceCustomUpdate && periodType === 'custom') {
      // Store the pending date range but don't update the actual range yet
      setPendingDateRange(newRange);
    } else {
      // Update the date range immediately
      setDateRange(newRange);
    }
  }, [debounceCustomUpdate, periodType]);

  const applyPendingDateRange = useCallback(() => {
    if (pendingDateRange) {
      setDateRange(pendingDateRange);
      setPendingDateRange(null);
      return true;
    }
    return false;
  }, [pendingDateRange]);

  return {
    periodType,
    dateRange,
    pendingDateRange,
    updatePeriod,
    setDateRange: updateDateRange,
    applyPendingDateRange
  };
};