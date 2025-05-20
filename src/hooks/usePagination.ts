import { useState, useMemo } from 'react';

interface UsePaginationProps<T = any> {
  data?: T[];
  initialPageSize?: number;
  totalItems?: number;
}

export function usePagination<T = any>({ data = [], initialPageSize = 10, totalItems }: UsePaginationProps<T> = {}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Reset to first page when data changes
  useMemo(() => {
    setCurrentPage(1);
  }, [data?.length]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data?.slice(start, start + pageSize) || [];
  }, [data, currentPage, pageSize]);

  // Use provided totalItems if available, otherwise calculate from data length
  const actualTotalItems = totalItems !== undefined ? totalItems : (data?.length || 0);
  const totalPages = Math.max(1, Math.ceil(actualTotalItems / pageSize));

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems: actualTotalItems,
    paginatedData,
    handlePageChange,
    handlePageSizeChange
  };
}