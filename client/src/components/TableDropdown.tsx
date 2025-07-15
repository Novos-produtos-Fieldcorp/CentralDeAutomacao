import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface DropdownOption {
  value: string | number;
  label: string;
  color?: string;
  disabled?: boolean;
}

interface TableDropdownProps {
  value?: string | number | null;
  options: DropdownOption[];
  onSelect: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  maxHeight?: string;
}

export const TableDropdown: React.FC<TableDropdownProps> = ({
  value,
  options,
  onSelect,
  placeholder = "Selecionar...",
  className = "",
  buttonClassName = "",
  dropdownClassName = "",
  disabled = false,
  maxHeight = "200px"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      
      // Use viewport coordinates directly since we're using fixed positioning
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  const handleSelect = (optionValue: string | number) => {
    onSelect(optionValue);
    setIsOpen(false);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  };

  const handleScroll = () => {
    if (isOpen) {
      updatePosition();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isOpen]);

  const renderDropdown = () => {
    if (!isOpen) return null;

    return createPortal(
      <div
        ref={dropdownRef}
        className={`fixed bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${dropdownClassName}`}
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          maxHeight,
          overflowY: 'auto',
          zIndex: 9999
        }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            disabled={option.disabled}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${
              value === option.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
            }`}
            style={option.color ? { backgroundColor: option.color } : undefined}
          >
            {option.label}
          </button>
        ))}
      </div>,
      document.body
    );
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={disabled}
        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-full text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          isOpen ? 'ring-2 ring-blue-500 ring-offset-1 shadow-lg' : ''
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${buttonClassName}`}
        style={selectedOption?.color ? { backgroundColor: selectedOption.color } : undefined}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={14} 
          className={`flex-shrink-0 ml-1.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      
      {renderDropdown()}
    </div>
  );
};