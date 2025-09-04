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

// Create tag endpoint
app.post('/tags', async (req, res) => {
  try {
    const { nome, cor, limite_max, company_id } = req.body;
    
    if (!nome || !company_id) {
      return res.status(400).json({ error: 'nome e company_id são obrigatórios' });
    }
    
    const { data, error } = await supabase
      .from('tag')
      .insert({
        nome,
        cor: cor || '#3B82F6',
        limite_max: limite_max || null,
        company_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (error) throw error;
    
    res.json(data[0]);
  } catch (error) {
    console.error('Create tag endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Update tag endpoint
app.put('/tags/:id', async (req, res) => {
  try {
    const tagId = parseInt(req.params.id);
    const updates = req.body;
    
    if (!tagId) {
      return res.status(400).json({ error: 'ID da tag é obrigatório' });
    }
    
    const { data, error } = await supabase
      .from('tag')
      .update({
        nome: updates.nome,
        cor: updates.cor,
        limite_max: updates.limite_max,
        updated_at: new Date().toISOString()
      })
      .eq('id', tagId)
      .select();
    
    if (error) throw error;
    
    res.json(data[0]);
  } catch (error) {
    console.error('Update tag endpoint error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Delete tag endpoint
app.delete('/tags/:id', async (req, res) => {
  try {
    const tagId = parseInt(req.params.id);
    
    if (!tagId) {
      return res.status(400).json({ error: 'ID da tag é obrigatório' });
    }
    
    // Primeiro remover todas as associações
    const { error: deleteAssociationsError } = await supabase
      .from('associacao_tags')
      .delete()
      .eq('tag_id', tagId);
    
    if (deleteAssociationsError) throw deleteAssociationsError;
    
    // Depois deletar a tag
    const { error: deleteTagError } = await supabase
      .from('tag')
      .delete()
      .eq('id', tagId);
    
    if (deleteTagError) throw deleteTagError;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete tag endpoint error:', error);
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

// Bulk motorista tags endpoint
app.post('/motoristas/bulk-tags', async (req, res) => {
  try {
    const { motorista_ids, company_id } = req.body;
    
    if (!motorista_ids || !Array.isArray(motorista_ids) || motorista_ids.length === 0) {
      return res.status(400).json({ error: 'motorista_ids é obrigatório e deve ser um array' });
    }
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id é obrigatório' });
    }
    
    // Buscar todas as tags para os motoristas especificados
    const { data: tags, error } = await supabase
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
    tags.forEach(item => {
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
    
    // Import PostgreSQL client
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    
    // Buscar informações da tag
    const tagData = await sql`
      SELECT limite_max
      FROM tag
      WHERE id = ${tagId}
    `;
    
    if (!tagData || tagData.length === 0) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }
    
    const limit = tagData[0].limite_max;
    if (!limit) {
      return res.json({ canAdd: true, currentCount: 0, limit: null });
    }
    
    // Contar associados atuais da tag
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM associacao_tags
      WHERE tag_id = ${tagId}
    `;
    
    const currentCount = parseInt(countResult[0].count) || 0;
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

import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import { createClient } from "@supabase/supabase-js";

// Configure Supabase
const supabaseUrl = "https://sngzctgbomqmpdcwjltt.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZ3pjdGdib21xbXBkY3dqbHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1Mjk2NDQsImV4cCI6MjA1MDEwNTY0NH0.xLzxQEGMvJH3FhfR-I0uOOxNI5ktEOINHRQUoDbVLMg";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'api_access_token', 'Cache-Control', 'Pragma', 'Expires', 'wiseapp-token', 'wiseapp-account-id'],
  credentials: false
}));

app.use(express.json());

// Tags API routes
app.get("/tags", async (req, res) => {
  try {
    const companyId = req.query.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "company_id é obrigatório" });
    }

    // Buscar tags diretamente do Supabase
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

// WiseApp proxy routes
app.get("/wiseapp/:companyId/labels", async (req, res) => {
  try {
    const { companyId } = req.params;
    const token = req.headers['wiseapp-token'];
    const accountId = req.headers['wiseapp-account-id'];

    if (!token || !accountId) {
      return res.status(401).json({ error: "Token e Account ID são obrigatórios" });
    }

    console.log(`Fetching WiseApp labels for company ${companyId}`);
    console.log("Token from header:", token ? "Found" : "Missing");
    console.log("Account ID from header:", accountId ? "Found" : "Missing");

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

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

export const handler = serverless(app);