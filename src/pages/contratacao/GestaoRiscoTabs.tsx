import React, { useState } from 'react';
import { AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import GestaoRisco from './GestaoRisco';
import GestaoRiscoEmpresa from './GestaoRiscoEmpresa';
import GestaoRiscoStatus from './GestaoRiscoStatus';

const GestaoRiscoTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'motoristas' | 'empresas' | 'status'>('motoristas');

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('motoristas')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'motoristas'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <AlertCircle className="w-5 h-5 mr-2" />
              Motoristas
            </button>
            <button
              onClick={() => setActiveTab('empresas')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'empresas'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Building2 className="w-5 h-5 mr-2" />
              Empresas
            </button>
            <button
              onClick={() => setActiveTab('status')}
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'status'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Status
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'motoristas' && <GestaoRisco />}
          {activeTab === 'empresas' && <GestaoRiscoEmpresa />}
          {activeTab === 'status' && <GestaoRiscoStatus />}
        </div>
      </div>
    </div>
  );
};

export default GestaoRiscoTabs;