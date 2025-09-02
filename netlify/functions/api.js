const express = require('express');
const serverless = require('serverless-http');

// Create app instance
const app = express();
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Tags endpoint - connect to Supabase
app.get('/tags', async (req, res) => {
  try {
    const { company_id } = req.query;
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }
    
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: tags, error } = await supabase
      .from('tag')
      .select('id, nome, cor, company_id')
      .eq('company_id', company_id);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch tags from database' });
    }
    
    res.json(tags || []);
  } catch (error) {
    console.error('Tags endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Rota para buscar labels/tags do WiseApp
app.get('/wiseapp/:companyId/labels', async (req, res) => {
  try {
    const { companyId } = req.params;
    const token = req.headers['wiseapp-token'] || req.headers.api_access_token;
    const accountId = req.headers['wiseapp-account-id'];
    
    if (!token) {
      return res.status(401).json({ error: 'WiseApp token required' });
    }
    
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID required' });
    }
    
    const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`, {
      method: 'GET',
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('WiseApp labels error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch labels',
      details: error.message 
    });
  }
});

// Rotas para motorista tags
app.get('/motoristas/:motoristaId/tags', async (req, res) => {
  try {
    const { motoristaId } = req.params;
    
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('motorista_tag')
      .select('tag_id, tag(id, nome, cor)')
      .eq('motorista_id', motoristaId);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch motorista tags' });
    }
    
    const tags = (data || []).map(item => item.tag).filter(Boolean);
    res.json(tags);
  } catch (error) {
    console.error('Motorista tags error:', error);
    res.status(500).json({ error: 'Failed to fetch motorista tags' });
  }
});

app.post('/motoristas/:motoristaId/tags', async (req, res) => {
  try {
    const { motoristaId } = req.params;
    const { tag_id } = req.body;
    
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase
      .from('motorista_tag')
      .insert({ motorista_id: motoristaId, tag_id });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to add tag to motorista' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Add motorista tag error:', error);
    res.status(500).json({ error: 'Failed to add tag to motorista' });
  }
});

app.delete('/motoristas/:motoristaId/tags/:tagId', async (req, res) => {
  try {
    const { motoristaId, tagId } = req.params;
    
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase
      .from('motorista_tag')
      .delete()
      .eq('motorista_id', motoristaId)
      .eq('tag_id', tagId);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to remove tag from motorista' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Remove motorista tag error:', error);
    res.status(500).json({ error: 'Failed to remove tag from motorista' });
  }
});

// Proxy to WiseApp API for inboxes
app.get('/v1/accounts/:accountId/inboxes', async (req, res) => {
  try {
    const { accountId } = req.params;
    const token = req.headers.api_access_token || req.headers['wiseapp-token'];
    
    if (!token) {
      return res.status(401).json({ error: 'API token required' });
    }
    
    // Use native fetch instead of axios to reduce dependencies
    const response = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/inboxes`, {
      method: 'GET',
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('WiseApp proxy error:', error.message);
    const statusCode = error.status || (error.message.includes('HTTP') ? parseInt(error.message.split(' ')[1]) : 500);
    res.status(statusCode).json({ 
      error: 'Failed to fetch inboxes',
      details: error.message 
    });
  }
});

// Catch-all for unmatched API routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Export handler for Netlify Functions  
exports.handler = serverless(app);