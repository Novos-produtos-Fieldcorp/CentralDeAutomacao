import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertMotoristaSchema, 
  insertVeiculoSchema, 
  insertClienteSchema, 
  insertHodometroSchema,
  insertChecklistSchema,
  insertGrupoResumoSchema,
  insertCompanySchema
} from "@shared/schema";
import { ZodError } from "zod";

// Helper function to extract company ID from request
function getCompanyId(req: Request): number {
  const companyId = parseInt(req.headers['company-id'] as string || req.query.company_id as string || '1');
  if (isNaN(companyId)) {
    throw new Error('Valid company_id is required');
  }
  return companyId;
}

// Error handler wrapper
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Company routes
  app.get('/api/companies', asyncHandler(async (req: Request, res: Response) => {
    const companies = await storage.getCompanies();
    res.json(companies);
  }));

  app.get('/api/companies/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const company = await storage.getCompany(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  }));

  app.post('/api/companies', asyncHandler(async (req: Request, res: Response) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  // Motorista routes
  app.get('/api/motoristas', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const motoristas = await storage.getMotoristas(companyId);
    res.json(motoristas);
  }));

  app.get('/api/motoristas/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const motorista = await storage.getMotorista(id, companyId);
    if (!motorista) {
      return res.status(404).json({ error: 'Motorista not found' });
    }
    res.json(motorista);
  }));

  app.post('/api/motoristas', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertMotoristaSchema.parse({ ...req.body, company_id: companyId });
      const motorista = await storage.createMotorista(validatedData);
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
      const validatedData = insertMotoristaSchema.partial().parse(req.body);
      const motorista = await storage.updateMotorista(id, validatedData, companyId);
      if (!motorista) {
        return res.status(404).json({ error: 'Motorista not found' });
      }
      res.json(motorista);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.delete('/api/motoristas/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const deleted = await storage.deleteMotorista(id, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Motorista not found' });
    }
    res.status(204).send();
  }));

  // Veiculo routes
  app.get('/api/veiculos', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const veiculos = await storage.getVeiculos(companyId);
    res.json(veiculos);
  }));

  app.get('/api/veiculos/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const veiculo = await storage.getVeiculo(id, companyId);
    if (!veiculo) {
      return res.status(404).json({ error: 'Veiculo not found' });
    }
    res.json(veiculo);
  }));

  app.post('/api/veiculos', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertVeiculoSchema.parse({ ...req.body, company_id: companyId });
      const veiculo = await storage.createVeiculo(validatedData);
      res.status(201).json(veiculo);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.put('/api/veiculos/:id', asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = getCompanyId(req);
      const validatedData = insertVeiculoSchema.partial().parse(req.body);
      const veiculo = await storage.updateVeiculo(id, validatedData, companyId);
      if (!veiculo) {
        return res.status(404).json({ error: 'Veiculo not found' });
      }
      res.json(veiculo);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.delete('/api/veiculos/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const deleted = await storage.deleteVeiculo(id, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Veiculo not found' });
    }
    res.status(204).send();
  }));

  // Cliente routes
  app.get('/api/clientes', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const clientes = await storage.getClientes(companyId);
    res.json(clientes);
  }));

  app.get('/api/clientes/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const cliente = await storage.getCliente(id, companyId);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }
    res.json(cliente);
  }));

  app.post('/api/clientes', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertClienteSchema.parse({ ...req.body, company_id: companyId });
      const cliente = await storage.createCliente(validatedData);
      res.status(201).json(cliente);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.put('/api/clientes/:id', asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = getCompanyId(req);
      const validatedData = insertClienteSchema.partial().parse(req.body);
      const cliente = await storage.updateCliente(id, validatedData, companyId);
      if (!cliente) {
        return res.status(404).json({ error: 'Cliente not found' });
      }
      res.json(cliente);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.delete('/api/clientes/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const deleted = await storage.deleteCliente(id, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Cliente not found' });
    }
    res.status(204).send();
  }));

  // Hodometro routes
  app.get('/api/hodometros', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const hodometros = await storage.getHodometros(companyId);
    res.json(hodometros);
  }));

  app.get('/api/hodometros/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const hodometro = await storage.getHodometro(id, companyId);
    if (!hodometro) {
      return res.status(404).json({ error: 'Hodometro not found' });
    }
    res.json(hodometro);
  }));

  app.post('/api/hodometros', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertHodometroSchema.parse({ ...req.body, company_id: companyId });
      const hodometro = await storage.createHodometro(validatedData);
      res.status(201).json(hodometro);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.put('/api/hodometros/:id', asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = getCompanyId(req);
      const validatedData = insertHodometroSchema.partial().parse(req.body);
      const hodometro = await storage.updateHodometro(id, validatedData, companyId);
      if (!hodometro) {
        return res.status(404).json({ error: 'Hodometro not found' });
      }
      res.json(hodometro);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.delete('/api/hodometros/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const deleted = await storage.deleteHodometro(id, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Hodometro not found' });
    }
    res.status(204).send();
  }));

  // Checklist routes
  app.get('/api/checklists', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const checklists = await storage.getChecklists(companyId);
    res.json(checklists);
  }));

  app.get('/api/checklists/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const checklist = await storage.getChecklist(id, companyId);
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }
    res.json(checklist);
  }));

  app.post('/api/checklists', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertChecklistSchema.parse({ ...req.body, company_id: companyId });
      const checklist = await storage.createChecklist(validatedData);
      res.status(201).json(checklist);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.put('/api/checklists/:id', asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = getCompanyId(req);
      const validatedData = insertChecklistSchema.partial().parse(req.body);
      const checklist = await storage.updateChecklist(id, validatedData, companyId);
      if (!checklist) {
        return res.status(404).json({ error: 'Checklist not found' });
      }
      res.json(checklist);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.delete('/api/checklists/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const deleted = await storage.deleteChecklist(id, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Checklist not found' });
    }
    res.status(204).send();
  }));

  // Grupo Resumo routes (ported from Supabase Edge Functions)
  app.get('/api/grupo-resumo', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const grupos = await storage.getGrupoResumos(companyId);
    res.json(grupos);
  }));

  app.get('/api/grupo-resumo/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const grupo = await storage.getGrupoResumo(id, companyId);
    if (!grupo) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(grupo);
  }));

  app.post('/api/grupo-resumo', asyncHandler(async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const validatedData = insertGrupoResumoSchema.parse({ ...req.body, company_id: companyId });
      const grupo = await storage.createGrupoResumo(validatedData);
      res.status(201).json(grupo);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.put('/api/grupo-resumo/:id', asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const companyId = getCompanyId(req);
      const validatedData = insertGrupoResumoSchema.partial().parse(req.body);
      const grupo = await storage.updateGrupoResumo(id, validatedData, companyId);
      if (!grupo) {
        return res.status(404).json({ error: 'Group not found' });
      }
      res.json(grupo);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      throw error;
    }
  }));

  app.delete('/api/grupo-resumo/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    const deleted = await storage.deleteGrupoResumo(id, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.status(204).send();
  }));

  // Manual summary trigger endpoint (ported from Supabase Edge Function)
  app.post('/api/grupo-resumo/:id/trigger-summary', asyncHandler(async (req: Request, res: Response) => {
    const groupId = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    
    // Get group data
    const grupo = await storage.getGrupoResumo(groupId, companyId);
    if (!grupo) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!grupo.ativo) {
      return res.status(400).json({ error: 'Group is inactive' });
    }

    try {
      // Send webhook to n8n (same as the original Edge Function)
      const webhookData = {
        "nome_do_grupo": grupo.nome_grupo,
        "url_do_grupo": grupo.url_grupo
      };

      const WEBHOOK_URL = 'https://n8nqp.wiseapp360.com/webhook/resumo-grupo';
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send webhook: ${response.status} - ${errorText}`);
      }

      res.json({
        success: true,
        message: `Summary sent successfully for group ${grupo.nome_grupo}`,
        data: {
          group_id: grupo.id,
          group_name: grupo.nome_grupo
        }
      });
    } catch (error) {
      console.error('Error sending webhook:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }));

  // Error handling middleware
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('API Error:', err);
    
    if (err.message === 'Valid company_id is required') {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
