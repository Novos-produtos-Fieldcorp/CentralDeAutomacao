import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const wiseappApiUrl = process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, wiseapp-token, wiseapp-account-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { token, email } = body;

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Token é obrigatório" }),
      };
    }

    console.log("🔍 Buscando contas disponíveis para usuário...");

    const profileResponse = await fetch(`${wiseappApiUrl}/api/v1/profile`, {
      method: "GET",
      headers: {
        api_access_token: token,
        "Content-Type": "application/json",
      },
    });

    if (!profileResponse.ok) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Token inválido" }),
      };
    }

    const userData = await profileResponse.json();
    const userEmail = email || userData.email;

    console.log(`✅ Token válido para: ${userData.name} (${userEmail})`);

    const { data: userAccounts, error: dbError } = await supabase
      .from("wiseapp_acesso")
      .select("id_conta_wiseapp, nome, email")
      .eq("email", userEmail);

    if (dbError) {
      console.error("Erro ao buscar contas do DB:", dbError);
    }

    const { data: companies, error: companiesError } = await supabase
      .from("company")
      .select("company_id, nome_company, id_conta_wiseapp")
      .not("id_conta_wiseapp", "is", null);

    if (companiesError) {
      console.error("Erro ao buscar empresas:", companiesError);
    }

    const accountToCompany = new Map<string, { company_id: number; nome: string }>();
    companies?.forEach((c) => {
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

    for (const accountId of knownAccountIds) {
      try {
        const accountResponse = await fetch(
          `${wiseappApiUrl}/api/v1/accounts/${accountId}`,
          {
            method: "GET",
            headers: {
              api_access_token: token,
              "Content-Type": "application/json",
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
            role: accountData.role || "agent",
          });

          console.log(`✅ Conta ${accountId} (${accountData.name}) validada`);
        }
      } catch (err) {
        console.log(`⚠️ Conta ${accountId} não acessível para este usuário`);
      }
    }

    console.log(`📋 Total de ${validatedAccounts.length} contas disponíveis`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: {
          name: userData.name,
          email: userEmail,
        },
        accounts: validatedAccounts,
      }),
    };
  } catch (error) {
    console.error("Erro ao buscar contas disponíveis:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro interno ao buscar contas" }),
    };
  }
};

export { handler };
