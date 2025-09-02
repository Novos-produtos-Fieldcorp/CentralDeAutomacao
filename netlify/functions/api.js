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

const app = express();

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