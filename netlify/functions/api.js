const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require("@supabase/supabase-js");

// Create Express app
const app = express();

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization', 
    'api_access_token',
    'wiseapp-token',
    'wiseapp-account-id',
    'X-Requested-With',
    'Accept',
    'Origin'
  ].join(', '));
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  next();
});

// Debug middleware
app.use((req, res, next) => {
  console.log(`[NETLIFY DEBUG] Method: ${req.method}`);
  console.log(`[NETLIFY DEBUG] URL: ${req.url}`);
  console.log(`[NETLIFY DEBUG] Path: ${req.path}`);
  console.log(`[NETLIFY DEBUG] Query:`, req.query);
  console.log(`[NETLIFY DEBUG] Headers:`, {
    'wiseapp-token': req.headers['wiseapp-token'] ? 'Present' : 'Missing',
    'wiseapp-account-id': req.headers['wiseapp-account-id'] ? 'Present' : 'Missing'
  });
  next();
});

// Configure Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ohmoxsvwjvohmqqgxjhb.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  console.log('[NETLIFY] Health endpoint accessed');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    platform: 'netlify',
    version: '3.0'
  });
});

// ========== WISEAPP PROXY ROUTES ==========

// Get WiseApp labels
app.get('/wiseapp/:companyId/labels', async (req, res) => {
  console.log('[NETLIFY] WiseApp labels route accessed');
  try {
    const { companyId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Company: ${companyId}, Token: ${token ? 'Present' : 'Missing'}, AccountId: ${accountId}`);

    if (!token || !accountId) {
      return res.status(401).json({ 
        error: "Token e Account ID obrigatórios",
        received: { token: !!token, accountId: !!accountId }
      });
    }

    const url = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
    console.log(`Fetching from: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`WiseApp response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WiseApp error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: `WiseApp API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log(`Labels fetched successfully, count: ${data?.length || 'unknown'}`);
    res.json(data);
  } catch (error) {
    console.error("Labels error:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor",
      details: error.message
    });
  }
});

// Search WiseApp contacts
app.get('/wiseapp/:companyId/contacts/search', async (req, res) => {
  console.log('[NETLIFY] WiseApp contact search route accessed');
  try {
    const { companyId } = req.params;
    const { phone } = req.query;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Searching contact - Company: ${companyId}, Phone: ${phone}`);

    if (!token || !accountId) {
      return res.status(401).json({ 
        error: "Token e Account ID obrigatórios",
        received: { token: !!token, accountId: !!accountId }
      });
    }

    if (!phone) {
      return res.status(400).json({ error: "Parâmetro 'phone' obrigatório" });
    }

    const url = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;
    console.log(`Searching at: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`WiseApp search response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WiseApp search error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: `WiseApp API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log(`Contact search successful, results: ${data?.length || 'unknown'}`);
    res.json(data);
  } catch (error) {
    console.error("Contact search error:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor",
      details: error.message
    });
  }
});

// Get contact labels
app.get('/wiseapp/:companyId/contacts/:contactId/labels', async (req, res) => {
  console.log('[NETLIFY] Get contact labels route accessed');
  try {
    const { companyId, contactId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Getting labels for contact ${contactId} in company ${companyId}`);

    if (!token || !accountId) {
      return res.status(401).json({ 
        error: "Token e Account ID obrigatórios",
        received: { token: !!token, accountId: !!accountId }
      });
    }

    const url = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
    console.log(`Fetching from: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`WiseApp get labels response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WiseApp get labels error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: `WiseApp API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log(`Contact labels fetched successfully`);
    res.json(data);
  } catch (error) {
    console.error("Get contact labels error:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor",
      details: error.message
    });
  }
});

// Apply labels to contact
app.post('/wiseapp/:companyId/contacts/:contactId/labels', async (req, res) => {
  console.log('[NETLIFY] Apply contact labels route accessed');
  try {
    const { companyId, contactId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Applying labels to contact ${contactId} in company ${companyId}`);
    console.log(`Request body:`, req.body);

    if (!token || !accountId) {
      return res.status(401).json({ 
        error: "Token e Account ID obrigatórios",
        received: { token: !!token, accountId: !!accountId }
      });
    }

    // Support both formats: {labels: [...]} and {tagName}
    let labelsToApply = [];
    
    if (req.body.labels && Array.isArray(req.body.labels)) {
      labelsToApply = req.body.labels;
      console.log(`Using provided labels array: ${labelsToApply}`);
    } else if (req.body.tagName) {
      console.log(`Adding single tag: ${req.body.tagName}`);
      
      // Get existing labels first
      const getUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
      const getResponse = await fetch(getUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (getResponse.ok) {
        const currentData = await getResponse.json();
        const existingLabels = currentData.payload || [];
        console.log(`Existing labels: ${existingLabels}`);
        labelsToApply = [...existingLabels, req.body.tagName];
        console.log(`Final labels to apply: ${labelsToApply}`);
      } else {
        console.log(`Could not get existing labels, applying only new tag`);
        labelsToApply = [req.body.tagName];
      }
    } else {
      return res.status(400).json({ 
        error: "Formato inválido. Use {labels: [...]} ou {tagName: '...'}" 
      });
    }

    const url = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
    console.log(`Posting to: ${url}`);
    console.log(`Payload: ${JSON.stringify({ labels: labelsToApply })}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ labels: labelsToApply })
    });

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
    console.error("Apply contact labels error:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor",
      details: error.message
    });
  }
});

// ========== LOCAL DATABASE ROUTES ==========

app.get("/tags", async (req, res) => {
  console.log('[NETLIFY] Local tags route accessed');
  try {
    const companyId = req.query.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "company_id obrigatório" });
    }

    const { data: tags, error } = await supabase
      .from('tag')
      .select('*')
      .eq('company_id', companyId)
      .order('nome');
    
    if (error) throw error;
    console.log(`Local tags fetched: ${tags?.length || 0} tags`);
    res.json(tags);
  } catch (error) {
    console.error("Local tags error:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor",
      details: error.message
    });
  }
});

// ========== CATCH-ALL ==========

app.use('*', (req, res) => {
  console.log(`[NETLIFY] UNMATCHED ROUTE: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method,
    available_routes: [
      'GET /health',
      'GET /wiseapp/:companyId/labels',
      'GET /wiseapp/:companyId/contacts/search',
      'GET /wiseapp/:companyId/contacts/:contactId/labels',
      'POST /wiseapp/:companyId/contacts/:contactId/labels',
      'GET /tags'
    ]
  });
});

// Export the serverless handler
module.exports.handler = serverless(app);