import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Tag } from 'lucide-react';
import { useTags } from '../hooks/useTags';

interface TagsFilterProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export const TagsFilter: React.FC<TagsFilterProps> = ({
  selectedTags,
  onTagsChange,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: tags = [], isLoading } = useTags();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  const getSelectedTagsText = () => {
    if (selectedTags.length === 0) return "Filtrar por tags";
    if (selectedTags.length === 1) {
      const tag = tags.find(t => t.id.toString() === selectedTags[0]);
      return tag ? tag.nome : "1 tag selecionada";
    }
    return `${selectedTags.length} tags selecionadas`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none text-left flex items-center justify-between"
        type="button"
      >
        <span className="truncate">{getSelectedTagsText()}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-3 text-center text-gray-500 dark:text-gray-400">
              Carregando tags...
            </div>
          ) : tags.length === 0 ? (
            <div className="p-3 text-center text-gray-500 dark:text-gray-400">
              Nenhuma tag disponível
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag.id.toString())}
                    onChange={() => toggleTag(tag.id.toString())}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: tag.cor }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{tag.nome}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};