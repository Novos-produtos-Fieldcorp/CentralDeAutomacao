import { useState } from 'react';
import { Users, FolderKanban, Zap, CalendarClock } from 'lucide-react';
import ContatosTab from './ContatosTab';
import GruposTab from './GruposTab';
import AutomacoesTab from './AutomacoesTab';
import AgendamentosTab from './AgendamentosTab';

type TabId = 'contatos' | 'grupos' | 'automacoes' | 'agendamentos';

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'contatos', label: 'Contatos', icon: Users },
  { id: 'grupos', label: 'Grupos', icon: FolderKanban },
  { id: 'automacoes', label: 'Automações', icon: Zap },
  { id: 'agendamentos', label: 'Agendamentos', icon: CalendarClock },
];

const PainelTabs = () => {
  const [active, setActive] = useState<TabId>('contatos');

  return (
    <div className="space-y-6">
      {/* Navegação de abas */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      <div>
        {active === 'contatos' && <ContatosTab />}
        {active === 'grupos' && <GruposTab />}
        {active === 'automacoes' && <AutomacoesTab />}
        {active === 'agendamentos' && <AgendamentosTab />}
      </div>
    </div>
  );
};

export default PainelTabs;
