import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');
    const accountId = url.searchParams.get('account_id');
    const apiKey = url.searchParams.get('api_key');

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint parameter' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Missing account ID' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Remove unnecessary query parameters
    const cleanParams = new URLSearchParams(url.search);
    cleanParams.delete('endpoint');
    cleanParams.delete('account_id');
    cleanParams.delete('api_key');

    // Build WiseApp API URL
    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/${endpoint}${cleanParams.toString() ? `?${cleanParams.toString()}` : ''}`;
    
    // Get original request headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      'api_access_token': apiKey,
    });

    // Forward the request to WiseApp API
    const response = await fetch(wiseAppUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' 
        ? await req.text() 
        : undefined,
    });

    // Get the response content type
    const contentType = response.headers.get('content-type');
    
    // Check if the response is JSON or not
    if (contentType && contentType.includes('application/json')) {
      // For JSON responses, parse and return as JSON
      const responseData = await response.text();
      
      try {
        // Try to parse as JSON
        const parsedData = JSON.parse(responseData);
        
        return new Response(
          JSON.stringify(parsedData),
          { 
            status: response.status,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
            }
          }
        );
      } catch (parseError) {
        // If parsing fails, return the raw text with an error wrapper
        console.error('Failed to parse JSON response:', parseError);
        
        return new Response(
          JSON.stringify({ 
            error: 'Invalid JSON response from API',
            data: responseData
          }),
          { 
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      // For non-JSON responses (like HTML), return a JSON error object
      const responseText = await response.text();
      
      return new Response(
        JSON.stringify({ 
          error: 'Non-JSON response received from API',
          status: response.status,
          contentType: contentType || 'unknown',
          responsePreview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('Error in proxy function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unexpected error in proxy',
        details: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});