import React from 'react';
import { MinusCircle } from 'lucide-react';
import { STATUS_MAPPING } from '../../utils/checklistStatus';

type StatusKey = keyof typeof STATUS_MAPPING;

interface ChecklistSectionProps {
  title: string;
  items: Record<string, any>;
  excludeKeys: string[];
  statusItems: { status_id: number; status: string }[];
  filterKeys?: string[];
  gridCols?: number;
  specialTextKey?: string;
  specialTextLabel?: string;
}

export const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  title,
  items,
  excludeKeys,
  statusItems,
  filterKeys,
  gridCols = 1,
  specialTextKey,
  specialTextLabel
}) => {
  const getStatusInfo = (status_id: number) => {
    const statusItem = statusItems.find(item => item.status_id === status_id);
    if (!statusItem) return { icon: MinusCircle, colorClass: 'text-gray-400', label: 'N/A' };

    const mappingKey = statusItem.status as StatusKey;
    const mapping = STATUS_MAPPING[mappingKey];

    if (mapping) {
      return {
        icon: mapping.icon,
        colorClass: mapping.color,
        label: statusItem.status
      };
    }

    return {
      icon: MinusCircle,
      colorClass: 'text-gray-400',
      label: statusItem.status
    };
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className={`${gridCols > 1 ? 'grid grid-cols-1 md:grid-cols-2' : 'space-y-3'} gap-4`}>
        {Object.entries(items).map(([key, value]) => {
          if (excludeKeys.includes(key)) return null;
          
          // For filtered views, show only specific fields
          if (filterKeys && !filterKeys.includes(key)) {
            return null;
          }

          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          // Handle special text fields
          if (key === specialTextKey) {
            return (
              <div key={key} className={`${gridCols > 1 ? 'md:col-span-2' : ''}`}>
                <div className="p-3 bg-white dark:bg-gray-700/50 rounded-xl shadow-sm">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {specialTextLabel || label}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {value as string}
                  </div>
                </div>
              </div>
            );
          }

          // Handle status fields
          const status = getStatusInfo(value as number);
          const StatusIcon = status.icon;

          return (
            <div key={key} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700/50 rounded-xl shadow-sm">
              <div className={`p-1 rounded-full ${status.colorClass}`}>
                <StatusIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {label}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {status.label}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Render special text field at the end if it exists */}
        {specialTextKey && items[specialTextKey] && (
          <div className="md:col-span-2">
            <div className="p-3 bg-white dark:bg-gray-700/50 rounded-xl shadow-sm">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {specialTextLabel || specialTextKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {items[specialTextKey]}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};