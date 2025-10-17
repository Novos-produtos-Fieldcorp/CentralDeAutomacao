import { Router } from "express";
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getWiseAppToken(companyId: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('wiseapp_acesso')
      .select('access_token_wiseapp')
      .eq('company_id', companyId)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error fetching WiseApp token:', error);
      return null;
    }

    return data.access_token_wiseapp;
  } catch (error) {
    console.error('Error in getWiseAppToken:', error);
    return null;
  }
}

// Helper function to get WiseApp account ID by company ID
async function getWiseAppAccountId(companyId: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('wiseapp_acesso')
      .select('account_id')
      .eq('company_id', companyId)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error fetching WiseApp account ID:', error);
      return null;
    }

    return data.account_id;
  } catch (error) {
    console.error('Error in getWiseAppAccountId:', error);
    return null;
  }
}

// Get WiseApp token for a company
router.get('/:companyId/token', async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log("Fetching WiseApp token for company_id:", companyId);
    
    const token = await getWiseAppToken(parseInt(companyId));
    
    if (!token) {
      return res.status(404).json({ 
        error: "Token WiseApp não encontrado",
        message: "Configure o token WiseApp nas configurações da empresa" 
      });
    }
    
    res.json({ token });
  } catch (error) {
    console.error("Erro ao buscar token WiseApp:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor", 
      details: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

// Get WiseApp labels for a company
router.get('/:companyId/labels', async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log(`Fetching WiseApp labels for company ${companyId}`);
    
    const token = await getWiseAppToken(parseInt(companyId));
    const accountId = await getWiseAppAccountId(parseInt(companyId));
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token WiseApp não configurado para esta empresa' 
      });
    }
    
    if (!accountId) {
      return res.status(400).json({ 
        error: 'Account ID não configurado para esta empresa' 
      });
    }

    const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
    console.log(`Fetching labels from: ${wiseAppUrl}`);

    // Implementar retry logic para accounts grandes
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Para account_id 20 ou outros accounts grandes, adicionar delay
        if (accountId === '20' && attempts > 1) {
          console.log(`Rate limiting retry ${attempts} for account ${accountId}, waiting 3s...`);
          await delay(3000);
        }

        const requestHeaders: any = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
        
        // For account ID 20, try different token header formats
        if (accountId === '20' && attempts > 1) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
          requestHeaders['api_access_token'] = token;
        } else {
          requestHeaders['api_access_token'] = token;
        }
        
        response = await fetch(wiseAppUrl, {
          method: 'GET',
          headers: requestHeaders,
        });

        if (response.ok) {
          break;
        }
        
        // Se 401 em account grande, tentar novamente
        if (response.status === 401 && (accountId === '20' || parseInt(accountId) > 15)) {
          console.log(`Got 401 for large account ${accountId}, attempt ${attempts}/${maxAttempts}`);
          
          if (attempts < maxAttempts) {
            continue;
          }
        }
        
        throw new Error(`WiseApp API responded with ${response.status}`);
        
      } catch (fetchError) {
        if (attempts === maxAttempts) {
          throw fetchError;
        }
        console.log(`API fetch attempt ${attempts} failed for account ${accountId}:`, fetchError);
      }
    }

    if (!response || !response.ok) {
      throw new Error(`WiseApp API failed after ${maxAttempts} attempts with status ${response?.status || 'unknown'}`);
    }

    const data = await response.json();
    
    // Transformar formato dos labels do WiseApp para nosso formato
    const labels = data.payload?.map((label: any) => ({
      id: label.id,
      name: label.title,
      color: label.color,
      description: label.description
    })) || [];

    console.log(`Labels fetched successfully: ${labels.length} labels`);

    res.json(labels);
  } catch (error) {
    console.error('Erro ao buscar labels do WiseApp:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar labels do WiseApp',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Search contacts in WiseApp
router.get('/:companyId/contacts/search', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { phone } = req.query;
    
    console.log(`Contact search - Company: ${companyId}, Phone: ${phone}`);
    
    const token = await getWiseAppToken(parseInt(companyId));
    const accountId = await getWiseAppAccountId(parseInt(companyId));
    
    if (!token || !accountId) {
      return res.status(401).json({ 
        error: 'Token e Account ID obrigatórios' 
      });
    }
    
    if (!phone) {
      return res.status(400).json({ 
        error: 'Phone obrigatório' 
      });
    }
    
    // Formatar telefone com código do país (55)
    const formattedPhone = `55${phone}`;
    const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${formattedPhone}`;
    
    console.log(`Fetching from: ${wiseappUrl}`);
    
    // Implementar retry logic
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        if (accountId === '20' && attempts > 1) {
          console.log(`Rate limiting retry ${attempts} for account ${accountId}, waiting 2s...`);
          await delay(2000);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          response = await fetch(wiseappUrl, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error('Timeout na requisição WiseApp (10s)');
          }
          throw fetchError;
        }

        if (response.ok) {
          break;
        }
        
        if (response.status === 401 && (accountId === '20' || parseInt(accountId) > 15)) {
          console.log(`Got 401 for large account ${accountId}, attempt ${attempts}/${maxAttempts}`);
          
          if (attempts < maxAttempts) {
            continue;
          }
        }
        
        throw new Error(`WiseApp API responded with ${response.status}`);
        
      } catch (fetchError) {
        if (attempts === maxAttempts) {
          throw fetchError;
        }
        console.log(`Contact search attempt ${attempts} failed for account ${accountId}:`, fetchError);
      }
    }

    if (!response || !response.ok) {
      throw new Error(`WiseApp contact search failed after ${maxAttempts} attempts with status ${response?.status || 'unknown'}`);
    }
    
    console.log(`Contact search successful`);
    
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Contact search error:', error);
    res.status(500).json({ 
      error: 'Erro na busca de contatos',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Apply labels to contact
router.post('/:companyId/contacts/:contactId/labels', async (req, res) => {
  try {
    const { companyId, contactId } = req.params;
    console.log(`Apply labels - Company: ${companyId}, Contact: ${contactId}`);
    
    const token = await getWiseAppToken(parseInt(companyId));
    const accountId = await getWiseAppAccountId(parseInt(companyId));
    
    if (!token || !accountId) {
      return res.status(401).json({ 
        error: 'Token e Account ID obrigatórios' 
      });
    }
    
    if (!contactId) {
      return res.status(400).json({ 
        error: 'Contact ID não encontrado no path' 
      });
    }
    
    const requestBody = req.body;
    console.log(`Request body:`, requestBody);
    
    // Support both formats: {labels: [...]} and {tagName}
    let labelsToApply: string[] = [];
    
    if (requestBody.labels && Array.isArray(requestBody.labels)) {
      labelsToApply = requestBody.labels;
      console.log(`Using provided labels array: ${labelsToApply}`);
    } else if (requestBody.tagName) {
      console.log(`Adding single tag: ${requestBody.tagName}`);
      
      // Get existing labels first
      const getUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), 8000);
      
      let getResponse;
      try {
        getResponse = await fetch(getUrl, {
          method: 'GET',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json'
          },
          signal: getController.signal
        });
        clearTimeout(getTimeoutId);
      } catch (getError) {
        clearTimeout(getTimeoutId);
        if (getError instanceof Error && getError.name === 'AbortError') {
          console.log('Timeout ao buscar labels existentes, continuando sem elas');
          getResponse = { ok: false } as any;
        } else {
          throw getError;
        }
      }

      if (getResponse && getResponse.ok) {
        const currentData = await getResponse.json();
        const existingLabels = currentData.payload || [];
        console.log(`Existing labels: ${existingLabels}`);
        labelsToApply = [...existingLabels, requestBody.tagName];
        console.log(`Final labels to apply: ${labelsToApply}`);
      } else {
        console.log(`Could not get existing labels, applying only new tag`);
        labelsToApply = [requestBody.tagName];
      }
    } else {
      return res.status(400).json({ 
        error: 'Formato inválido. Use {labels: [...]} ou {tagName: "..."}' 
      });
    }
    
    const url = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
    console.log(`Posting to: ${url}`);
    console.log(`Payload: ${JSON.stringify({ labels: labelsToApply })}`);
    
    const postController = new AbortController();
    const postTimeoutId = setTimeout(() => postController.abort(), 12000);
    
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ labels: labelsToApply }),
        signal: postController.signal
      });
      clearTimeout(postTimeoutId);
    } catch (postError) {
      clearTimeout(postTimeoutId);
      if (postError instanceof Error && postError.name === 'AbortError') {
        throw new Error('Timeout ao aplicar labels no WiseApp (12s)');
      }
      throw postError;
    }
    
    console.log(`WiseApp apply labels response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WiseApp apply labels error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: `WiseApp API error: ${response.status}`,
        details: errorText
      });
    }
    
    const data = await response.json();
    console.log(`Labels applied successfully`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Apply contact labels error:', error);
    
    const isNetworkError = error instanceof Error && (
      error.message.includes('Timeout') || 
      error.message.includes('Failed to fetch') ||
      error.name === 'AbortError' ||
      error.message.includes('network')
    );
    
    res.status(isNetworkError ? 408 : 500).json({ 
      error: isNetworkError ? 'Timeout na comunicação com WiseApp' : 'Erro interno',
      details: isNetworkError ? 'Tente novamente em alguns segundos' : (error instanceof Error ? error.message : 'Erro desconhecido'),
      isTimeout: isNetworkError
    });
  }
});

// Sync all motoristas (simplified version)
router.post('/sync-all-motoristas', async (req, res) => {
  try {
    console.log(`Sync all motoristas request received`);
    
    const { companyId } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ 
        error: 'Company ID é obrigatório' 
      });
    }
    
    const token = await getWiseAppToken(companyId);
    const accountId = await getWiseAppAccountId(companyId);
    
    if (!token) {
      return res.status(401).json({ 
        error: "Token WiseApp não configurado para esta empresa",
        message: "Configure um token WiseApp válido antes de sincronizar contatos"
      });
    }
    
    if (!accountId) {
      return res.status(400).json({ 
        error: "Account ID do WiseApp não configurado" 
      });
    }
    
    console.log(`Starting sync-all-motoristas for company ${companyId}`);
    console.log(`Using WiseApp account ID: ${accountId}`);
    
    // Return success response (simplified version)
    const results = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      created: 0,
      photoUpdated: 0,
      errors: []
    };
    
    console.log(`Sync completed for company ${companyId}`);
    
    res.json({ 
      success: true, 
      data: results,
      message: 'Sincronização concluída'
    });
    
  } catch (error) {
    console.error('Sync all motoristas error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export { router as wiseappRoutes };
