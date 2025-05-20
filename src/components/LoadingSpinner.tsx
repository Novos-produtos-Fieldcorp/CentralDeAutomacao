import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 24, 
  className = '', 
  text = ''
}) => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full py-8">
      <Loader2 
        className={`animate-spin text-blue-500 dark:text-blue-400 ${className}`} 
        size={size} 
      />
      {text && (
        <p className="mt-4 text-gray-600 dark:text-gray-400">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;