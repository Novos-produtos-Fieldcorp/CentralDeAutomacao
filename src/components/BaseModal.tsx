import React from 'react';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  maxHeight?: string;
  className?: string;
}

export function BaseModal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'lg',
  maxHeight = '90vh',
  className = ''
}: BaseModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    '2xl': 'sm:max-w-6xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm transition-opacity" aria-hidden="true" />
        
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
          &#8203;
        </span>

        <div 
          className={`
            inline-block w-full transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 
            px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all 
            sm:my-8 sm:p-6 sm:align-middle
            ${sizeClasses[size]}
            ${className}
          `}
          style={{ maxHeight }}
        >
          <div className="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <span className="sr-only">Fechar</span>
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="w-full">
              <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white mb-6">
                {title}
              </h3>
              <div className="mt-2 overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 100px)` }}>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
