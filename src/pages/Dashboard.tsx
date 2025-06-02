import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Users, Gauge, ClipboardCheck, Store, FileDown, Lock, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useModuleAccess } from '../hooks/useModuleAccess';
import ImportExportModal from '../components/ImportExportModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useWiseAppAccess } from '../hooks/useWiseAppAccess';
import WiseAppTokenModal from '../components/WiseAppTokenModal';
import { toast } from 'react-hot-toast';

interface MenuItem {
  title: string;
  icon: LucideIcon;
  link: string;
  description: string;
  enabled: boolean;
}

const MenuCard = ({
  title,
  icon: Icon,
  link,
  description,
  enabled = true
}: MenuItem) => {
  const cardContent = (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0
                    transition-opacity duration-300 ${enabled ? 'group-hover:opacity-100' : ''}`} />
      <div className="relative flex flex-col h-full">
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 bg-background-light rounded-[16px]
                        transform transition-all duration-300 ${enabled ? 'group-hover:bg-background-lighter group-hover:scale-110' : ''}`}>
            <Icon className={`w-8 h-8 ${enabled ? 'text-primary group-hover:text-primary-light' : 'text-gray-400 dark:text-gray-600'} transition-colors duration-300`} />
          </div>
          <div className="flex items-center gap-2">
            <h3 className={`text-xl font-bold ${enabled ? 'text-text-primary' : 'text-gray-400 dark:text-gray-600'}`}>{title}</h3>
            {!enabled && <Lock className="w-5 h-5 text-gray-400 dark:text-gray-600" />}
          </div>
        </div>
        <p className={`text-base relative z-10 transition-colors duration-300 ${
          enabled ? 'text-text-secondary group-hover:text-text-primary' : 'text-gray-400 dark:text-gray-600'
        }`}>
          {description}
        </p>
      </div>
    </>
  );

  return enabled ? (
    <Link
      to={link}
      className="group relative overflow-hidden bg-card hover:bg-card-hover p-8 rounded-[20px] 
                 border border-card-border shadow-card hover:shadow-card-hover
                 transform hover:-translate-y-1 transition-all duration-300
                 w-full h-[200px] flex flex-col justify-between"
      aria-label={`Acessar ${title}`}
    >
      {cardContent}
    </Link>
  ) : (
    <div
      className="group relative overflow-hidden bg-card p-8 rounded-[20px] 
                 border border-card-border shadow-card opacity-60
                 w-full h-[200px] flex flex-col justify-between
                 cursor-not-allowed select-none"
      aria-disabled="true"
    >
      {cardContent}
    </div>
  );
};

const Dashboard = () => {
  const { loading, moduleAccess } = useModuleAccess();
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);

  const { isLoading: tokenLoading, token, companyId } = useWiseAppAccess();
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('wiseapp_token');
    if (!storedToken && !token && !isTokenModalOpen) {
      setIsTokenModalOpen(true);
    }
  }, [token, isTokenModalOpen]);
  
  if (loading) {
    return <LoadingSpinner />;
  }

  const menuItems: MenuItem[] = [
    {
      title: "Checklists",
      icon: ClipboardCheck,
      link: "/checklist",
      description: "Gerencie os checklists semanais e mensais",
      enabled: moduleAccess.checklist
    },
    {
      title: "Contratações",
      icon: Users,
      link: "/motoristas",
      description: "Gerencie as informações para contratação de novos motoristas e agregados",
      enabled: moduleAccess.motoristas
    },
    {
      title: "Veículos",
      icon: Truck,
      link: "/veiculos",
      description: "Gerencie os veículos dos agregados e da sua empresa",
      enabled: moduleAccess.veiculos
    },
    {
      title: "Hodômetros",
      icon: Gauge,
      link: "/hodometros",
      description: "Acompanhe a leitura de hodômetro dos seus motoristas",
      enabled: moduleAccess.hodometros
    },
    {
      title: "Clientes",
      icon: Store,
      link: "/clientes",
      description: "Gerencie os clientes da sua empresa",
      enabled: moduleAccess.clientes
    },
    {
      title: "Resumos em Grupo",
      icon: ClipboardList,
      link: "",
      description: "Em Breve",
      enabled: true
    }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="w-full max-w-7xl mx-auto px-6">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400
                        dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent
                        font-display tracking-tight relative inline-block mb-4 md:mb-0">
            Central de Automações
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-blue-400/20 
                          to-blue-300/20 blur-xl opacity-50" />
          </h1>
          <button
            title="Importar dados de motoristas, veículos ou clientes"
            onClick={() => setIsImportExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                     rounded-lg border border-transparent hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 
                     focus:ring-offset-2 transition-colors shadow-sm"
          >
            <FileDown className="w-5 h-5" />
            Importar Dados
          </button>
        </header>

        <nav className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" aria-label="Menu principal">
          {menuItems.map((item) => (
            <MenuCard
              key={item.link}
              {...item}
            />
          ))}
        </nav>
      </div>

      <ImportExportModal 
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
      />

      <WiseAppTokenModal
        open={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onTokenSaved={(token) => {
          try {
            localStorage.setItem('wiseapp_token', token);
            setIsTokenModalOpen(false);
            toast.success('Token configurado com sucesso!');
          } catch (error) {
            console.error('Error saving token:', error);
            toast.error('Erro ao salvar token. Por favor, tente novamente.');
          }
        }}
        companyId={companyId}
      />
    </div>
  );
};

export default Dashboard;