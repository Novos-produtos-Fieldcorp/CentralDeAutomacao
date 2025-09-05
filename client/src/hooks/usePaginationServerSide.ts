import { useState, useCallback } from 'react';

interface UsePaginationServerSideProps {
  initialPageSize?: number;
  fetchFunction: (page: number, limit: number, reset?: boolean) => Promise<void>;
}

export function usePaginationServerSide({ 
  initialPageSize = 50, 
  fetchFunction 
}: UsePaginationServerSideProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      await fetchFunction(1, pageSize, true);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, pageSize]);

  const loadNextPage = useCallback(async () => {
    if (loadingMore || loading) return;
    
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      await fetchFunction(nextPage, pageSize, false);
      setCurrentPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchFunction, pageSize, currentPage, loadingMore, loading]);

  const changePageSize = useCallback(async (newSize: number) => {
    if (newSize === pageSize) return;
    
    setPageSize(newSize);
    setCurrentPage(1);
    setLoading(true);
    try {
      await fetchFunction(1, newSize, true);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, pageSize]);

  const refresh = useCallback(async () => {
    setCurrentPage(1);
    setLoading(true);
    try {
      await fetchFunction(1, pageSize, true);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, pageSize]);

  return {
    currentPage,
    pageSize,
    loading,
    loadingMore,
    loadInitialData,
    loadNextPage,
    changePageSize,
    refresh
  };
}