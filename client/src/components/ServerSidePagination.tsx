import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface ServerSidePaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  hasMoreData: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onPageSizeChange: (size: number) => void;
  loadedItems: number;
}

const ServerSidePagination: React.FC<ServerSidePaginationProps> = ({
  currentPage,
  totalCount,
  pageSize,
  hasMoreData,
  loadingMore,
  onLoadMore,
  onPageSizeChange,
  loadedItems
}) => {
  
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
        <span>
          Mostrando <span className="font-medium">{loadedItems}</span> de{' '}
          <span className="font-medium">{totalCount}</span> resultados
          {hasMoreData && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              (mais dados disponíveis)
            </span>
          )}
        </span>
        
        <div className="ml-4">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 
                      text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {hasMoreData && (
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                      transition-colors flex items-center gap-2 disabled:opacity-50 
                      disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                Carregar Mais
              </>
            )}
          </button>
        )}
        
        {!hasMoreData && loadedItems > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Todos os resultados carregados
          </span>
        )}
      </div>
    </div>
  );
};

export default ServerSidePagination;