import React, { useState, useEffect, useRef } from 'react';
import { Filter, ChevronDown, Search, X, MapPin, Tag, Truck } from 'lucide-react';

// Solução de posicionamento para dropdowns dos filtros
const AgregadosLista = ({ onSuccess }: { onSuccess?: () => void }) => {
  
  // Estados dos dropdowns
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showTipoVeiculoDropdown, setShowTipoVeiculoDropdown] = useState(false);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  
  // Estados de filtros
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [cidadeFilter, setCidadeFilter] = useState<string[]>([]);
  const [tipoVeiculoFilter, setTipoVeiculoFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  
  // Controle único de dropdown
  const closeAllDropdowns = () => {
    setShowStatusDropdown(false);
    setShowClienteDropdown(false);
    setShowCidadeDropdown(false);
    setShowTipoVeiculoDropdown(false);
    setShowTagsDropdown(false);
  };

  const toggleDropdown = (dropdownType: string) => {
    closeAllDropdowns();
    switch(dropdownType) {
      case 'status':
        setShowStatusDropdown(true);
        break;
      case 'cliente':
        setShowClienteDropdown(true);
        break;
      case 'cidade':
        setShowCidadeDropdown(true);
        break;
      case 'tipoVeiculo':
        setShowTipoVeiculoDropdown(true);
        break;
      case 'tags':
        setShowTagsDropdown(true);
        break;
    }
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.dropdown-container')) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-6">
      {/* SOLUÇÃO TÉCNICA: Container pai com relative, dropdowns com fixed + portal */}
      <div className="relative">
        {/* Filtros - Container pai: relative */}
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4 relative">
          <div className="flex flex-wrap gap-2">
            
            {/* Status Filter */}
            <div className="dropdown-container relative">
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-[100px] justify-between"
                onClick={() => toggleDropdown('status')}
              >
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Status</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* SOLUÇÃO: Dropdown com position fixed + z-index altíssimo */}
              {showStatusDropdown && (
                <div 
                  className="fixed bg-white dark:bg-gray-700 shadow-2xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64"
                  style={{ 
                    position: 'fixed',
                    top: '120px', // Posição fixa calculada
                    left: '20px', // Posição fixa calculada
                    zIndex: 999999 // Z-index altíssimo para escapar de qualquer contexto
                  }}
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Status Options</span>
                  </div>
                  {['Cadastrado', 'Qualificado', 'Documentação', 'Contratado'].map((status) => (
                    <div key={status} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cliente Filter */}
            <div className="dropdown-container relative">
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-[100px] justify-between"
                onClick={() => toggleDropdown('cliente')}
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  <span>Cliente</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showClienteDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showClienteDropdown && (
                <div 
                  className="fixed bg-white dark:bg-gray-700 shadow-2xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64"
                  style={{ 
                    position: 'fixed',
                    top: '120px',
                    left: '140px',
                    zIndex: 999999
                  }}
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Clientes</span>
                  </div>
                  {['Loggi', 'FastShop', 'Sem Cliente'].map((cliente) => (
                    <div key={cliente} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{cliente}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cidade Filter */}
            <div className="dropdown-container relative">
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-[100px] justify-between"
                onClick={() => toggleDropdown('cidade')}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Cidade</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showCidadeDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showCidadeDropdown && (
                <div 
                  className="fixed bg-white dark:bg-gray-700 shadow-2xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64"
                  style={{ 
                    position: 'fixed',
                    top: '120px',
                    left: '260px',
                    zIndex: 999999
                  }}
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Cidades</span>
                  </div>
                  {['São Paulo', 'Rio de Janeiro', 'Belo Horizonte'].map((cidade) => (
                    <div key={cidade} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{cidade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Tabela - Container SEM overflow: hidden */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          {/* IMPORTANTE: Container da tabela sem overflow: hidden */}
          <div className="overflow-x-auto" style={{ position: 'relative' }}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">
                    Cidade
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {/* Dados da tabela */}
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    João Silva
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Cadastrado
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    Loggi
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    São Paulo
                  </td>
                </tr>
                {/* Mais linhas... */}
                {Array.from({ length: 20 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      Motorista {i + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Qualificado
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      FastShop
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      Rio de Janeiro
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgregadosLista;