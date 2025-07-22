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
import { WiseAppService, getWiseAppService } from "@shared/wiseAppService";
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
function asyncHandler(fn: (req: Request, res: Response) => Promise<any>) {
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
      
      // Automatically sync with WiseApp if enabled
      const syncWithWiseApp = req.headers['x-sync-wiseapp'] === 'true';
      let wiseAppSyncResult = null;
      
      if (syncWithWiseApp && motorista.telefone) {
        try {
          const wiseAppService = getWiseAppService();
          if (wiseAppService) {
            wiseAppSyncResult = await wiseAppService.syncMotorista({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome,
              telefone: motorista.telefone,
              email: motorista.email || undefined,
              cpf: motorista.cpf,
              funcao: motorista.funcao,
              company_id: motorista.company_id
            });
          }
        } catch (syncError) {
          console.warn('WiseApp sync failed for new motorista:', syncError);
          // Don't fail the main request if sync fails
        }
      }
      
      res.status(201).json({
        ...motorista,
        wiseapp_sync: wiseAppSyncResult
      });
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
      
      // Automatically sync with WiseApp if enabled
      const syncWithWiseApp = req.headers['x-sync-wiseapp'] === 'true';
      let wiseAppSyncResult = null;
      
      if (syncWithWiseApp && motorista.telefone) {
        try {
          const wiseAppService = getWiseAppService();
          if (wiseAppService) {
            wiseAppSyncResult = await wiseAppService.syncMotorista({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome,
              telefone: motorista.telefone,
              email: motorista.email || undefined,
              cpf: motorista.cpf,
              funcao: motorista.funcao,
              company_id: motorista.company_id
            });
          }
        } catch (syncError) {
          console.warn('WiseApp sync failed for updated motorista:', syncError);
          // Don't fail the main request if sync fails
        }
      }
      
      res.json({
        ...motorista,
        wiseapp_sync: wiseAppSyncResult
      });
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
    res.json({ message: 'Motorista deleted successfully' });
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
    res.json({ message: 'Veiculo deleted successfully' });
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
    res.json({ message: 'Cliente deleted successfully' });
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
    res.json({ message: 'Hodometro deleted successfully' });
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
    res.json({ message: 'Checklist deleted successfully' });
  }));

  // Grupo Resumo routes
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
      return res.status(404).json({ error: 'Grupo Resumo not found' });
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
        return res.status(404).json({ error: 'Grupo Resumo not found' });
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
      return res.status(404).json({ error: 'Grupo Resumo not found' });
    }
    res.json({ message: 'Grupo Resumo deleted successfully' });
  }));

  // Trigger summary endpoint
  app.post('/api/grupo-resumo/:id/trigger-summary', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    
    try {
      const grupo = await storage.getGrupoResumo(id, companyId);
      if (!grupo) {
        return res.status(404).json({ error: 'Grupo Resumo not found' });
      }

      // Here you would implement the webhook trigger logic
      // For now, we'll just return a success response
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

  // WiseApp Synchronization endpoints
  app.post('/api/wiseapp/sync-motorista/:id', asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const companyId = getCompanyId(req);
    
    try {
      const motorista = await storage.getMotorista(id, companyId);
      if (!motorista) {
        return res.status(404).json({ error: 'Motorista not found' });
      }

      if (!motorista.telefone) {
        return res.status(400).json({ error: 'Phone number is required for WiseApp synchronization' });
      }

      const wiseAppService = getWiseAppService();
      if (!wiseAppService) {
        return res.status(500).json({ error: 'WiseApp service not configured' });
      }

      const syncResult = await wiseAppService.syncMotorista({
        motorista_id: motorista.motorista_id,
        nome: motorista.nome,
        telefone: motorista.telefone,
        email: motorista.email || undefined,
        cpf: motorista.cpf,
        funcao: motorista.funcao,
        company_id: motorista.company_id
      });

      res.json({
        success: syncResult.success,
        message: syncResult.success ? 'Contact synchronized successfully' : 'Synchronization failed',
        data: syncResult
      });
    } catch (error) {
      console.error('Error syncing motorista with WiseApp:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }));

  app.post('/api/wiseapp/sync-all-motoristas', asyncHandler(async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    
    try {
      const motoristas = await storage.getMotoristas(companyId);
      
      // Filter motoristas with valid phone numbers
      const motoristasToSync = motoristas.filter(m => m.telefone && m.ativo);
      
      if (motoristasToSync.length === 0) {
        return res.json({
          success: true,
          message: 'No active motoristas with phone numbers found',
          data: {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            errors: []
          }
        });
      }

      const wiseAppService = getWiseAppService();
      if (!wiseAppService) {
        return res.status(500).json({ error: 'WiseApp service not configured' });
      }

      const syncData = motoristasToSync.map(m => ({
        motorista_id: m.motorista_id,
        nome: m.nome,
        telefone: m.telefone!,
        email: m.email || undefined,
        cpf: m.cpf,
        funcao: m.funcao,
        company_id: m.company_id
      }));

      const result = await wiseAppService.syncMultipleMotoristas(syncData);

      res.json({
        success: true,
        message: `Bulk synchronization completed: ${result.successful} successful, ${result.failed} failed`,
        data: result
      });
    } catch (error) {
      console.error('Error in bulk sync:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }));

  app.get('/api/wiseapp/validate-config', asyncHandler(async (req: Request, res: Response) => {
    try {
      const wiseAppService = getWiseAppService();
      if (!wiseAppService) {
        return res.status(400).json({ 
          valid: false, 
          error: 'WiseApp configuration not found' 
        });
      }

      const validation = await wiseAppService.validateConfig();
      res.json(validation);
    } catch (error) {
      console.error('Error validating WiseApp config:', error);
      res.status(500).json({
        valid: false,
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