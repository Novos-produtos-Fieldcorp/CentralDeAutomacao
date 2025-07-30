import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
// Removed NeonDB import - using only Supabase now
import { eq } from "drizzle-orm";
import { cliente, unidade, operacao, st_vaga, company, vaga } from "@shared/schema";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with bypass RLS for backend operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { 
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`
    }
  }
});

// Helper function to get company_id from account_id
async function getCompanyIdFromAccount(accountId: string): Promise<number | null> {
  try {
    const { data: companies, error } = await supabase
      .from('company')
      .select('company_id')
      .eq('id_conta_wiseapp', accountId)
      .limit(1);

    if (error) {
      console.error('Error fetching company:', error);
      return null;
    }

    if (!companies || companies.length === 0) {
      return null;
    }

    return companies[0].company_id;
  } catch (error) {
    console.error('Error in getCompanyIdFromAccount:', error);
    return null;
  }
}

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
  // Get vagas dashboard data - using Supabase
  app.get('/api/vagas/dashboard/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log('Fetching vagas dashboard for account:', accountId);
      
      // Get company from Supabase
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId)
        .limit(1);

      if (companyError) {
        console.error('Supabase company error:', companyError);
        return res.status(500).json({ error: 'Failed to fetch company' });
      }

      if (!companies || companies.length === 0) {
        console.log('No company found for account_id:', accountId);
        return res.json({ totalVagas: 0, vagasAbertas: 0, vagasFechadas: 0, vagasVencendo: 0 });
      }

      const companyId = companies[0].company_id;
      console.log('Mapped account_id', accountId, 'to company.id', companyId);
      
      // Count vagas from Supabase
      const { data: vagas, error: vagasError } = await supabase
        .from('vaga')
        .select('id')
        .eq('company_id', companyId);
      
      if (vagasError) {
        console.error('Supabase vagas error:', vagasError);
        return res.status(500).json({ error: 'Failed to fetch vagas' });
      }
      
      const totalVagas = vagas?.length || 0;
      
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

  // Get all vagas for a company - using Supabase
  app.get('/api/vagas/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log('Fetching vagas for account:', accountId);
      
      // Get company from Supabase
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId)
        .limit(1);

      if (companyError) {
        console.error('Supabase company error:', companyError);
        return res.status(500).json({ error: 'Failed to fetch company' });
      }

      if (!companies || companies.length === 0) {
        console.log('No company found for account_id:', accountId);
        return res.json([]);
      }

      const companyId = companies[0].company_id;
      console.log('Mapped account_id', accountId, 'to company.id', companyId);
      
      // Fetch vagas from Supabase with related data
      const { data: vagas, error: vagasError } = await supabase
        .from('vaga')
        .select(`
          id,
          nome,
          descricao,
          quantidade,
          dias_trabalho,
          horario,
          dt_limite,
          created_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (vagasError) {
        console.error('Supabase vagas error:', vagasError);
        return res.status(500).json({ error: 'Failed to fetch vagas' });
      }

      // Transform data to match expected format
      const transformedVagas = vagas?.map(vaga => ({
        id: vaga.id,
        nome: vaga.nome,
        descricao: vaga.descricao,
        quantidade: vaga.quantidade,
        dias_trabalho: vaga.dias_trabalho,
        horario: vaga.horario,
        dt_limite: vaga.dt_limite,
        created_at: vaga.created_at,
        unidade_nome: null, // Will be populated when relations are set up
        operacao_nome: null,
        status_vaga: null,
        cliente_nome: null
      })) || [];

      console.log('Found vagas:', transformedVagas.length);
      res.json(transformedVagas);
    } catch (error) {
      console.error('Error fetching vagas:', error);
      res.status(500).json({ error: 'Erro ao buscar vagas' });
    }
  });

  // Create new vaga - using Supabase
  app.post('/api/vagas', async (req, res) => {
    try {
      const vagaData = req.body;
      console.log('Creating vaga with data:', vagaData);
      
      // Convert company_id from account_id to actual company.id using Supabase
      let companyId = vagaData.company_id;
      
      // Map account_id to company_id using Supabase
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', String(companyId))
        .limit(1);
        
      if (companyError) {
        console.error('Supabase company error:', companyError);
        return res.status(500).json({ error: 'Failed to fetch company' });
      }
      
      if (companies && companies.length > 0) {
        companyId = companies[0].company_id;
        console.log('Mapped account_id', vagaData.company_id, 'to company_id', companyId);
      } else {
        console.error('No company found for account_id:', vagaData.company_id);
        return res.status(400).json({ error: 'Company not found for this account' });
      }
      
      // Prepare data for Supabase insertion
      const insertData: any = {
        nome: vagaData.nome,
        descricao: vagaData.descricao,
        company_id: companyId,
        quantidade: vagaData.quantidade ? Number(vagaData.quantidade) : null,
        dias_trabalho: vagaData.dias_trabalho || null,
        horario: vagaData.horario || null,
        dt_limite: vagaData.dt_limite || null,
        unidade_id: vagaData.unidade_id ? Number(vagaData.unidade_id) : null,
        operacao_id: vagaData.operacao_id ? Number(vagaData.operacao_id) : null,
        st_vaga_id: vagaData.st_vaga_id ? Number(vagaData.st_vaga_id) : null,
        cliente_id: vagaData.cliente_id ? Number(vagaData.cliente_id) : null,
      };
      
      // Insert into Supabase
      const { data: newVaga, error: insertError } = await supabase
        .from('vaga')
        .insert(insertData)
        .select()
        .single();
      
      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create vaga', details: insertError.message });
      }
      
      console.log('Vaga created successfully in Supabase:', newVaga);
      res.status(201).json({ message: 'Vaga criada com sucesso', vaga: newVaga });
    } catch (error) {
      console.error('Error creating vaga:', error);
      res.status(500).json({ error: 'Erro ao criar vaga', details: error instanceof Error ? error.message : 'Erro desconhecido' });
    }
  });

  // Delete vaga - using Supabase
  app.delete('/api/vagas/:id', async (req, res) => {
    try {
      const vagaId = req.params.id;
      console.log('Deleting vaga with id:', vagaId);
      
      // Delete from Supabase
      const { error: deleteError } = await supabase
        .from('vaga')
        .delete()
        .eq('id', vagaId);
      
      if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        return res.status(500).json({ error: 'Failed to delete vaga', details: deleteError.message });
      }
      
      console.log('Vaga deleted successfully');
      res.json({ message: 'Vaga deletada com sucesso' });
    } catch (error) {
      console.error('Error deleting vaga:', error);
      res.status(500).json({ error: 'Erro ao deletar vaga', details: error instanceof Error ? error.message : 'Erro desconhecido' });
    }
  });

  // Get supporting data for dropdowns - using Supabase
  app.get('/api/clientes/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log('Fetching clientes for account:', accountId);
      
      // Get company from Supabase
      const { data: companies, error: companyError } = await supabase
        .from('company')
        .select('company_id')
        .eq('id_conta_wiseapp', accountId)
        .limit(1);

      if (companyError) {
        console.error('Supabase company error:', companyError);
        return res.status(500).json({ error: 'Failed to fetch company' });
      }

      if (!companies || companies.length === 0) {
        console.log('No company found for account_id:', accountId);
        return res.json([]);
      }

      const companyId = companies[0].company_id;
      console.log('Mapped account_id', accountId, 'to company.id', companyId);
      
      // Get clientes from Supabase
      const { data: clientes, error: clientesError } = await supabase
        .from('cliente')
        .select('cliente_id, nome, company_id')
        .eq('company_id', companyId);

      if (clientesError) {
        console.error('Supabase clientes error:', clientesError);
        return res.status(500).json({ error: 'Failed to fetch clientes' });
      }

      console.log('Found clientes:', clientes?.length || 0);
      res.json(clientes || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
  });

  app.get('/api/unidades/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      
      // Get company_id from account_id
      const companyId = await getCompanyIdFromAccount(accountId);
      if (!companyId) {
        return res.json([]);
      }
      
      // Get unidades from Supabase
      const { data: unidades, error: unidadesError } = await supabase
        .from('unidade')
        .select('id, unidade, company_id')
        .eq('company_id', companyId);

      if (unidadesError) {
        console.error('Supabase unidades error:', unidadesError);
        return res.status(500).json({ error: 'Failed to fetch unidades' });
      }

      res.json(unidades || []);
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

      // Resolve the actual company_id from the account mapping
      const actualCompanyId = await getCompanyIdFromAccount(String(company_id));
      if (!actualCompanyId) {
        return res.status(404).json({ error: 'Company not found for this account' });
      }

      // Insert into Supabase
      const { data: newUnidade, error: insertError } = await supabase
        .from('unidade')
        .insert({
          unidade: unidadeName,
          company_id: actualCompanyId
        })
        .select('id, unidade, company_id')
        .single();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create unidade', details: insertError.message });
      }

      res.status(201).json(newUnidade);
    } catch (error) {
      console.error('Error creating unidade:', error);
      res.status(500).json({ error: 'Erro ao criar unidade' });
    }
  });

  app.get('/api/operacoes/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      
      // Get company_id from account_id
      const companyId = await getCompanyIdFromAccount(accountId);
      if (!companyId) {
        return res.json([]);
      }
      
      // Get operacoes from Supabase
      const { data: operacoes, error: operacoesError } = await supabase
        .from('operacao')
        .select('id, operacao, company_id')
        .eq('company_id', companyId);

      if (operacoesError) {
        console.error('Supabase operacoes error:', operacoesError);
        return res.status(500).json({ error: 'Failed to fetch operacoes' });
      }

      res.json(operacoes || []);
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

      // Resolve the actual company_id from the account mapping
      const actualCompanyId = await getCompanyIdFromAccount(String(company_id));
      if (!actualCompanyId) {
        return res.status(404).json({ error: 'Company not found for this account' });
      }

      // Insert into Supabase
      const { data: newOperacao, error: insertError } = await supabase
        .from('operacao')
        .insert({
          operacao: operacaoName,
          company_id: actualCompanyId
        })
        .select('id, operacao, company_id')
        .single();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create operacao', details: insertError.message });
      }

      res.status(201).json(newOperacao);
    } catch (error) {
      console.error('Error creating operacao:', error);
      res.status(500).json({ error: 'Erro ao criar operação' });
    }
  });

  app.get('/api/status-vagas/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      
      // Get company_id from account_id
      const companyId = await getCompanyIdFromAccount(accountId);
      if (!companyId) {
        return res.json([
          { id: 1, status_vaga: 'Aberta', company_id: 1 },
          { id: 2, status_vaga: 'Fechada', company_id: 1 },
          { id: 3, status_vaga: 'Pausada', company_id: 1 }
        ]);
      }
      
      // Get status vagas from Supabase
      const { data: statusVagas, error: statusError } = await supabase
        .from('st_vaga')
        .select('id, status_vaga, company_id')
        .eq('company_id', companyId);

      if (statusError) {
        console.error('Supabase status vagas error:', statusError);
        return res.status(500).json({ error: 'Failed to fetch status vagas' });
      }

      // If no custom status found, return default ones
      if (!statusVagas || statusVagas.length === 0) {
        res.json([
          { id: 1, status_vaga: 'Aberta', company_id: companyId },
          { id: 2, status_vaga: 'Fechada', company_id: companyId },
          { id: 3, status_vaga: 'Pausada', company_id: companyId }
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

      // Resolve the actual company_id from the account mapping
      const actualCompanyId = await getCompanyIdFromAccount(String(company_id));
      if (!actualCompanyId) {
        return res.status(404).json({ error: 'Company not found for this account' });
      }

      // Insert into Supabase
      const { data: newStatus, error: insertError } = await supabase
        .from('st_vaga')
        .insert({
          status_vaga: status_vaga,
          company_id: actualCompanyId
        })
        .select('id, status_vaga, company_id')
        .single();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create status', details: insertError.message });
      }

      res.status(201).json(newStatus);
    } catch (error) {
      console.error('Error creating status:', error);
      res.status(500).json({ error: 'Erro ao criar status' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
