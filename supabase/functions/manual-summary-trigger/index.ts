import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { group_id, company_id } = await req.json()

    // Validate required parameters
    if (!group_id || !company_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: group_id and company_id are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log the manual trigger request
    console.log(`Manual summary trigger requested for group_id: ${group_id}, company_id: ${company_id}`)

    // Here you would typically:
    // 1. Fetch group data from the database
    // 2. Generate the summary content
    // 3. Send the summary to the WhatsApp group
    // 4. Log the delivery attempt
    
    // For now, we'll simulate a successful response
    // In a real implementation, you would integrate with your summary generation logic
    
    const response = {
      success: true,
      message: 'Manual summary triggered successfully',
      group_id,
      company_id,
      timestamp: new Date().toISOString()
    }

    // Record the manual trigger in the database (envio_resumo table)
    // This would be implemented with actual Supabase client calls
    
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in manual-summary-trigger:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})