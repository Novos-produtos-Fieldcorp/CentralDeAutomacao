import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  FileDown,
  Gauge,
  Store,
  Truck,
  Users,
  Lock,
  AlertTriangle,
  MessagesSquare,
  Tag,
  Briefcase,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useModuleAccess } from "../hooks/useModuleAccess";
import ImportExportModal from "../components/ImportExportModal";
import LoadingSpinner from "../components/LoadingSpinner";

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
  onClick,
}: MenuItem) => {
  const cardContent = (
    <>
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          isSpecial
            ? "from-orange-500/10 to-amber-500/5"
            : "from-primary/5 to-transparent"
        } opacity-0 transition-opacity duration-300 ${enabled ? "group-hover:opacity-100" : ""}`}
      />
      <div className="relative flex flex-col h-full justify-between p-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 flex items-center justify-center ${
                isSpecial
                  ? "bg-orange-100 dark:bg-orange-900/30 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40"
                  : "bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40"
              } rounded-full transform transition-all duration-300 ${enabled ? "group-hover:scale-110" : ""}`}
            >
              <Icon
                className={`w-6 h-6 ${
                  isSpecial
                    ? "text-orange-600 dark:text-orange-400 group-hover:text-orange-700 dark:group-hover:text-orange-300"
                    : "text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                } transition-colors duration-300`}
              />
            </div>

            <h3
              className={`text-xl font-bold ${
                isSpecial
                  ? "text-orange-700 dark:text-orange-400"
                  : "text-gray-800 dark:text-white"
              }`}
            >
              {title}
              {!enabled && (
                <Lock className="w-4 h-4 text-gray-400 dark:text-gray-600 ml-2 inline-block" />
              )}
            </h3>
          </div>

          <p
            className={`text-base text-center mt-8 ${
              isSpecial
                ? "text-orange-700/80 dark:text-orange-300/90"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
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
                 border ${isSpecial ? "border-orange-200 dark:border-orange-800/50" : "border-gray-200 dark:border-gray-700"} 
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
                 border ${isSpecial ? "border-orange-200 dark:border-orange-800/50" : "border-gray-200 dark:border-gray-700"} 
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

  // Token management is now handled by WiseAppAccessContext

  if (loading) {
    return <LoadingSpinner />;
  }

  const menuItems: MenuItem[] = [
    {
      title: "Checklists",
      icon: ClipboardCheck,
      link: "/checklist",
      description: "Gerencie os checklists semanais e mensais",
      enabled: moduleAccess.checklist,
    },
    {
      title: "Contratações",
      icon: Users,
      link: "/motoristas",
      description:
        "Gerencie as informações para contratação de novos motoristas e agregados",
      enabled: moduleAccess.motoristas,
    },
    {
      title: "Vagas",
      icon: Briefcase,
      link: "/vagas",
      description:
        "Gerencie as vagas de emprego e processos seletivos da empresa",
      enabled: moduleAccess.vagas,
    },
    {
      title: "Veículos",
      icon: Truck,
      link: "/veiculos",
      description: "Gerencie os veículos dos agregados e da sua empresa",
      enabled: moduleAccess.veiculos,
    },
    {
      title: "Hodômetros",
      icon: Gauge,
      link: "/hodometros",
      description: "Acompanhe a leitura de hodômetro dos seus motoristas",
      enabled: moduleAccess.hodometros,
    },
    {
      title: "Clientes",
      icon: Store,
      link: "/clientes",
      description: "Gerencie os clientes da sua empresa",
      enabled: moduleAccess.clientes,
    },
    {
      title: "Resumos em Grupo",
      icon: MessagesSquare,
      link: "/resumos-grupo",
      description: "Configure resumos automáticos para seus grupos de WhatsApp",
      enabled: moduleAccess.resumos,
    },
    {
      title: "Marcadores",
      icon: Tag,
      link: "/tags-admin",
      description:
        "Gerencie marcadores para categorizar e organizar motoristas",
      enabled: moduleAccess.tags,
    },
    {
      title: "Comprovantes",
      icon: Tag,
      link: "/comprovantes",
      description:
        "Gerencie Comprovantes para acompanhar as entregas e envios dos motoristas",
      enabled: moduleAccess.comprovantes,
    },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="w-full max-w-7xl mx-auto px-6">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12">
          <h1
            className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400
                        dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent
                        font-display tracking-tight relative inline-block mb-4 md:mb-0"
          >
            Central de Automações
            <div
              className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-blue-400/20 
                          to-blue-300/20 blur-xl opacity-50"
            />
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

        <nav
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          aria-label="Menu principal"
        >
          {menuItems.map((item) => (
            <MenuCard key={item.link} {...item} />
          ))}
        </nav>
      </div>

      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
