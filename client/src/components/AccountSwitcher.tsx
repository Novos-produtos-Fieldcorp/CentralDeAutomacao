import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Building2, RefreshCw } from 'lucide-react';
import { useWiseAppAccess } from '@/context/WiseAppAccessContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const WISEAPP_API_URL = import.meta.env.VITE_CHAT_API_URL || 'https://chat.wiseapp360.com';

interface WiseAppAccount {
  account_id: string;
  name: string;
  company_id: number | null;
  role?: string;
}

export function AccountSwitcher() {
  const { token, accountId, switchAccount } = useWiseAppAccess();
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState<WiseAppAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentAccount = accounts.find(a => a.account_id === accountId);

  const fetchAccounts = async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const profileResponse = await fetch(`${WISEAPP_API_URL}/api/v1/profile`, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (!profileResponse.ok) {
        console.error('Token inválido');
        setAccounts([]);
        return;
      }

      const userData = await profileResponse.json();
      const email = userData.email;

      const { data: userAccounts } = await supabase
        .from('wiseapp_acesso')
        .select('id_conta_wiseapp, nome, email')
        .eq('email', email);

      const { data: companies } = await supabase
        .from('company')
        .select('company_id, nome_company, id_conta_wiseapp')
        .not('id_conta_wiseapp', 'is', null);

      const accountToCompany = new Map<string, { company_id: number; nome: string }>();
      companies?.forEach((c) => {
        if (c.id_conta_wiseapp) {
          accountToCompany.set(c.id_conta_wiseapp.toString(), {
            company_id: c.company_id,
            nome: c.nome_company,
          });
        }
      });

      const knownAccountIds = new Set<string>();
      userAccounts?.forEach((ua) => {
        if (ua.id_conta_wiseapp) {
          knownAccountIds.add(ua.id_conta_wiseapp.toString());
        }
      });
      companies?.forEach((c) => {
        if (c.id_conta_wiseapp) {
          knownAccountIds.add(c.id_conta_wiseapp.toString());
        }
      });

      const validatedAccounts: WiseAppAccount[] = [];

      for (const accId of knownAccountIds) {
        try {
          const accountResponse = await fetch(`${WISEAPP_API_URL}/api/v1/accounts/${accId}`, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
          });

          if (accountResponse.ok) {
            const accountData = await accountResponse.json();
            const companyInfo = accountToCompany.get(accId);

            validatedAccounts.push({
              account_id: accId,
              name: accountData.name || companyInfo?.nome || `Conta ${accId}`,
              company_id: companyInfo?.company_id || null,
              role: accountData.role || 'agent',
            });
          }
        } catch (err) {
          console.log(`Conta ${accId} não acessível para este usuário`);
        }
      }

      setAccounts(validatedAccounts);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token && isOpen) {
      fetchAccounts();
    }
  }, [token, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearAccountCaches = (oldAccountId: string | null, newAccountId: string) => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('wiseapp-labels') ||
        key.includes('wiseapp-contacts') ||
        key.includes('tag-cache') ||
        (oldAccountId && key.includes(oldAccountId))
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🧹 Limpou ${keysToRemove.length} caches ao trocar de conta`);
  };

  const handleSwitchAccount = async (account: WiseAppAccount) => {
    if (account.account_id === accountId) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    setIsOpen(false);

    try {
      clearAccountCaches(accountId, account.account_id);
      
      localStorage.setItem('account_id', account.account_id);
      
      if (switchAccount) {
        switchAccount(account.account_id, account.company_id);
      }

      await queryClient.invalidateQueries();
      await queryClient.refetchQueries({ type: 'active' });

      toast.success(`Alternado para ${account.name}`);
    } catch (error) {
      console.error('Erro ao trocar conta:', error);
      toast.error('Erro ao trocar de conta');
    } finally {
      setIsSwitching(false);
    }
  };

  if (!token) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !isSwitching && setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md border border-gray-300 dark:border-gray-600 transition-colors min-w-[140px] justify-between ${isSwitching ? 'opacity-70 cursor-wait' : ''}`}
        data-testid="button-account-switcher"
      >
        <div className="flex items-center gap-2 truncate">
          {isSwitching ? (
            <RefreshCw className="h-4 w-4 flex-shrink-0 text-blue-500 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
          )}
          <span className="truncate text-gray-800 dark:text-gray-200">
            {isSwitching ? 'Alternando...' : (currentAccount?.name || `Conta ${accountId}` || 'Conta')}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Alterar conta</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchAccounts();
              }}
              disabled={isLoading}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-gray-500 dark:text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="py-1 max-h-60 overflow-y-auto">
            {isLoading && accounts.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Carregando contas...
              </div>
            ) : accounts.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhuma conta encontrada
              </div>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.account_id}
                  onClick={() => handleSwitchAccount(account)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between gap-2 transition-colors"
                  data-testid={`account-option-${account.account_id}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{account.name}</span>
                    {account.role && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {account.role === 'administrator' ? 'Administrador' : 'Agente'}
                      </span>
                    )}
                  </div>
                  {account.account_id === accountId && (
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountSwitcher;
