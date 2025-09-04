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

// Configure Supabase
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ohmoxsvwjvohmqqgxjhb.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// WiseApp proxy routes for labels
app.get('/wiseapp/:companyId/labels', async (req, res) => {
  try {
    const { companyId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Fetching WiseApp labels for company ${companyId}`);
    console.log("Request headers:", {
      host: req.headers.host,
      'user-agent': req.headers['user-agent'],
      accept: req.headers.accept,
      'accept-encoding': req.headers['accept-encoding'],
      'accept-language': req.headers['accept-language'],
      'content-type': req.headers['content-type'],
      referer: req.headers.referer,
      'sec-fetch-dest': req.headers['sec-fetch-dest'],
      'sec-fetch-mode': req.headers['sec-fetch-mode'],
      'sec-fetch-site': req.headers['sec-fetch-site'],
      'wiseapp-account-id': req.headers['wiseapp-account-id'],
      'wiseapp-token': req.headers['wiseapp-token'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-replit-user-bio': req.headers['x-replit-user-bio'],
      'x-replit-user-id': req.headers['x-replit-user-id'],
      'x-replit-user-name': req.headers['x-replit-user-name'],
      'x-replit-user-profile-image': req.headers['x-replit-user-profile-image'],
      'x-replit-user-roles': req.headers['x-replit-user-roles'],
      'x-replit-user-teams': req.headers['x-replit-user-teams'],
      'x-replit-user-url': req.headers['x-replit-user-url']
    });
    console.log("Token from header:", token ? "Found" : "Missing");
    console.log("Account ID from header:", accountId ? "Found" : "Missing");

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID são obrigatórios" });
    }

    const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
    console.log("Fetching labels from:", wiseappUrl);

    const response = await fetch(wiseappUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`WiseApp API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `Erro na API WiseApp: ${response.status}`,
        details: await response.text()
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Erro ao buscar labels do WiseApp:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

// WiseApp proxy route for contact search
app.get('/wiseapp/:companyId/contacts/search', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { phone } = req.query;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Searching contact by phone ${phone} for company ${companyId}`);

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID são obrigatórios" });
    }

    if (!phone) {
      return res.status(400).json({ error: "Phone é obrigatório" });
    }

    const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;

    const response = await fetch(wiseappUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`WiseApp API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `Erro na API WiseApp: ${response.status}`,
        details: await response.text()
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Erro ao buscar contato no WiseApp:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

// WiseApp proxy route for getting contact labels
app.get('/wiseapp/:companyId/contacts/:contactId/labels', async (req, res) => {
  try {
    const { companyId, contactId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Fetching labels for contact ${contactId} in company ${companyId}`);

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID são obrigatórios" });
    }

    const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;

    const response = await fetch(wiseappUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`WiseApp API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `Erro na API WiseApp: ${response.status}`,
        details: await response.text()
      });
    }

    const data = await response.json();
    console.log(`Labels fetched successfully for contact ${contactId}:`, data);
    res.json(data);
  } catch (error) {
    console.error("Erro ao buscar labels do contato no WiseApp:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

// WiseApp proxy route for applying contact labels
app.post('/wiseapp/:companyId/contacts/:contactId/labels', async (req, res) => {
  try {
    const { companyId, contactId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    console.log(`Applying labels to contact ${contactId} for company ${companyId}`);
    console.log("Request body:", req.body);

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID são obrigatórios" });
    }

    // Support both formats: {labels: [...]} and {tagId, tagName}
    let labelsToApply = [];
    
    if (req.body.labels && Array.isArray(req.body.labels)) {
      // New format with complete labels array
      labelsToApply = req.body.labels;
      console.log("Using complete labels array:", labelsToApply.join(', '));
    } else if (req.body.tagName) {
      // Legacy format - get existing labels first, then add new one
      console.log("Adding single tag \"" + req.body.tagName + "\" without overwriting");
      
      // Get current labels
      const currentLabelsResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (currentLabelsResponse.ok) {
        const currentLabelsData = await currentLabelsResponse.json();
        const existingLabels = currentLabelsData.payload || [];
        console.log(`Found ${existingLabels.length} existing labels`);
        
        // Add new label to existing ones
        labelsToApply = [...existingLabels, req.body.tagName];
        console.log(`Added "${req.body.tagName}" to labels list`);
      } else {
        // If can't get current labels, just apply the new one
        labelsToApply = [req.body.tagName];
      }
    }

    console.log(`Applying ${labelsToApply.length} labels:`, labelsToApply.join(', '));

    const payload = { labels: labelsToApply };
    console.log("PAYLOAD BEING SENT:", JSON.stringify(payload));

    const wiseappUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
    console.log("URL:", wiseappUrl);
    console.log("TOKEN:", token ? "Present" : "Missing");
    console.log("ACCOUNT ID:", accountId);

    const response = await fetch(wiseappUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log("CHATWOOT RESPONSE STATUS:", response.status);
    const responseText = await response.text();
    console.log("CHATWOOT RESPONSE BODY:", responseText);

    if (!response.ok) {
      console.error(`WiseApp API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `Erro na API WiseApp: ${response.status}`,
        details: responseText
      });
    }

    const data = JSON.parse(responseText);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao aplicar labels no contato do WiseApp:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

// Tags API routes
app.get("/tags", async (req, res) => {
  try {
    const companyId = req.query.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "company_id é obrigatório" });
    }

    const { data: tags, error } = await supabase
      .from('tag')
      .select('*')
      .eq('company_id', companyId)
      .order('nome');
    
    if (error) {
      console.error('Erro ao buscar tags do Supabase:', error);
      throw error;
    }
    res.json(tags);
  } catch (error) {
    console.error("Erro ao buscar tags:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : "Erro desconhecido",
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
    
    const { data: associations, error } = await supabase
      .from('associacao_tags')
      .select(`
        tag:tag_id (
          id,
          nome,
          cor,
          company_id,
          limite_max,
          created_at,
          updated_at
        )
      `)
      .eq('motorista_id', motoristaId);
    
    if (error) throw error;
    
    const tags = associations?.map(assoc => assoc.tag).filter(Boolean) || [];
    res.json(tags);
  } catch (error) {
    console.error('Motorista tags endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Add tag to motorista endpoint
app.post('/motoristas/:id/tags', async (req, res) => {
  try {
    const motoristaId = parseInt(req.params.id);
    const { tag_id } = req.body;
    
    if (!motoristaId) {
      return res.status(400).json({ error: 'ID do motorista é obrigatório' });
    }
    
    if (!tag_id) {
      return res.status(400).json({ error: 'tag_id é obrigatório' });
    }
    
    // Verificar se a associação já existe
    const { data: existingAssociation } = await supabase
      .from('associacao_tags')
      .select('id')
      .eq('motorista_id', motoristaId)
      .eq('tag_id', tag_id)
      .single();
    
    if (existingAssociation) {
      return res.status(409).json({ error: 'Tag já está associada a este motorista' });
    }
    
    // Criar a associação
    const { data, error } = await supabase
      .from('associacao_tags')
      .insert({
        motorista_id: motoristaId,
        tag_id: tag_id
      })
      .select();
    
    if (error) throw error;
    
    res.json(data[0]);
  } catch (error) {
    console.error('Add tag to motorista endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Remove tag from motorista endpoint
app.delete('/motoristas/:id/tags/:tagId', async (req, res) => {
  try {
    const motoristaId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);
    
    if (!motoristaId || !tagId) {
      return res.status(400).json({ error: 'IDs são obrigatórios' });
    }
    
    const { error } = await supabase
      .from('associacao_tags')
      .delete()
      .eq('motorista_id', motoristaId)
      .eq('tag_id', tagId);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Remove tag from motorista endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Bulk motorista tags endpoint
app.post('/motoristas/bulk-tags', async (req, res) => {
  try {
    console.log('Bulk tags endpoint called with body:', req.body);
    const { motorista_ids, company_id } = req.body;
    
    if (!motorista_ids || !Array.isArray(motorista_ids) || motorista_ids.length === 0) {
      console.log('Error: motorista_ids is required and must be an array');
      return res.status(400).json({ error: 'motorista_ids é obrigatório e deve ser um array' });
    }
    
    if (!company_id) {
      console.log('Error: company_id is required');
      return res.status(400).json({ error: 'company_id é obrigatório' });
    }
    
    // Buscar todas as tags para os motoristas especificados
    const { data: associations, error } = await supabase
      .from('associacao_tags')
      .select(`
        motorista_id,
        tag:tag_id (
          id,
          nome,
          cor,
          company_id,
          limite_max,
          created_at,
          updated_at
        )
      `)
      .in('motorista_id', motorista_ids);
    
    if (error) throw error;
    
    // Agrupar tags por motorista
    const tagsByMotorista = {};
    associations?.forEach(item => {
      if (item.tag) {
        if (!tagsByMotorista[item.motorista_id]) {
          tagsByMotorista[item.motorista_id] = [];
        }
        tagsByMotorista[item.motorista_id].push(item.tag);
      }
    });
    
    res.json(tagsByMotorista);
  } catch (error) {
    console.error('Bulk motorista tags endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Tag limit check endpoint
app.get('/tags/:id/limit-check', async (req, res) => {
  try {
    const tagId = parseInt(req.params.id);
    
    if (!tagId) {
      return res.status(400).json({ error: 'ID da tag é obrigatório' });
    }
    
    // Buscar informações da tag
    const { data: tagData, error: tagError } = await supabase
      .from('tag')
      .select('limite_max')
      .eq('id', tagId)
      .single();
    
    if (tagError || !tagData) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }
    
    const limit = tagData.limite_max;
    if (!limit) {
      return res.json({ canAdd: true, currentCount: 0, limit: null });
    }
    
    // Contar associados atuais da tag
    const { count, error: countError } = await supabase
      .from('associacao_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', tagId);
    
    if (countError) throw countError;
    
    const currentCount = count || 0;
    const canAdd = currentCount < limit;
    
    res.json({ canAdd, currentCount, limit });
  } catch (error) {
    console.error('Tag limit check endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
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