import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  isExpanded?: boolean;
}

const ThemeToggle = ({ isExpanded }: ThemeToggleProps) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="group flex items-center justify-center w-full h-12 px-3 rounded-xl text-sm font-medium
                transition-all duration-500 ease
                text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50
                hover:text-blue-600 dark:hover:text-blue-400"
      aria-label="Toggle theme"
    >
      <div className="flex items-center justify-center min-w-[40px] h-10 rounded-lg transition-all duration-500">
        {isDark ? (
          <Sun className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 
                         dark:group-hover:text-blue-400 transition-all duration-500 
                         group-hover:rotate-90 group-hover:scale-110" />
        ) : (
          <Moon className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 
                         dark:group-hover:text-blue-400 transition-all duration-500
                         group-hover:-rotate-90 group-hover:scale-110" />
        )}
      </div>
      {isExpanded && (
        <span className="ml-3 flex-1 whitespace-nowrap transition-all duration-500">
          {isDark ? 'Modo Claro' : 'Modo Escuro'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;