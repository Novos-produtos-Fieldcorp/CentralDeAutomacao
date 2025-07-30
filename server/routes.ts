import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { cliente, unidade, operacao, st_vaga, company, vaga } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Proxy para API do WiseApp (Chat)
  app.all('/api/api/v1/*', async (req, res) => {
    try {
      const wiseappApiUrl = process.env.VITE_CHAT_API_URL || 'https://chat.wiseapp360.com';
      const apiKey = req.headers['api_access_token'] || req.headers['authorization'];
      
      if (!apiKey) {
        return res.status(401).json({ error: 'Token de acesso não fornecido' });
      }

      // Remover /api do início da URL para fazer o proxy
      const targetPath = req.url.replace('/api', '');
      const targetUrl = `${wiseappApiUrl}${targetPath}`;
      
      console.log(`Proxying request to: ${targetUrl}`);
      
      const fetchOptions: any = {
        method: req.method,
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      };

      // Adicionar body para requests que não sejam GET
      if (req.method !== 'GET' && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, fetchOptions);
      const data = await response.json();
      
      // Adicionar headers de no-cache na resposta
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.setHeader('ETag', `"${Date.now()}"`);
      
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Erro no proxy WiseApp:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor ao acessar a API do WiseApp',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Proxy para consulta de CEP com múltiplas APIs de fallback
  app.get('/api/cep/:cep', async (req, res) => {
    try {
      const { cep } = req.params;
      
      // Validar formato do CEP
      if (!/^\d{8}$/.test(cep)) {
        return res.status(400).json({ error: 'CEP deve conter exatamente 8 dígitos' });
      }

      // Lista de APIs de CEP para fallback
      const cepApis = [
        {
          name: 'ViaCEP',
          url: `https://viacep.com.br/ws/${cep}/json/`,
          timeout: 8000,
          transform: (data: any) => ({
            cep: data.cep,
            logradouro: data.logradouro,
            complemento: data.complemento,
            bairro: data.bairro,
            localidade: data.localidade,
            uf: data.uf,
            ibge: data.ibge,
            gia: data.gia,
            ddd: data.ddd,
            siafi: data.siafi
          }),
          isError: (data: any) => data.erro
        },
        {
          name: 'BrasilAPI',
          url: `https://brasilapi.com.br/api/cep/v1/${cep}`,
          timeout: 6000,
          transform: (data: any) => ({
            cep: data.cep,
            logradouro: data.street,
            complemento: '',
            bairro: data.neighborhood,
            localidade: data.city,
            uf: data.state,
            ibge: '',
            gia: '',
            ddd: '',
            siafi: ''
          }),
          isError: (data: any) => !data.cep || data.type === 'error'
        },
        {
          name: 'PostMon',
          url: `https://api.postmon.com.br/v1/cep/${cep}`,
          timeout: 6000,
          transform: (data: any) => ({
            cep: data.cep,
            logradouro: data.logradouro,
            complemento: data.complemento || '',
            bairro: data.bairro,
            localidade: data.cidade,
            uf: data.estado,
            ibge: data.cidade_info?.codigo_ibge || '',
            gia: '',
            ddd: '',
            siafi: ''
          }),
          isError: (data: any) => !data.cep
        },
        {
          name: 'RepublicaVirtual',
          url: `https://cep.republicavirtual.com.br/web_cep.php?cep=${cep}&formato=json`,
          timeout: 6000,
          transform: (data: any) => ({
            cep: cep,
            logradouro: data.tipo_logradouro + ' ' + data.logradouro,
            complemento: '',
            bairro: data.bairro,
            localidade: data.cidade,
            uf: data.uf,
            ibge: '',
            gia: '',
            ddd: '',
            siafi: ''
          }),
          isError: (data: any) => data.resultado !== '1'
        }
      ];

      let lastError = null;

      // Tentar cada API em sequência
      for (const api of cepApis) {
        try {
          console.log(`Tentando API ${api.name} para CEP ${cep}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), api.timeout || 5000);
          
          const fetchOptions: any = {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
              'Cache-Control': 'no-cache'
            }
          };

          const response = await fetch(api.url, fetchOptions);
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`${api.name} retornou status ${response.status}`);
          }

          const data = await response.json();
          
          if (api.isError && api.isError(data)) {
            throw new Error(`CEP não encontrado na API ${api.name}`);
          }

          const transformedData = api.transform(data);
          console.log(`✓ CEP encontrado com sucesso via ${api.name}`);
          
          return res.json(transformedData);
        } catch (error) {
          console.warn(`Erro na API ${api.name}:`, error instanceof Error ? error.message : error);
          lastError = error;
          continue;
        }
      }

      // Se chegou aqui, todas as APIs falharam
      console.error('Todas as APIs de CEP falharam:', lastError);
      const errorMessage = (lastError as Error)?.message || '';
      console.log('Última mensagem de erro:', errorMessage);
      
      // Verifica se o problema é indisponibilidade geral ou CEP inválido
      const isGeneralFailure = lastError && (
        errorMessage.includes('status 5') || 
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('502') ||
        errorMessage.includes('503') ||
        errorMessage.includes('401') ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('retornou status')
      );
      
      console.log('É falha geral?', isGeneralFailure);
      
      if (isGeneralFailure) {
        res.status(503).json({ 
          error: 'Serviços de CEP temporariamente indisponíveis. Todas as APIs estão fora do ar no momento.',
          details: 'Preencha o endereço manualmente ou tente novamente em alguns minutos.'
        });
      } else {
        res.status(404).json({ 
          error: 'CEP não encontrado em nenhuma API disponível',
          details: 'Tente novamente em alguns instantes ou verifique se o CEP está correto'
        });
      }
    } catch (error) {
      console.error('Erro geral ao consultar CEP:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor ao consultar CEP',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Vagas API routes
  // Get vagas dashboard data
  app.get('/api/vagas/dashboard/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log('Fetching vagas dashboard for account:', accountId);
      
      // First, find the company id based on account_id
      const companyResult = await db
        .select({ id: company.id })
        .from(company)
        .where(eq(company.id_conta_wiseapp, accountId))
        .limit(1);

      if (companyResult.length === 0) {
        console.log('No company found for account_id:', accountId);
        return res.json({ totalVagas: 0, vagasAbertas: 0, vagasFechadas: 0, vagasVencendo: 0 });
      }

      const companyId = companyResult[0].id;
      console.log('Mapped account_id', accountId, 'to company.id', companyId);
      
      // Count total vagas
      const totalVagasResult = await db
        .select({ count: vaga.id })
        .from(vaga)
        .where(eq(vaga.company_id, companyId));
      
      const totalVagas = totalVagasResult.length;
      
      // Count vagas by status (we'll implement this when status data is available)
      const dashboardData = {
        totalVagas,
        vagasAbertas: totalVagas, // Assuming all are open for now
        vagasFechadas: 0,
        vagasVencendo: 0,
      };

      console.log('Dashboard data:', dashboardData);
      res.json(dashboardData);
    } catch (error) {
      console.error('Error fetching vagas dashboard:', error);
      res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
    }
  });

  // Get all vagas for a company
  app.get('/api/vagas/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log('Fetching vagas for account:', accountId);
      
      // First, find the company id based on account_id
      const companyResult = await db
        .select({ id: company.id })
        .from(company)
        .where(eq(company.id_conta_wiseapp, accountId))
        .limit(1);

      if (companyResult.length === 0) {
        console.log('No company found for account_id:', accountId);
        return res.json([]);
      }

      const companyId = companyResult[0].id;
      console.log('Mapped account_id', accountId, 'to company.id', companyId);
      
      // Fetch vagas with related data
      const vagas = await db
        .select({
          id: vaga.id,
          nome: vaga.nome,
          descricao: vaga.descricao,
          quantidade: vaga.quantidade,
          dias_trabalho: vaga.dias_trabalho,
          horario: vaga.horario,
          dt_limite: vaga.dt_limite,
          created_at: vaga.created_at,
          unidade_nome: unidade.unidade,
          operacao_nome: operacao.operacao,
          status_vaga: st_vaga.status_vaga,
          cliente_nome: cliente.nome_cliente,
        })
        .from(vaga)
        .leftJoin(unidade, eq(vaga.unidade_id, unidade.id))
        .leftJoin(operacao, eq(vaga.operacao_id, operacao.id))
        .leftJoin(st_vaga, eq(vaga.st_vaga_id, st_vaga.id))
        .leftJoin(cliente, eq(vaga.cliente_id, cliente.cliente_id))
        .where(eq(vaga.company_id, companyId))
        .orderBy(vaga.created_at);

      console.log('Found vagas:', vagas.length);
      res.json(vagas);
    } catch (error) {
      console.error('Error fetching vagas:', error);
      res.status(500).json({ error: 'Erro ao buscar vagas' });
    }
  });

  // Create new vaga
  app.post('/api/vagas', async (req, res) => {
    try {
      const vagaData = req.body;
      console.log('Creating vaga with data:', vagaData);
      
      // Convert company_id from account_id to actual company.id
      let companyId = vagaData.company_id;
      if (typeof companyId === 'string') {
        // If it's a string, it might be an account_id, so we need to map it
        const companyResult = await db
          .select({ id: company.id })
          .from(company)
          .where(eq(company.id_conta_wiseapp, companyId))
          .limit(1);
        
        if (companyResult.length > 0) {
          companyId = companyResult[0].id;
          console.log('Mapped account_id', vagaData.company_id, 'to company.id', companyId);
        }
      }
      
      // Insert the vaga into the database
      const insertData = {
        nome: vagaData.nome_vaga,
        descricao: vagaData.descricao,
        company_id: BigInt(companyId),
      };
      
      // Add optional fields only if they have values
      if (vagaData.quantidade) insertData.quantidade = String(vagaData.quantidade);
      if (vagaData.dias_trabalho) insertData.dias_trabalho = vagaData.dias_trabalho;
      if (vagaData.horario) insertData.horario = vagaData.horario;
      if (vagaData.dt_limite) insertData.dt_limite = new Date(vagaData.dt_limite);
      if (vagaData.unidade_id) insertData.unidade_id = BigInt(vagaData.unidade_id);
      if (vagaData.operacao_id) insertData.operacao_id = BigInt(vagaData.operacao_id);
      if (vagaData.st_vaga_id) insertData.st_vaga_id = BigInt(vagaData.st_vaga_id);
      if (vagaData.cliente_id) insertData.cliente_id = BigInt(vagaData.cliente_id);
      
      const [newVaga] = await db
        .insert(vaga)
        .values(insertData)
        .returning();
      
      console.log('Vaga created successfully:', newVaga);
      res.status(201).json({ message: 'Vaga criada com sucesso', vaga: newVaga });
    } catch (error) {
      console.error('Error creating vaga:', error);
      res.status(500).json({ error: 'Erro ao criar vaga', details: error instanceof Error ? error.message : 'Erro desconhecido' });
    }
  });

  // Get supporting data for dropdowns
  app.get('/api/clientes/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log('Fetching clientes for account:', accountId);
      
      // First, find the company id based on account_id
      const companyResult = await db
        .select({ id: company.id })
        .from(company)
        .where(eq(company.id_conta_wiseapp, accountId))
        .limit(1);

      if (companyResult.length === 0) {
        console.log('No company found for account_id:', accountId);
        return res.json([]);
      }

      const companyId = companyResult[0].id;
      console.log('Mapped account_id', accountId, 'to company.id', companyId);
      
      const clientes = await db
        .select({
          cliente_id: cliente.cliente_id,
          nome_cliente: cliente.nome_cliente,
          company_id: cliente.company_id
        })
        .from(cliente)
        .where(eq(cliente.company_id, companyId));

      console.log('Found clientes:', clientes);
      res.json(clientes);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
  });

  app.get('/api/unidades/:companyId', async (req, res) => {
    try {
      const { companyId } = req.params;
      
      const unidades = await db
        .select({
          id: unidade.id,
          unidade: unidade.unidade,
          company_id: unidade.company_id
        })
        .from(unidade)
        .where(eq(unidade.company_id, Number(companyId)));

      res.json(unidades);
    } catch (error) {
      console.error('Error fetching unidades:', error);
      res.status(500).json({ error: 'Erro ao buscar unidades' });
    }
  });

  app.post('/api/unidades', async (req, res) => {
    try {
      const { unidade: unidadeName, company_id } = req.body;
      
      if (!unidadeName || !company_id) {
        return res.status(400).json({ error: 'Nome da unidade e company_id são obrigatórios' });
      }

      const [newUnidade] = await db
        .insert(unidade)
        .values({
          unidade: unidadeName,
          company_id: Number(company_id)
        })
        .returning({
          id: unidade.id,
          unidade: unidade.unidade,
          company_id: unidade.company_id
        });

      res.status(201).json(newUnidade);
    } catch (error) {
      console.error('Error creating unidade:', error);
      res.status(500).json({ error: 'Erro ao criar unidade' });
    }
  });

  app.get('/api/operacoes/:companyId', async (req, res) => {
    try {
      const { companyId } = req.params;
      
      const operacoes = await db
        .select({
          id: operacao.id,
          operacao: operacao.operacao,
          company_id: operacao.company_id
        })
        .from(operacao)
        .where(eq(operacao.company_id, Number(companyId)));

      res.json(operacoes);
    } catch (error) {
      console.error('Error fetching operacoes:', error);
      res.status(500).json({ error: 'Erro ao buscar operações' });
    }
  });

  app.post('/api/operacoes', async (req, res) => {
    try {
      const { operacao: operacaoName, company_id } = req.body;
      
      if (!operacaoName || !company_id) {
        return res.status(400).json({ error: 'Nome da operação e company_id são obrigatórios' });
      }

      const [newOperacao] = await db
        .insert(operacao)
        .values({
          operacao: operacaoName,
          company_id: Number(company_id)
        })
        .returning({
          id: operacao.id,
          operacao: operacao.operacao,
          company_id: operacao.company_id
        });

      res.status(201).json(newOperacao);
    } catch (error) {
      console.error('Error creating operacao:', error);
      res.status(500).json({ error: 'Erro ao criar operação' });
    }
  });

  app.get('/api/status-vagas/:companyId', async (req, res) => {
    try {
      const { companyId } = req.params;
      
      const statusVagas = await db
        .select({
          id: st_vaga.id,
          status_vaga: st_vaga.status_vaga,
          company_id: st_vaga.company_id
        })
        .from(st_vaga)
        .where(eq(st_vaga.company_id, Number(companyId)));

      // If no custom status found, return default ones
      if (statusVagas.length === 0) {
        res.json([
          { id: 1, status_vaga: 'Aberta', company_id: Number(companyId) },
          { id: 2, status_vaga: 'Fechada', company_id: Number(companyId) },
          { id: 3, status_vaga: 'Pausada', company_id: Number(companyId) }
        ]);
      } else {
        res.json(statusVagas);
      }
    } catch (error) {
      console.error('Error fetching status vagas:', error);
      res.status(500).json({ error: 'Erro ao buscar status das vagas' });
    }
  });

  app.post('/api/status-vagas', async (req, res) => {
    try {
      const { status_vaga, company_id } = req.body;
      
      if (!status_vaga || !company_id) {
        return res.status(400).json({ error: 'Nome do status e company_id são obrigatórios' });
      }

      const [newStatus] = await db
        .insert(st_vaga)
        .values({
          status_vaga: status_vaga,
          company_id: Number(company_id)
        })
        .returning({
          id: st_vaga.id,
          status_vaga: st_vaga.status_vaga,
          company_id: st_vaga.company_id
        });

      res.status(201).json(newStatus);
    } catch (error) {
      console.error('Error creating status:', error);
      res.status(500).json({ error: 'Erro ao criar status' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
