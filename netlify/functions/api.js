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

// Tags endpoint - connect to PostgreSQL
app.get('/tags', async (req, res) => {
  try {
    const { company_id } = req.query;
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id é obrigatório' });
    }
    
    // Import PostgreSQL client
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    
    const tags = await sql`
      SELECT id, nome, cor, company_id, limite_max, created_at, updated_at
      FROM tag
      WHERE company_id = ${company_id}
      ORDER BY nome
    `;
    
    res.json(tags || []);
  } catch (error) {
    console.error('Tags endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Motorista tags endpoint
app.get('/motoristas/:id/tags', async (req, res) => {
  try {
    const motoristaId = parseInt(req.params.id);
    
    if (!motoristaId) {
      return res.status(400).json({ error: 'ID do motorista é obrigatório' });
    }
    
    // Import PostgreSQL client
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    
    const tags = await sql`
      SELECT t.id, t.nome, t.cor, t.company_id, t.limite_max, t.created_at, t.updated_at
      FROM associacao_tags mt
      INNER JOIN tag t ON mt.tag_id = t.id
      WHERE mt.motorista_id = ${motoristaId}
      ORDER BY t.nome
    `;
    
    res.json(tags || []);
  } catch (error) {
    console.error('Motorista tags endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
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