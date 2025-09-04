import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Users, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TagLimitNotificationProps {
  companyId: number;
}

interface TagLimitInfo {
  id: number;
  nome: string;
  cor: string;
  limite_max: number;
  current_count: number;
  is_at_limit: boolean;
}

export function TagLimitNotification({ companyId }: TagLimitNotificationProps) {
  const [notifications, setNotifications] = useState<TagLimitInfo[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkTagLimits();
    
    const interval = setInterval(checkTagLimits, 30000);
    
    return () => clearInterval(interval);
  }, [companyId]);

  const checkTagLimits = async () => {
    if (!companyId) return;
    
    try {
      setIsLoading(true);
      
      const { data: tags, error: tagsError } = await supabase
        .from('tag')
        .select('id, nome, cor, limite_max')
        .eq('company_id', companyId)
        .not('limite_max', 'is', null);

      if (tagsError) throw tagsError;

      if (!tags || tags.length === 0) {
        setNotifications([]);
        setIsVisible(false);
        return;
      }

      const tagLimits = await Promise.all(
        tags.map(async (tag: any) => {
          const { count, error: countError } = await supabase
            .from('associacao_tags')
            .select('*', { count: 'exact', head: true })
            .eq('tag_id', tag.id);

          if (countError) throw countError;

          const currentCount = count || 0;
          const isAtLimit = currentCount >= tag.limite_max;

          return {
            id: tag.id,
            nome: tag.nome,
            cor: tag.cor,
            limite_max: tag.limite_max,
            current_count: currentCount,
            is_at_limit: isAtLimit
          };
        })
      );

      // Filtrar apenas tags que estão no limite
      const atLimitTags = tagLimits.filter((tag: any) => tag.is_at_limit);
      
      setNotifications(atLimitTags);
      setIsVisible(atLimitTags.length > 0);
    } catch (error) {
      console.error('Erro ao verificar limites de tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dismissNotification = (tagId: number) => {
    setNotifications(prev => prev.filter(notif => notif.id !== tagId));
    if (notifications.length === 1) {
      setIsVisible(false);
    }
  };

  const dismissAll = () => {
    setNotifications([]);
    setIsVisible(false);
  };

  if (!isVisible || isLoading) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Limite de Associados Atingido
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              <p className="mb-2">
                As seguintes tags atingiram o limite máximo de associados:
              </p>
              <ul className="space-y-1">
                {notifications.map((notification) => (
                  <li key={notification.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: notification.cor }}
                      />
                      <span className="font-medium">{notification.nome}</span>
                      <span className="text-xs">
                        ({notification.current_count}/{notification.limite_max})
                      </span>
                    </div>
                    <button
                      onClick={() => dismissNotification(notification.id)}
                      className="ml-2 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={dismissAll}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 font-medium"
              >
                Dispensar todas
              </button>
              <button
                onClick={checkTagLimits}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 font-medium"
              >
                Verificar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
