import { useState, useCallback } from 'react';
import { getPaginationParams, formatPaginationResponse } from '../utils/pagination';
import { useCompanyData } from './useCompanyData';

interface UsePaginatedQueryOptions {
  initialPageSize?: number;
  initialFilters?: Record<string, any>;
}

interface PaginatedResponse<T> {
  records: T[];
  totalCount: number;
  currentPage: number;
  hasMore: boolean;
}

export function usePaginatedQuery<T>(
  tableName: string,
  options: UsePaginatedQueryOptions = {}
) {
  const { query } = useCompanyData();
  const { initialPageSize = 20, initialFilters = {} } = options;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPage = useCallback(async (
    page: number,
    pageSize: number = initialPageSize,
    filters: Record<string, any> = initialFilters,
    sortBy?: { column: string; order: 'asc' | 'desc' }
  ): Promise<PaginatedResponse<T>> => {
    setLoading(true);
    setError(null);
    
    try {
      const { limit, offset } = getPaginationParams(page, pageSize);
      
      // Start building the query
      let queryBuilder = query(tableName)
        .select('*', { count: 'exact' });
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value === 'string' && value.includes('%')) {
            queryBuilder = queryBuilder.ilike(key, value);
          } else {
            queryBuilder = queryBuilder.eq(key, value);
          }
        }
      });
      
      // Apply sorting
      if (sortBy) {
        queryBuilder = queryBuilder.order(sortBy.column, { ascending: sortBy.order === 'asc' });
      }
      
      // Apply pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);
      
      // Execute the query
      const { data, error, count } = await queryBuilder;
      
      if (error) throw error;
      
      return formatPaginationResponse(
        data as T[],
        page,
        pageSize,
        count || 0
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      const error = new Error(errorMessage);
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [query, tableName, initialFilters]);

  return {
    fetchPage,
    loading,
    error
  };
}