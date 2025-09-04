const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require("@supabase/supabase-js");

// Create app instance
const app = express();

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure CORS for Netlify
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

// Debug logging
app.use((req, res, next) => {
  console.log(`[NETLIFY] ${req.method} ${req.path}`);
  console.log(`[NETLIFY] Query:`, req.query);
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
  console.log('[NETLIFY] Health check accessed');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    netlify: true,
    version: '2.0'
  });
});

// ========== WISEAPP ROUTES ==========

// Get labels from WiseApp
app.get('/wiseapp/:companyId/labels', async (req, res) => {
  console.log('[NETLIFY] Labels route accessed');
  try {
    const { companyId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID obrigatórios" });
    }

    const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`WiseApp API error: ${response.status}`);
      return res.status(response.status).json({ error: `WiseApp API error: ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Labels error:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Search contacts in WiseApp
app.get('/wiseapp/:companyId/contacts/search', async (req, res) => {
  console.log('[NETLIFY] Contact search route accessed');
  try {
    const { companyId } = req.params;
    const { phone } = req.query;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Searching contact by phone ${phone}`);

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID obrigatórios" });
    }

    if (!phone) {
      return res.status(400).json({ error: "Phone obrigatório" });
    }

    const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`WiseApp API error: ${response.status}`);
      return res.status(response.status).json({ error: `WiseApp API error: ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Contact search error:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Get contact labels
app.get('/wiseapp/:companyId/contacts/:contactId/labels', async (req, res) => {
  console.log('[NETLIFY] Get contact labels route accessed');
  try {
    const { companyId, contactId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID obrigatórios" });
    }

    const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`WiseApp API error: ${response.status}`);
      return res.status(response.status).json({ error: `WiseApp API error: ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Get contact labels error:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Apply labels to contact
app.post('/wiseapp/:companyId/contacts/:contactId/labels', async (req, res) => {
  console.log('[NETLIFY] Apply contact labels route accessed');
  try {
    const { companyId, contactId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID obrigatórios" });
    }

    // Support both formats: {labels: [...]} and {tagId, tagName}
    let labelsToApply = [];
    
    if (req.body.labels && Array.isArray(req.body.labels)) {
      labelsToApply = req.body.labels;
    } else if (req.body.tagName) {
      // Get existing labels first
      const getResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (getResponse.ok) {
        const currentData = await getResponse.json();
        const existingLabels = currentData.payload || [];
        labelsToApply = [...existingLabels, req.body.tagName];
      } else {
        labelsToApply = [req.body.tagName];
      }
    }

    const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ labels: labelsToApply })
    });

    if (!response.ok) {
      console.error(`WiseApp API error: ${response.status}`);
      return res.status(response.status).json({ error: `WiseApp API error: ${response.status}` });
    }

    const data = await response.json();
    res.json({ success: true });
  } catch (error) {
    console.error("Apply contact labels error:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ========== LOCAL TAGS ROUTES ==========

app.get("/tags", async (req, res) => {
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
    res.json(tags);
  } catch (error) {
    console.error("Tags error:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ========== FALLBACK ROUTES ==========

// Catch-all with detailed logging
app.use('*', (req, res) => {
  console.log(`[NETLIFY] UNMATCHED ROUTE: ${req.method} ${req.originalUrl}`);
  console.log(`[NETLIFY] Available routes:`);
  console.log(`- GET /health`);
  console.log(`- GET /wiseapp/:companyId/labels`);
  console.log(`- GET /wiseapp/:companyId/contacts/search`);
  console.log(`- GET /wiseapp/:companyId/contacts/:contactId/labels`);
  console.log(`- POST /wiseapp/:companyId/contacts/:contactId/labels`);
  console.log(`- GET /tags`);
  
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

// Export handler for Netlify Functions  
module.exports.handler = serverless(app);