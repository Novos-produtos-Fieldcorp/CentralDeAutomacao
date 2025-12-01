import { useState, useEffect } from 'react';
import { ChevronDown, Check, Building2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWiseAppAccess } from '@/context/WiseAppAccessContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

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
  const [isOpen, setIsOpen] = useState(false);

  const currentAccount = accounts.find(a => a.account_id === accountId);

  const fetchAccounts = async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/wiseapp/available-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
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

  const handleSwitchAccount = async (account: WiseAppAccount) => {
    if (account.account_id === accountId) {
      setIsOpen(false);
      return;
    }

    try {
      // Update localStorage
      localStorage.setItem('account_id', account.account_id);
      
      // Call context switch function if available
      if (switchAccount) {
        switchAccount(account.account_id, account.company_id);
      }

      // Invalidate all queries to force refetch with new account
      queryClient.invalidateQueries();

      toast.success(`Alternado para ${account.name}`);
      setIsOpen(false);

      // Reload page to ensure all data is refreshed
      window.location.reload();
    } catch (error) {
      console.error('Erro ao trocar conta:', error);
      toast.error('Erro ao trocar de conta');
    }
  };

  // Don't show if no token or only one account
  if (!token) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 min-w-[140px] justify-between"
          data-testid="button-account-switcher"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {currentAccount?.name || accountId || 'Conta'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Alterar conta</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              fetchAccounts();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading && accounts.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Carregando contas...
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nenhuma conta encontrada
          </div>
        ) : (
          accounts.map((account) => (
            <DropdownMenuItem
              key={account.account_id}
              onClick={() => handleSwitchAccount(account)}
              className="flex items-center justify-between gap-2 cursor-pointer"
              data-testid={`account-option-${account.account_id}`}
            >
              <div className="flex flex-col">
                <span className="font-medium">{account.name}</span>
                {account.role && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {account.role === 'administrator' ? 'Administrador' : 'Agente'}
                  </span>
                )}
              </div>
              {account.account_id === accountId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AccountSwitcher;
