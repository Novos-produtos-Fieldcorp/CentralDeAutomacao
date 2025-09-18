import React, { ReactNode } from 'react';

interface AccessTooltipProps {
  children: ReactNode;
  module: string;
  className?: string;
}

const getTooltipMessage = (module: string): { title: string; description: string; contact: string } => {
  const messages = {
    'hodometro': {
      title: 'Funcionalidade Bloqueada',
      description: 'Para liberar o Hodômetro, é necessário contratar a automação do Hodômetro.',
      contact: 'Entre em contato com nossos atendentes para ativar essa funcionalidade.'
    },
    'checklist': {
      title: 'Funcionalidade Bloqueada', 
      description: 'Para liberar o Checklist, é necessário contratar o módulo de Checklist.',
      contact: 'Entre em contato com nossos atendentes para ativar essa funcionalidade.'
    },
    'vagas': {
      title: 'Funcionalidade Bloqueada',
      description: 'Para liberar as Vagas, é necessário contratar o módulo de Contratação/Vagas.',
      contact: 'Entre em contato com nossos atendentes para ativar essa funcionalidade.'
    },
    'motoristas': {
      title: 'Funcionalidade Bloqueada',
      description: 'Para liberar o módulo de Motoristas, é necessário contratar essa funcionalidade.',
      contact: 'Entre em contato com nossos atendentes para ativar essa funcionalidade.'
    },
    'resumo': {
      title: 'Funcionalidade Bloqueada',
      description: 'Para liberar o Resumo, é necessário contratar o módulo de Dashboard/Resumo.',
      contact: 'Entre em contato com nossos atendentes para ativar essa funcionalidade.'
    },
    'tags': {
      title: 'Funcionalidade Bloqueada',
      description: 'Para liberar as Tags, é necessário contratar o módulo de Tags.',
      contact: 'Entre em contato com nossos atendentes para ativar essa funcionalidade.'
    }
  };

  return messages[module as keyof typeof messages] || {
    title: 'Funcionalidade Bloqueada',
    description: 'Esta funcionalidade não está disponível em seu plano atual.',
    contact: 'Entre em contato com nossos atendentes para mais informações.'
  };
};

const AccessTooltip: React.FC<AccessTooltipProps> = ({ children, module, className = '' }) => {
  const { title, description, contact } = getTooltipMessage(module);

  return (
    <div className={`relative group ${className}`}>
      {children}
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        <div className="font-semibold mb-1">{title}</div>
        <div className="mb-2 leading-relaxed">{description}</div>
        <div className="text-blue-200 dark:text-blue-300">{contact}</div>
        
        {/* Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700"></div>
      </div>
    </div>
  );
};

export default AccessTooltip;