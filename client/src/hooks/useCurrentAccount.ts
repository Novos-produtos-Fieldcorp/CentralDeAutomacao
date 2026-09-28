import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface CurrentAccountData {
  accountId: string | null;
  companyId: number | null;
  isReady: boolean;
  isLoading: boolean;
}

// Overrides de dados por módulo, sem qualquer alteração no banco.
// Para a account_id abaixo (chave do mapa), as rotas cujo prefixo bater
// passam a enxergar os dados da account_id de destino (`targetAccountId`).
// Ajuste/remova estas entradas aqui caso os valores reais sejam diferentes.
const ACCOUNT_DATA_OVERRIDES: Record<string, { pathPrefix: string; targetAccountId: string }[]> = {
  '01': [
    { pathPrefix: '/motoristas', targetAccountId: '20' }, // automação de contratação
    { pathPrefix: '/hodometros', targetAccountId: '39' }, // automação de hodômetro
  ],
};

// Cache em memória do company_id resolvido para cada account_id de destino,
// evitando repetir a consulta a cada render/navegação.
const overriddenCompanyIdCache = new Map<string, number | null>();

const resolveOverrideTargetAccountId = (
  baseAccountId: string | null,
  pathname: string
): string | null => {
  if (!baseAccountId) return null;
  const overrides = ACCOUNT_DATA_OVERRIDES[baseAccountId];
  if (!overrides) return null;
  const match = overrides.find((o) => pathname.startsWith(o.pathPrefix));
  return match ? match.targetAccountId : null;
};

export const useCurrentAccount = (): CurrentAccountData => {
  const wiseAppAccess = useWiseAppAccess();
  const auth = useAuth();
  const location = useLocation();

  // WiseAppAccess is the authoritative source when available
  // Only fall back to Auth after WiseApp has finished loading AND has no data
  const wiseAppIsLoaded = !wiseAppAccess.isLoading;
  const hasWiseAppData = !!wiseAppAccess.accountId || !!wiseAppAccess.companyId;

  // Use WiseApp data if it's loaded and has data, otherwise fall back to Auth
  const baseAccountId = hasWiseAppData
    ? wiseAppAccess.accountId
    : (wiseAppIsLoaded ? auth.accountId : null);

  const baseCompanyId = hasWiseAppData
    ? wiseAppAccess.companyId
    : (wiseAppIsLoaded ? auth.companyId : null);

  const targetOverrideAccountId = resolveOverrideTargetAccountId(
    baseAccountId ?? null,
    location.pathname
  );

  const [overriddenCompanyId, setOverriddenCompanyId] = useState<number | null | undefined>(
    targetOverrideAccountId ? overriddenCompanyIdCache.get(targetOverrideAccountId) : undefined
  );

  useEffect(() => {
    if (!targetOverrideAccountId) {
      setOverriddenCompanyId(undefined);
      return;
    }

    if (overriddenCompanyIdCache.has(targetOverrideAccountId)) {
      setOverriddenCompanyId(overriddenCompanyIdCache.get(targetOverrideAccountId) ?? null);
      return;
    }

    let cancelled = false;

    supabase
      .from('company')
      .select('company_id')
      .eq('id_conta_wiseapp', targetOverrideAccountId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        const resolved = !error && data ? data.company_id : null;
        overriddenCompanyIdCache.set(targetOverrideAccountId, resolved);
        setOverriddenCompanyId(resolved);
      });

    return () => {
      cancelled = true;
    };
  }, [targetOverrideAccountId]);

  const companyId = targetOverrideAccountId
    ? (overriddenCompanyId ?? null)
    : baseCompanyId;

  const accountId = targetOverrideAccountId ?? baseAccountId;

  // Enquanto o override está resolvendo o company_id de destino, tratamos
  // como loading para evitar consultas com o companyId antigo/errado.
  const overrideIsLoading = !!targetOverrideAccountId && overriddenCompanyId === undefined;

  const isReady = wiseAppIsLoaded && !overrideIsLoading && !!accountId && !!companyId;
  const isLoading = wiseAppAccess.isLoading || overrideIsLoading;

  return {
    accountId: accountId ?? null,
    companyId: companyId ?? null,
    isReady,
    isLoading
  };
};

export const getAccountQueryKey = (baseKey: string | string[], accountId: string | null): (string | null)[] => {
  const keys = Array.isArray(baseKey) ? baseKey : [baseKey];
  return [...keys, accountId];
};
