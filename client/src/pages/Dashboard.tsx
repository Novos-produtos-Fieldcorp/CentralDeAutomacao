import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, FileDown, Gauge, Store, Truck, Users, Lock, AlertTriangle, MessagesSquare, Tag } from 'lucide-react';
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
  isSpecial?: boolean;
  onClick?: () => void;
}

const MenuCard = ({
  title,
  icon: Icon,
  link,
  description,
  enabled = true,
  isSpecial = false,
  onClick
}: MenuItem) => {
  const cardContent = (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${
        isSpecial 
          ? 'from-orange-500/10 to-amber-500/5' 
          : 'from-primary/5 to-transparent'
      } opacity-0 transition-opacity duration-300 ${enabled ? 'group-hover:opacity-100' : ''}`} />
      <div className="relative flex flex-col h-full justify-between p-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 flex items-center justify-center ${
              isSpecial 
                ? 'bg-orange-100 dark:bg-orange-900/30 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40' 
                : 'bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40'
              } rounded-full transform transition-all duration-300 ${enabled ? 'group-hover:scale-110' : ''}`}>
              <Icon className={`w-6 h-6 ${
                isSpecial 
                  ? 'text-orange-600 dark:text-orange-400 group-hover:text-orange-700 dark:group-hover:text-orange-300' 
                  : 'text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300'
                } transition-colors duration-300`} />
            </div>
            
            <h3 className={`text-xl font-bold ${
              isSpecial 
                ? 'text-orange-700 dark:text-orange-400' 
                : 'text-gray-800 dark:text-white'
              }`}>
              {title}
              {!enabled && <Lock className="w-4 h-4 text-gray-400 dark:text-gray-600 ml-2 inline-block" />}
            </h3>
          </div>
          
          <p className={`text-base text-center mt-8 ${
            isSpecial 
              ? 'text-orange-700/80 dark:text-orange-300/90' 
              : 'text-gray-600 dark:text-gray-300'
          }`}>
            {description}
          </p>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <div
        onClick={onClick}
        className={`group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl 
                 border ${isSpecial ? 'border-orange-200 dark:border-orange-800/50' : 'border-gray-200 dark:border-gray-700'} 
                 shadow-md hover:shadow-lg
                 transform hover:-translate-y-1 transition-all duration-300
                 w-full h-[200px] flex flex-col justify-between
                 cursor-pointer`}
        aria-label={`Acessar ${title}`}
      >
        {cardContent}
      </div>
    );
  }

  return enabled ? (
    <Link
      to={link}
      className={`group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl 
                 border ${isSpecial ? 'border-orange-200 dark:border-orange-800/50' : 'border-gray-200 dark:border-gray-700'} 
                 shadow-md hover:shadow-lg
                 transform hover:-translate-y-1 transition-all duration-300
                 w-full h-[200px] flex flex-col justify-between`}
      aria-label={`Acessar ${title}`}
    >
      {cardContent}
    </Link>
  ) : (
    <div
      className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl 
                 border border-gray-200 dark:border-gray-700 shadow-md opacity-60
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
  const [showResumosPopup, setShowResumosPopup] = useState(false);

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

  const handleResumosClick = () => {
    setShowResumosPopup(true);
  };

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
      icon: MessagesSquare,
      link: "/resumos-grupo",
      description: "Configure resumos automáticos para seus grupos de WhatsApp",
      enabled: moduleAccess.resumos,
      onClick: moduleAccess.resumos ? undefined : handleResumosClick
    },
    {
      title: "Tags",
      icon: Tag,
      link: "/tags-admin",
      description: "Gerencie tags para categorizar e organizar motoristas",
      enabled: moduleAccess.tags
    }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="w-full max-w-7xl mx-auto px-6">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400
                        dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent
                        font-display tracking-tight relative inline-block mb-4 md:mb-0">
            Central de Automações
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-blue-400/20 
                          to-blue-300/20 blur-xl opacity-50" />
          </h1>
          <button
            title="Importar dados de motoristas, veículos ou clientes"
            onClick={() => setIsImportExportModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700
                     rounded-lg border border-gray-200 hover:bg-gray-200 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 
                     focus:ring-offset-2 transition-colors dark:bg-gray-700 dark:text-gray-300
                     dark:border-gray-600 dark:hover:bg-gray-600"
          >
            <FileDown className="w-4 h-4" />
            Importar Dados
          </button>
        </header>

        <nav className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Menu principal">
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

      {/* Access Popup for Resumos em Grupo */}
      {showResumosPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={24} />
                Acesso Bloqueado
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Para adquirir acesso ao módulo de Resumos em Grupo, entre em contato pelo WhatsApp:
              </p>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800/30">
                <a 
                  href="https://w.app/iinydz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-green-800 dark:text-green-200 font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Clique aqui para entrar em contato
                </a>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowResumosPopup(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;