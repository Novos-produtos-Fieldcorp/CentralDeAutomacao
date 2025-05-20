import React, { useEffect, useRef, useState } from 'react';
import { Edit2, Trash2, Eye, FileText, Upload, Truck, Camera } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  actions: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
  }[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, actions }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    // Adjust position if menu would go off screen
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + menuRect.width > windowWidth) {
        adjustedX = windowWidth - menuRect.width - 10;
      }

      if (y + menuRect.height > windowHeight) {
        adjustedY = windowHeight - menuRect.height - 10;
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }

    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [x, y, onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]"
      style={{ left: position.x, top: position.y }}
    >
      {actions.map((action, index) => (
        <div
          key={index}
          className={`px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 ${
            action.disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={() => {
            if (!action.disabled) {
              action.onClick();
              onClose();
            }
          }}
        >
          <span className={action.color || 'text-gray-600 dark:text-gray-400'}>
            {action.icon}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300">{action.label}</span>
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;