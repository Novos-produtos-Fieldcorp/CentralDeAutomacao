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
// Webhook URL for sending summaries
const WEBHOOK_URL = "https://n8nqp.wiseapp360.com/webhook/resumo-grupo";
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
    
    // Send webhook with just the required fields
    try {
      // Prepare the webhook payload with required fields including company_id, group_id, account_id and api_key
      const webhookData = {
        nome_do_grupo: grupo.nome_grupo,
        company_id: grupo.company_id,
        group_id: grupo.id,
        account_id: accountId,
        api_key: userApiKey,
      };
      console.log(
        "Sending webhook data:",
        JSON.stringify({ ...webhookData, api_key: userApiKey ? '[REDACTED]' : null }, null, 2),
      );
      // Send the webhook
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookData),
      });
      console.log("Webhook response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Webhook error response: ${errorText}`);
        throw new Error(
          `Failed to send webhook: ${response.status} - ${errorText}`,
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          message: `Summary sent successfully for group ${grupo.nome_grupo}`,
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
    } catch (webhookError: any) {
      const errorMessage = `Error sending webhook: ${webhookError.message}`;
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
