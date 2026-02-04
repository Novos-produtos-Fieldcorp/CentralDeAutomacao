import { createClient } from "npm:@supabase/supabase-js";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
// Initialize Supabase client with environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// AI Summary Service URL (uses Express proxy)
// Set REPLIT_APP_URL environment variable in Supabase Edge Functions settings
const AI_SERVICE_URL = Deno.env.get('REPLIT_APP_URL') || 'https://your-replit-app.replit.app';
const AI_SUMMARY_ENDPOINT = `${AI_SERVICE_URL}/api/ai/group-summary`;
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  try {
    // This endpoint allows manual triggering of a summary for a specific group
    const { group_id, company_id } = await req.json();
    if (!group_id) {
      throw new Error("Missing required parameter: group_id");
    }
    if (!company_id) {
      throw new Error("Missing required parameter: company_id");
    }
    console.log(
      `Manual summary trigger requested for group_id: ${group_id}, company_id: ${company_id}`,
    );
    // Get group data
    const { data: grupo, error } = await supabase
      .from("grupo_resumo")
      .select("*")
      .eq("id", group_id)
      .single();
    if (error) {
      const errorMessage = `Error fetching group: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    if (!grupo) {
      const errorMessage = `Group with ID ${group_id} not found`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    if (!grupo.ativo) {
      const errorMessage = `Group with ID ${group_id} is inactive`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    // Get id_conta_wiseapp from company table
    const { data: companyData, error: companyError } = await supabase
      .from("company")
      .select("id_conta_wiseapp")
      .eq("company_id", company_id)
      .single();
    
    if (companyError) {
      console.error("Error fetching company data:", companyError);
    }
    
    const accountId = companyData?.id_conta_wiseapp || null;
    console.log(`Found account_id: ${accountId} for company_id: ${company_id}`);
    
    // Get an active API key from wiseapp_acesso table for this account (secure - based on company, not user input)
    let userApiKey = null;
    if (accountId) {
      const { data: accessData, error: accessError } = await supabase
        .from("wiseapp_acesso")
        .select("access_token_wiseapp")
        .eq("id_conta_wiseapp", accountId)
        .not("access_token_wiseapp", "is", null)
        .limit(1)
        .single();
      
      if (accessError) {
        console.warn("Could not fetch API key for account:", accessError.message);
      } else {
        userApiKey = accessData?.access_token_wiseapp || null;
        console.log(`Found API key for account ${accountId}: ${userApiKey ? 'Yes' : 'No'}`);
      }
    }
    
    // Send AI Summary request
    try {
      // Prepare the AI summary request with required fields
      const summaryData = {
        nome_do_grupo: grupo.nome_grupo,
        company_id: grupo.company_id,
        group_id: grupo.id,
        account_id: accountId,
        api_key: userApiKey,
        inbox_id: grupo.inbox_id,
      };
      console.log(
        "Sending AI summary request:",
        JSON.stringify({ ...summaryData, api_key: userApiKey ? '[REDACTED]' : null }, null, 2),
      );
      // Send to AI Summary Service
      const response = await fetch(AI_SUMMARY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(summaryData),
      });
      console.log("AI Summary response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI Summary error response: ${errorText}`);
        throw new Error(
          `Failed to generate AI summary: ${response.status} - ${errorText}`,
        );
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(`AI Summary failed: ${result.error}`);
      }
      return new Response(
        JSON.stringify({
          success: true,
          message: `AI Summary generated successfully for group ${grupo.nome_grupo}`,
          summary: result.summary,
          data: {
            group_id: grupo.id,
            group_name: grupo.nome_grupo,
          },
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 200,
        },
      );
    } catch (aiError: any) {
      const errorMessage = `Error generating AI summary: ${aiError.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    console.error("Error in group summary trigger:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      },
    );
  }
});
