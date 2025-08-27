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
    // Send webhook with just the required fields
    try {
      // Prepare the webhook payload with required fields including company_id and group_id
      const webhookData = {
        nome_do_grupo: grupo.nome_grupo,
        url_do_grupo: grupo.url_grupo,
        company_id: grupo.company_id,
        group_id: grupo.id,
      };
      console.log(
        "Sending webhook data (nome_grupo, url_grupo, company_id, and group_id):",
        JSON.stringify(webhookData, null, 2),
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
    } catch (webhookError) {
      const errorMessage = `Error sending webhook: ${webhookError.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  } catch (error) {
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
