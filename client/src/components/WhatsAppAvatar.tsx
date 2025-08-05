import React from 'react';
import { User } from 'lucide-react';

interface WhatsAppAvatarProps {
  photoUrl?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function WhatsAppAvatar({ 
  photoUrl, 
  name, 
  size = 'md', 
  className = '' 
}: WhatsAppAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  // Debug: log the photoUrl to see what we're receiving
  console.log('WhatsAppAvatar - photoUrl:', photoUrl, 'name:', name);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name || 'Foto do contato'}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 ${className}`}
        onError={(e) => {
          // Se a imagem falhar ao carregar, mostra o ícone padrão
          const target = e.target as HTMLElement;
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `
              <div class="${sizeClasses[size]} rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center ${className}">
                <svg width="${iconSizes[size]}" height="${iconSizes[size]}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 dark:text-gray-500">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
            `;
          }
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center ${className}`}>
      <User 
        size={iconSizes[size]} 
        className="text-gray-400 dark:text-gray-500" 
      />
    </div>
  );
}