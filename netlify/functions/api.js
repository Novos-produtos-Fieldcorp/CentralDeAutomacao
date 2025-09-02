const express = require('express');
const serverless = require('serverless-http');

// Import environment setup
require('dotenv').config();

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

// Import and register routes dynamically
let registerRoutes;
try {
  registerRoutes = require('../../dist/routes').registerRoutes;
  registerRoutes(app);
} catch (error) {
  // Fallback - manually define critical routes
  console.error('Could not load routes from dist, using fallback');
  
  // Health check
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
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
      
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
  
  // Proxy to WiseApp API for inboxes
  app.get('/v1/accounts/:accountId/inboxes', async (req, res) => {
    try {
      const { accountId } = req.params;
      const token = req.headers.api_access_token || req.headers['wiseapp-token'];
      
      if (!token) {
        return res.status(401).json({ error: 'API token required' });
      }
      
      const axios = require('axios');
      const response = await axios.get(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/inboxes`, {
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        }
      });
      
      res.json(response.data);
    } catch (error) {
      console.error('WiseApp proxy error:', error.message);
      res.status(error.response?.status || 500).json({ 
        error: 'Failed to fetch inboxes',
        details: error.message 
      });
    }
  });
}

// Export handler for Netlify Functions  
exports.handler = serverless(app);