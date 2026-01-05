import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const WISEAPP_API_URL = 'https://chat.wiseapp360.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api_access_token, wiseapp-token, wiseapp-account-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const { token, email } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('🔍 Buscando contas disponíveis para usuário...');

    const profileResponse = await fetch(`${WISEAPP_API_URL}/api/v1/profile`, {
      method: 'GET',
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userData = await profileResponse.json();
    const userEmail = email || userData.email;

    console.log(`✅ Token válido para: ${userData.name} (${userEmail})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: userAccounts, error: dbError } = await supabase
      .from('wiseapp_acesso')
      .select('id_conta_wiseapp, nome, email')
      .eq('email', userEmail);

    if (dbError) {
      console.error('Erro ao buscar contas do DB:', dbError);
    }

    const { data: companies, error: companiesError } = await supabase
      .from('company')
      .select('company_id, nome_company, id_conta_wiseapp')
      .not('id_conta_wiseapp', 'is', null);

    if (companiesError) {
      console.error('Erro ao buscar empresas:', companiesError);
    }

    const accountToCompany = new Map<string, { company_id: number; nome: string }>();
    companies?.forEach((c: { id_conta_wiseapp: number | null; company_id: number; nome_company: string }) => {
      if (c.id_conta_wiseapp) {
        accountToCompany.set(c.id_conta_wiseapp.toString(), {
          company_id: c.company_id,
          nome: c.nome_company,
        });
      }
    });

    const validatedAccounts: Array<{
      account_id: string;
      name: string;
      company_id: number | null;
      role?: string;
    }> = [];

    const knownAccountIds = new Set<string>();
    userAccounts?.forEach((ua: { id_conta_wiseapp: number | null }) => {
      if (ua.id_conta_wiseapp) {
        knownAccountIds.add(ua.id_conta_wiseapp.toString());
      }
    });
    companies?.forEach((c: { id_conta_wiseapp: number | null }) => {
      if (c.id_conta_wiseapp) {
        knownAccountIds.add(c.id_conta_wiseapp.toString());
      }
    });

    for (const accountId of knownAccountIds) {
      try {
        const accountResponse = await fetch(
          `${WISEAPP_API_URL}/api/v1/accounts/${accountId}`,
          {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
          }
        );

        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          const companyInfo = accountToCompany.get(accountId);

          validatedAccounts.push({
            account_id: accountId,
            name: accountData.name || companyInfo?.nome || `Conta ${accountId}`,
            company_id: companyInfo?.company_id || null,
            role: accountData.role || 'agent',
          });

          console.log(`✅ Conta ${accountId} (${accountData.name}) validada`);
        }
      } catch (err) {
        console.log(`⚠️ Conta ${accountId} não acessível para este usuário`);
      }
    }

    console.log(`📋 Total de ${validatedAccounts.length} contas disponíveis`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          name: userData.name,
          email: userEmail,
        },
        accounts: validatedAccounts,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Erro ao buscar contas disponíveis:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao buscar contas' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
