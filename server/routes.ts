import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertMotoristaSchema, 
  insertVeiculoSchema, 
  insertClienteSchema,
  insertTagSchema,
  insertVagaSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with bypass RLS for backend operations
const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://ohmoxsvwjvohmqqgxjhb.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  db: { schema: 'public' }
});

// Helper function to extract company ID from request
function getCompanyId(req: Request): number {
  const companyId = parseInt(req.headers['company-id'] as string || req.query.company_id as string || '1');
  if (isNaN(companyId)) {
    throw new Error('Valid company_id is required');
  }
  return companyId;
}

// Helper function to get company ID from account ID
async function getCompanyIdFromAccount(
  accountId: string,
): Promise<number | null> {
  try {
    const { data: companies, error } = await supabase
      .from("company")
      .select("company_id")
      .eq("id_conta_wiseapp", accountId)
      .limit(1);

    if (error) {
      console.error("Error fetching company:", error);
      return null;
    }

    if (!companies || companies.length === 0) {
      return null;
    }

    return companies[0].company_id;
  } catch (error) {
    console.error("Error in getCompanyIdFromAccount:", error);
    return null;
  }
}

// Error handler wrapper
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Company routes
  app.get("/api/company/by-account/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log(`Fetching company for account_id: ${accountId}`);

      const { data: companies, error } = await supabase
        .from("company")
        .select("*")
        .eq("id_conta_wiseapp", accountId)
        .limit(1);

      if (error) {
        console.error("Error fetching company:", error);
        return res.status(500).json({ error: "Database error" });
      }

      if (!companies || companies.length === 0) {
        return res.status(404).json({ error: "Company not found" });
      }

      const company = companies[0];
      console.log("Found company:", company);
      res.json(company);
    } catch (error) {
      console.error("Error in /api/company/by-account:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ChatWoot inboxes route
  app.get("/api/chatwoot/inboxes/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { account_id } = req.query;
      
      console.log(`Fetching inboxes for company_id: ${companyId}, account_id: ${account_id}`);

      // Buscar token WiseApp para esta empresa
      const token = await storage.getWiseappToken(parseInt(companyId));
      
      if (!token) {
        return res.status(404).json({ 
          error: "Token WiseApp não configurado para esta empresa" 
        });
      }

      // Buscar dados da empresa para validar account_id
      const { data: companies, error: companyError } = await supabase
        .from("company")
        .select("id_conta_wiseapp")
        .eq("company_id", parseInt(companyId))
        .eq("id_conta_wiseapp", account_id)
        .limit(1);

      if (companyError || !companies || companies.length === 0) {
        return res.status(403).json({ 
          error: "Account ID não corresponde à empresa especificada" 
        });
      }

      // Fazer requisição para o ChatWoot
      const wiseappApiUrl = process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";
      const targetUrl = `${wiseappApiUrl}/api/v1/accounts/${account_id}/inboxes`;

      console.log(`Making request to ChatWoot: ${targetUrl}`);

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ 
            error: "Token de autenticação inválido ou expirado" 
          });
        } else if (response.status === 403) {
          return res.status(403).json({ 
            error: "Acesso negado. Verifique as permissões da conta" 
          });
        } else if (response.status === 404) {
          return res.status(404).json({ 
            error: "Conta não encontrada no ChatWoot" 
          });
        }
        
        throw new Error(`ChatWoot API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Adicionar metadados para cache
      const responseData = {
        ...data,
        _cache_metadata: {
          company_id: parseInt(companyId),
          account_id: account_id,
          timestamp: Date.now(),
          expires_at: Date.now() + (60 * 60 * 1000) // 1 hora
        }
      };

      res.json(responseData);
    } catch (error) {
      console.error("Error fetching inboxes:", error);
      res.status(500).json({
        error: "Erro interno do servidor ao buscar caixas de entrada",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Motorista routes
  app.get('/api/motoristas', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const motoristas = await storage.getMotoristas(companyId);
    res.json(motoristas);
  }));

  app.get('/api/motoristas/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const motoristas = await storage.getMotoristas(companyId);
    const motorista = motoristas.find(m => m.motorista_id === id);
    if (!motorista) {
      return res.status(404).json({ error: 'Motorista not found' });
    }
    res.json(motorista);
  }));

  app.post('/api/motoristas', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertMotoristaSchema.parse(req.body);
      const motorista = await storage.createMotorista({ ...validatedData, company_id: companyId });
      res.status(201).json(motorista);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.put('/api/motoristas/:id', asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = getCompanyId(req);
      const validatedData = insertMotoristaSchema.parse(req.body);
      const motorista = await storage.updateMotorista(id, { ...validatedData, company_id: companyId });
      res.json(motorista);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.put('/api/motoristas/:id/whatsapp-photo', asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { foto_whatsapp } = req.body;
      
      if (!foto_whatsapp) {
        return res.status(400).json({ error: 'foto_whatsapp is required' });
      }

      const result = await storage.updateMotoristaWhatsAppPhoto(id, foto_whatsapp);
      res.json(result);
    } catch (error) {
      console.error('Error updating WhatsApp photo:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }));

  // Tags routes
  app.get('/api/tags', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const tags = await storage.getTags(companyId);
    res.json(tags);
  }));

  app.post('/api/tags', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag({ ...validatedData, company_id: companyId });
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.get('/api/motoristas/:id/tags', asyncHandler(async (req: Request, res: Response) => {
    const motoristaId = parseInt(req.params.id);
    const tags = await storage.getMotoristaTagsWithDetails(motoristaId);
    res.json(tags);
  }));

  app.post('/api/motoristas/:motoristaId/tags/:tagId', asyncHandler(async (req: Request, res: Response) => {
    const motoristaId = parseInt(req.params.motoristaId);
    const tagId = parseInt(req.params.tagId);
    const companyId = getCompanyId(req);
    
    const tag = await storage.addTagToMotorista(motoristaId, tagId, companyId);
    res.status(201).json(tag);
  }));

  app.delete('/api/motoristas/:motoristaId/tags/:tagId', asyncHandler(async (req: Request, res: Response) => {
    const motoristaId = parseInt(req.params.motoristaId);
    const tagId = parseInt(req.params.tagId);
    
    const success = await storage.removeTagFromMotorista(motoristaId, tagId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Tag assignment not found' });
    }
  }));

  // Vehicle routes
  app.get('/api/veiculos', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const veiculos = await storage.getVeiculos(companyId);
    res.json(veiculos);
  }));

  app.post('/api/veiculos', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertVeiculoSchema.parse(req.body);
      const veiculo = await storage.createVeiculo({ ...validatedData, company_id: companyId });
      res.status(201).json(veiculo);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  // Client routes
  app.get('/api/clientes', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const clientes = await storage.getClientes(companyId);
    res.json(clientes);
  }));

  app.post('/api/clientes', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertClienteSchema.parse(req.body);
      const cliente = await storage.createCliente({ ...validatedData, company_id: companyId });
      res.status(201).json(cliente);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  // Job vacancy routes
  app.get('/api/vagas', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const vagas = await storage.getVagas(companyId);
    res.json(vagas);
  }));

  app.post('/api/vagas', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertVagaSchema.parse(req.body);
      const vaga = await storage.createVaga({ ...validatedData, company_id: companyId });
      res.status(201).json(vaga);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  const httpServer = createServer(app);
  return httpServer;
}