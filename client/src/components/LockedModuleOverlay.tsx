import { Lock } from 'lucide-react';

interface ModuleInfo {
  title: string;
  description: string;
  whatsappMessage: string;
}

const moduleConfig: Record<string, ModuleInfo> = {
  hodometro: {
    title: 'Hodômetro Automatizado',
    description: 'Controle quilometragem, consumo e custos operacionais automaticamente',
    whatsappMessage: 'Olá! Gostaria de contratar o módulo de Hodômetro Automatizado'
  },
  checklist: {
    title: 'Checklist Automatizado',
    description: 'Automatize suas inspeções e verificações de veículos com checklists digitais',
    whatsappMessage: 'Olá! Gostaria de contratar o módulo de Checklist'
  },
  vagas: {
    title: 'Sistema de Vagas',
    description: 'Gerencie processos de contratação e vagas abertas de forma eficiente',
    whatsappMessage: 'Olá! Gostaria de contratar o módulo de Vagas e Contratação'
  },
  motoristas: {
    title: 'Gestão de Motoristas',
    description: 'Controle completo de documentos, histórico e performance dos motoristas',
    whatsappMessage: 'Olá! Gostaria de contratar o módulo de Motoristas'
  },
  resumo: {
    title: 'Resumo WhatsApp',
    description: 'Envie resumos automáticos via WhatsApp para seus grupos e contatos',
    whatsappMessage: 'Olá! Gostaria de contratar o módulo de Resumo em Grupo'
  },
  comprovantes: {
    title: 'Comprovantes Digitais',
    description: 'Gerencie e organize todos os comprovantes de forma digital e segura',
    whatsappMessage: 'Olá! Gostaria de contratar o módulo de Comprovantes'
  },
  tags: {
    title: 'Tags e Marcadores',
    description: 'Organize e categorize seus contatos com tags personalizadas',
    whatsappMessage: 'Olá! Gostaria de contratar o módulo de Tags'
  }
};

interface LockedModuleOverlayProps {
  module: keyof typeof moduleConfig;
  contactNumber?: string; // Número de WhatsApp, padrão: 5511999999999
}

const LockedModuleOverlay = ({ module, contactNumber = '5511999999999' }: LockedModuleOverlayProps) => {
  const config = moduleConfig[module] || {
    title: '🔒 Funcionalidade Bloqueada',
    description: 'Esta funcionalidade não está disponível no seu plano atual',
    whatsappMessage: 'Olá! Gostaria de saber mais sobre os módulos disponíveis'
  };

  const whatsappUrl = `https://wa.me/${contactNumber}?text=${encodeURIComponent(config.whatsappMessage)}`;

  return (
    <div 
      className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 p-6 text-center" 
      data-testid={`lock-${module}`}
    >
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shadow-lg mb-4">
        <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
        {config.title}
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-xs">
        {config.description}
      </p>
      
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        data-testid={`button-contact-${module}`}
      >
        Falar com Atendente
      </a>
    </div>
  );
};

export default LockedModuleOverlay;
