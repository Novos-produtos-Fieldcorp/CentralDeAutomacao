import React from 'react';
import { useMotoristasTags } from '../hooks/useTags';

interface TagsDisplayProps {
  motoristaId: number;
  className?: string;
}

export const TagsDisplay: React.FC<TagsDisplayProps> = ({ motoristaId, className = "" }) => {
  const { data: tags = [], isLoading } = useMotoristasTags(motoristaId);

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-600 h-4 w-16 rounded"></div>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className={`text-gray-400 dark:text-gray-500 text-sm ${className}`}>
        Sem tags
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white shadow-sm"
          style={{ backgroundColor: tag.cor }}
        >
          {tag.nome}
        </span>
      ))}
    </div>
  );
};