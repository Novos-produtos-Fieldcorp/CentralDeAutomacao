import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  visibleItems?: number;
  clientFiltersActive?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  visibleItems,
  clientFiltersActive = false,
  onPageChange,
  onPageSizeChange
}) => {
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      const leftBoundary = Math.max(2, currentPage - 1);
      const rightBoundary = Math.min(totalPages - 1, currentPage + 1);
      
      if (leftBoundary > 2) {
        pages.push('...');
      }
      
      for (let i = leftBoundary; i <= rightBoundary; i++) {
        pages.push(i);
      }
      
      if (rightBoundary < totalPages - 1) {
        pages.push('...');
      }
      
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const firstItem = totalItems === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const actualVisible = visibleItems ?? Math.min(currentPage * pageSize, totalItems);
  const lastItem = Math.min((currentPage - 1) * pageSize + actualVisible, totalItems);

  const buttonBase = "px-2 py-1 text-sm font-medium rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const navButton = `${buttonBase} text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700`;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-0 flex-wrap gap-2">
        <span>
          Mostrando <span className="font-medium">{firstItem}</span> a{' '}
          <span className="font-medium">{lastItem}</span> de{' '}
          <span className="font-medium">{totalItems}</span> resultados
        </span>

        {clientFiltersActive && (
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
            Filtros adicionais ativos
          </span>
        )}
        
        <div>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value={5}>5 por página</option>
            <option value={10}>10 por página</option>
            <option value={20}>20 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>
      
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={navButton}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {clientFiltersActive ? (
          <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300">
            Página {currentPage} de ~{totalPages}
          </span>
        ) : (
          pageNumbers.map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === 'number' ? onPageChange(page) : null}
              disabled={page === '...'}
              className={`px-3 py-1 text-sm font-medium rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                page === currentPage
                  ? 'bg-blue-600 text-white border border-blue-600 dark:bg-blue-700 dark:border-blue-700'
                  : page === '...'
                  ? 'text-gray-700 bg-white border border-gray-300 cursor-default dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {page}
            </button>
          ))
        )}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className={navButton}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
