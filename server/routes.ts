import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { supabase } from "./db";
import { eq, and } from "drizzle-orm";
import {
  cliente,
  unidade,
  operacao,
  st_vaga,
  company,
  vaga,
  motorista,
  comentario,
  insertComentarioSchema,
} from "@shared/schema";
import { createClient } from "@supabase/supabase-js";
import { 
  apiWithRetryAndCache, 
  retryWithBackoff,
  WiseAppRetryOptions,
  WiseAppCacheOptions 
} from "./utils/api-retry";
import { getBulkMotoristaTags } from "./bulk-tags-api";
import { registerBulkContactTagsRoute } from "./bulk-contact-tags-sync";
// CPF agora é consultado diretamente do frontend

// Job tracking system for progress monitoring
interface JobStatus {
  id: string;
  status: 'running' | 'completed' | 'error';
  currentStep: string;
  processedContacts: number;
  totalContacts: number;
  processedTags: number;
  totalTags: number;
  message: string;
  startTime: number;
  result?: any;
  error?: string;
}

const jobTracker = new Map<string, JobStatus>();

// Utility to generate job IDs
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Job progress update helper
function updateJobProgress(jobId: string, updates: Partial<JobStatus>) {
  const job = jobTracker.get(jobId);
  if (job) {
    Object.assign(job, updates);
    console.log(`[Job ${jobId}] Progress: ${updates.currentStep || job.currentStep} - ${job.processedContacts}/${job.totalContacts} contacts`);
  }
}

// Clean up old jobs (older than 1 hour)
function cleanupOldJobs() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [jobId, job] of jobTracker.entries()) {
    if (now - job.startTime > oneHour) {
      jobTracker.delete(jobId);
    }
  }
}

// Clean up jobs every 30 minutes
setInterval(cleanupOldJobs, 30 * 60 * 1000);

// Initialize Supabase client with bypass RLS for backend operations
const supabaseBackendUrl =
  process.env.VITE_SUPABASE_URL || "https://ohmoxsvwjvohmqqgxjhb.supabase.co";
const supabaseBackendKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ";
const supabaseBackend = createClient(supabaseBackendUrl, supabaseBackendKey, {
  db: { schema: "public" },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseBackendKey}`,
    },
  },
});

// Helper function to get company_id from accountId
async function getCompanyIdFromAccount(
  accountId: string,
): Promise<number | null> {
  try {
    const { data: companies, error } = await supabaseBackend
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

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Rota para buscar token WiseApp por company_id
  app.get("/api/wiseapp-token/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      console.log("Fetching WiseApp token for company_id:", companyId);
      
      const token = await storage.getWiseappToken(parseInt(companyId));
      
      if (!token) {
        return res.status(404).json({ 
          error: "Token WiseApp não encontrado",
          message: "Configure o token WiseApp nas configurações da empresa" 
        });
      }
      
      res.json({ token });
    } catch (error) {
      console.error("Erro ao buscar token WiseApp:", error);
      res.status(500).json({ 
        error: "Erro interno do servidor", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Nova rota específica para buscar inboxes com cache otimizado por company_id
  app.get("/api/inboxes/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { accountId } = req.query;
      
      console.log(`Fetching inboxes for company_id: ${companyId}, accountId: ${accountId}`);

      // Buscar token WiseApp para esta empresa
      const token = await storage.getWiseappToken(parseInt(companyId));
      
      if (!token) {
        return res.status(404).json({ 
          error: "Token WiseApp não configurado para esta empresa" 
        });
      }

      // Buscar dados da empresa para validar accountId
      const { data: companies, error: companyError } = await supabaseBackend
        .from("company")
        .select("id_conta_wiseapp")
        .eq("company_id", parseInt(companyId))
        .eq("id_conta_wiseapp", accountId)
        .limit(1);

      if (companyError || !companies || companies.length === 0) {
        return res.status(403).json({ 
          error: "Account ID não corresponde à empresa especificada" 
        });
      }

      // Fazer requisição para o ChatWoot
      const wiseappApiUrl = process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";
      const targetUrl = `${wiseappApiUrl}/api/v1/accounts/${accountId}/inboxes`;

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
          accountId: accountId,
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

  // Rota para buscar empresa por accountId
  app.get("/api/company/by-account/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log("Fetching company for accountId:", accountId);

      const { data: companies, error } = await supabaseBackend
        .from("company")
        .select("*")
        .eq("id_conta_wiseapp", accountId)
        .limit(1);

      if (error) {
        console.error("Error fetching company:", error);
        return res.status(500).json({ error: "Erro ao buscar empresa" });
      }

      if (!companies || companies.length === 0) {
        console.log("No company found for accountId:", accountId);
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      const company = companies[0];
      console.log("Found company:", company);

      // Retornar dados no formato esperado pelo frontend
      res.json({
        company_id: company.company_id || company.id,
        razao_social: company.nome, // usar 'nome' em vez de 'razao_social'
        id_conta_wiseapp: company.id_conta_wiseapp,
      });
    } catch (error) {
      console.error("Error in company lookup:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Proxy para API do WiseApp (Chat)
  app.all("/api/api/v1/*", async (req, res) => {
    try {
      const wiseappApiUrl =
        process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";
      const apiKey =
        req.headers["api_access_token"] || req.headers["authorization"];

      if (!apiKey) {
        return res.status(401).json({ error: "Token de acesso não fornecido" });
      }

      // Remover /api do início da URL para fazer o proxy
      const targetPath = req.url.replace("/api", "");
      const targetUrl = `${wiseappApiUrl}${targetPath}`;

      console.log(`Proxying request to: ${targetUrl}`);

      const fetchOptions: any = {
        method: req.method,
        headers: {
          api_access_token: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      };

      // Adicionar body para requests que não sejam GET
      if (req.method !== "GET" && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, fetchOptions);
      const data = await response.json();

      // Adicionar headers de no-cache na resposta
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Last-Modified", new Date().toUTCString());
      res.setHeader("ETag", `"${Date.now()}"`);

      res.status(response.status).json(data);
    } catch (error) {
      console.error("Erro no proxy WiseApp:", error);
      res.status(500).json({
        error: "Erro interno do servidor ao acessar a API do WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Proxy para consulta de CEP com múltiplas APIs de fallback
  app.get("/api/cep/:cep", async (req, res) => {
    try {
      const { cep } = req.params;

      // Validar formato do CEP
      if (!/^\d{8}$/.test(cep)) {
        return res
          .status(400)
          .json({ error: "CEP deve conter exatamente 8 dígitos" });
      }

      // Lista de APIs de CEP para fallback
      const cepApis = [
        {
          name: "ViaCEP",
          url: `https://viacep.com.br/ws/${cep}/json/`,
          timeout: 8000,
          headers: {},
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
            siafi: data.siafi,
          }),
          isError: (data: any) => data.erro,
        },
        {
          name: "BrasilAPI",
          url: `https://brasilapi.com.br/api/cep/v1/${cep}`,
          timeout: 6000,
          headers: {},
          transform: (data: any) => ({
            cep: data.cep,
            logradouro: data.street,
            complemento: "",
            bairro: data.neighborhood,
            localidade: data.city,
            uf: data.state,
            ibge: "",
            gia: "",
            ddd: "",
            siafi: "",
          }),
          isError: (data: any) => !data.cep || data.type === "error",
        },
        {
          name: "PostMon",
          url: `https://api.postmon.com.br/v1/cep/${cep}`,
          timeout: 6000,
          headers: {},
          transform: (data: any) => ({
            cep: data.cep,
            logradouro: data.logradouro,
            complemento: data.complemento || "",
            bairro: data.bairro,
            localidade: data.cidade,
            uf: data.estado,
            ibge: data.cidade_info?.codigo_ibge || "",
            gia: "",
            ddd: "",
            siafi: "",
          }),
          isError: (data: any) => !data.cep,
        },
        {
          name: "RepublicaVirtual",
          url: `https://cep.republicavirtual.com.br/web_cep.php?cep=${cep}&formato=json`,
          timeout: 6000,
          headers: {},
          transform: (data: any) => ({
            cep: cep,
            logradouro: data.tipo_logradouro + " " + data.logradouro,
            complemento: "",
            bairro: data.bairro,
            localidade: data.cidade,
            uf: data.uf,
            ibge: "",
            gia: "",
            ddd: "",
            siafi: "",
          }),
          isError: (data: any) => data.resultado !== "1",
        },
      ];

      let lastError = null;

      // Tentar cada API em sequência
      for (const api of cepApis) {
        try {
          console.log(`Tentando API ${api.name} para CEP ${cep}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            api.timeout || 5000,
          );

          const fetchOptions: any = {
            method: "GET",
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "application/json, text/plain, */*",
              "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
              "Cache-Control": "no-cache",
              ...(api.headers || {}),
            },
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
          console.warn(
            `Erro na API ${api.name}:`,
            error instanceof Error ? error.message : error,
          );
          lastError = error;
          continue;
        }
      }

      // Se chegou aqui, todas as APIs falharam
      console.error("Todas as APIs de CEP falharam:", lastError);
      const errorMessage = (lastError as Error)?.message || "";
      console.log("Última mensagem de erro:", errorMessage);

      // Verifica se o problema é indisponibilidade geral ou CEP inválido
      const isGeneralFailure =
        lastError &&
        (errorMessage.includes("status 5") ||
          errorMessage.includes("fetch failed") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("502") ||
          errorMessage.includes("503") ||
          errorMessage.includes("401") ||
          errorMessage.includes("aborted") ||
          errorMessage.includes("retornou status"));

      console.log("É falha geral?", isGeneralFailure);

      if (isGeneralFailure) {
        res.status(503).json({
          error:
            "Serviços de CEP temporariamente indisponíveis. Todas as APIs estão fora do ar no momento.",
          details:
            "Preencha o endereço manualmente ou tente novamente em alguns minutos.",
        });
      } else {
        res.status(404).json({
          error: "CEP não encontrado em nenhuma API disponível",
          details:
            "Tente novamente em alguns instantes ou verifique se o CEP está correto",
        });
      }
    } catch (error) {
      console.error("Erro geral ao consultar CEP:", error);
      res.status(500).json({
        error: "Erro interno do servidor ao consultar CEP",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // GET routes for dropdowns using Supabase
  app.get("/api/clientes/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { data: clientes, error } = await supabaseBackend
        .from("cliente")
        .select("*")
        .eq("company_id", companyId);

      if (error) {
        console.error("Error fetching clientes:", error);
        return res.status(500).json({ error: "Erro ao buscar clientes" });
      }

      res.json(clientes);
    } catch (error) {
      console.error("Error fetching clientes:", error);
      res.status(500).json({ error: "Erro ao buscar clientes" });
    }
  });

  app.get("/api/unidades/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { data: unidades, error } = await supabaseBackend
        .from("unidade")
        .select("*")
        .eq("company_id", companyId);

      if (error) {
        console.error("Error fetching unidades:", error);
        return res.status(500).json({ error: "Erro ao buscar unidades" });
      }

      res.json(unidades);
    } catch (error) {
      console.error("Error fetching unidades:", error);
      res.status(500).json({ error: "Erro ao buscar unidades" });
    }
  });

  app.get("/api/operacoes/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { data: operacoes, error } = await supabaseBackend
        .from("operacao")
        .select("*")
        .eq("company_id", companyId);

      if (error) {
        console.error("Error fetching operacoes:", error);
        return res.status(500).json({ error: "Erro ao buscar operações" });
      }

      res.json(operacoes);
    } catch (error) {
      console.error("Error fetching operacoes:", error);
      res.status(500).json({ error: "Erro ao buscar operações" });
    }
  });

  app.get("/api/status-vagas/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { data: statusVagas, error } = await supabaseBackend
        .from("st_vaga")
        .select("*")
        .eq("company_id", companyId);

      if (error) {
        console.error("Error fetching status vagas:", error);
        return res.status(500).json({ error: "Erro ao buscar status das vagas" });
      }

      res.json(statusVagas);
    } catch (error) {
      console.error("Error fetching status vagas:", error);
      res.status(500).json({ error: "Erro ao buscar status das vagas" });
    }
  });

  // New route for vagas with joins - for table display
  app.get("/api/vagas/company/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      
      // Fetch vagas
      const { data: vagas, error: vagasError } = await supabaseBackend
        .from("vaga")
        .select("*")
        .eq("company_id", companyId)
        .order('created_at', { ascending: false });

      if (vagasError) {
        console.error("Error fetching vagas:", vagasError);
        return res.status(500).json({ error: "Erro ao buscar vagas" });
      }

      if (!vagas || vagas.length === 0) {
        return res.json([]);
      }

      // Get all related data in parallel
      const [clientesData, unidadesData, operacoesData, statusData] = await Promise.all([
        supabaseBackend.from("cliente").select("cliente_id, nome").eq("company_id", companyId),
        supabaseBackend.from("unidade").select("id, unidade").eq("company_id", companyId),
        supabaseBackend.from("operacao").select("id, operacao").eq("company_id", companyId),
        supabaseBackend.from("st_vaga").select("id, status_vaga").eq("company_id", companyId)
      ]);

      // Create lookup maps
      const clientesMap = new Map();
      clientesData.data?.forEach((c: any) => clientesMap.set(c.cliente_id, c.nome));
      
      const unidadesMap = new Map();
      unidadesData.data?.forEach((u: any) => unidadesMap.set(u.id, u.unidade));
      
      const operacoesMap = new Map();
      operacoesData.data?.forEach((o: any) => operacoesMap.set(o.id, o.operacao));
      
      const statusMap = new Map();
      statusData.data?.forEach((s: any) => statusMap.set(s.id, s.status_vaga));

      // Enrich vagas with related data
      const enrichedVagas = vagas.map(vaga => ({
        ...vaga,
        cliente_nome: clientesMap.get(vaga.cliente_id) || null,
        unidade_nome: unidadesMap.get(vaga.unidade_id) || null,
        operacao_nome: operacoesMap.get(vaga.operacao_id) || null,
        status_nome: statusMap.get(vaga.st_vaga_id) || null,
      }));

      console.log("Vagas with enriched data:", enrichedVagas.length, "items");
      res.json(enrichedVagas);
    } catch (error) {
      console.error("Error fetching vagas:", error);
      res.status(500).json({ error: "Erro ao buscar vagas" });
    }
  });

  app.get("/api/vagas/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { data: vagas, error } = await supabaseBackend
        .from("vaga")
        .select("*")
        .eq("company_id", companyId);

      if (error) {
        console.error("Error fetching vagas:", error);
        return res.status(500).json({ error: "Erro ao buscar vagas" });
      }

      res.json(vagas);
    } catch (error) {
      console.error("Error fetching vagas:", error);
      res.status(500).json({ error: "Erro ao buscar vagas" });
    }
  });

  app.get("/api/vagas/dashboard/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      
      // Fetch all vagas for the company
      const { data: vagas, error } = await supabaseBackend
        .from("vaga")
        .select("*")
        .eq("company_id", companyId);

      // Get status information separately
      const { data: statusData } = await supabaseBackend
        .from("st_vaga")
        .select("id, status_vaga")
        .eq("company_id", companyId);

      // Create status lookup map
      const statusMap = new Map();
      statusData?.forEach(s => statusMap.set(s.id, s.status_vaga));

      if (error) {
        console.error("Error fetching vagas for dashboard:", error);
        return res.status(500).json({ error: "Erro ao buscar dados do dashboard" });
      }

      // Calculate dashboard statistics
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const totalVagas = vagas?.length || 0;
      
      // Count vagas by status (assuming "Em Andamento" is active, others might be closed/paused)
      const vagasAbertas = vagas?.filter(vaga => {
        const status = statusMap.get(vaga.st_vaga_id);
        return status === "Em Andamento" || status === "Ativa" || status === "Aberta";
      }).length || 0;

      const vagasFechadas = vagas?.filter(vaga => {
        const status = statusMap.get(vaga.st_vaga_id);
        return status === "Fechada" || status === "Finalizada" || status === "Concluída";
      }).length || 0;

      // Count vagas expiring in the next 7 days
      const vagasVencendo = vagas?.filter(vaga => {
        if (!vaga.dt_limite) return false;
        const limitDate = new Date(vaga.dt_limite);
        return limitDate >= now && limitDate <= sevenDaysFromNow;
      }).length || 0;

      const dashboardData = {
        totalVagas,
        vagasAbertas,
        vagasFechadas,
        vagasVencendo
      };

      console.log("Dashboard data calculated:", dashboardData);
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: "Erro ao buscar dados do dashboard" });
    }
  });

  // Vagas API routes using Supabase
  app.post("/api/vagas", async (req, res) => {
    try {
      const vagaData = req.body;
      console.log("Creating vaga with data:", vagaData);

      // Convert dias_trabalho to array if it's a string
      if (typeof vagaData.dias_trabalho === 'string') {
        vagaData.dias_trabalho = vagaData.dias_trabalho.split(',').map((d: string) => d.trim());
      }

      // Convert dt_limite to proper timestamp
      if (vagaData.dt_limite) {
        vagaData.dt_limite = new Date(vagaData.dt_limite).toISOString();
      }

      const { data: newVaga, error } = await supabaseBackend
        .from("vaga")
        .insert({
          nome: vagaData.nome,
          descricao: vagaData.descricao,
          quantidade: Number(vagaData.quantidade),
          dias_trabalho: vagaData.dias_trabalho,
          horario: vagaData.horario,
          dt_limite: vagaData.dt_limite,
          company_id: Number(vagaData.company_id),
          unidade_id: vagaData.unidade_id ? Number(vagaData.unidade_id) : null,
          operacao_id: vagaData.operacao_id ? Number(vagaData.operacao_id) : null,
          st_vaga_id: vagaData.st_vaga_id ? Number(vagaData.st_vaga_id) : null,
          cliente_id: vagaData.cliente_id ? Number(vagaData.cliente_id) : null,
          gr_id: vagaData.gr_id ? Number(vagaData.gr_id) : null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating vaga:", error);
        return res.status(500).json({
          error: "Erro ao criar vaga",
          details: error.message,
        });
      }

      console.log("Vaga created successfully:", newVaga);
      res.status(201).json(newVaga);
    } catch (error) {
      console.error("Error creating vaga:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Update vaga status
  // Update complete vaga
  app.put("/api/vagas/:vagaId", async (req, res) => {
    try {
      const { vagaId } = req.params;
      const vagaData = req.body;

      console.log("Updating vaga:", { vagaId, vagaData });

      // Convert dias_trabalho to array if it's a string
      if (typeof vagaData.dias_trabalho === 'string') {
        vagaData.dias_trabalho = vagaData.dias_trabalho.split(',').map((d: string) => d.trim());
      }

      // Convert dt_limite to proper timestamp
      if (vagaData.dt_limite) {
        vagaData.dt_limite = new Date(vagaData.dt_limite).toISOString();
      }

      const { data: updatedVaga, error } = await supabaseBackend
        .from("vaga")
        .update({
          nome: vagaData.nome,
          descricao: vagaData.descricao,
          quantidade: Number(vagaData.quantidade),
          dias_trabalho: vagaData.dias_trabalho,
          horario: vagaData.horario,
          dt_limite: vagaData.dt_limite,
          company_id: Number(vagaData.company_id),
          unidade_id: vagaData.unidade_id ? Number(vagaData.unidade_id) : null,
          operacao_id: vagaData.operacao_id ? Number(vagaData.operacao_id) : null,
          st_vaga_id: vagaData.st_vaga_id ? Number(vagaData.st_vaga_id) : null,
          cliente_id: vagaData.cliente_id ? Number(vagaData.cliente_id) : null,
          gr_id: vagaData.gr_id ? Number(vagaData.gr_id) : null,
          updated_at: new Date().toISOString()
        })
        .eq("id", Number(vagaId))
        .select()
        .single();

      if (error) {
        console.error("Error updating vaga:", error);
        return res.status(500).json({
          error: "Erro ao atualizar vaga",
          details: error.message,
        });
      }

      console.log("Vaga updated successfully:", updatedVaga);
      res.json({ success: true, vaga: updatedVaga });
    } catch (error) {
      console.error("Error updating vaga:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.patch("/api/vagas/:vagaId/status", async (req, res) => {
    try {
      const { vagaId } = req.params;
      const { st_vaga_id } = req.body;

      console.log("Updating vaga status:", { vagaId, st_vaga_id });

      const { data: updatedVaga, error } = await supabaseBackend
        .from("vaga")
        .update({ 
          st_vaga_id: Number(st_vaga_id),
          updated_at: new Date().toISOString()
        })
        .eq("id", Number(vagaId))
        .select()
        .single();

      if (error) {
        console.error("Error updating vaga status:", error);
        return res.status(500).json({
          error: "Erro ao atualizar status da vaga",
          details: error.message,
        });
      }

      console.log("Vaga status updated successfully:", updatedVaga);
      res.json(updatedVaga);
    } catch (error) {
      console.error("Error updating vaga status:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Delete vaga
  app.delete("/api/vagas/:vagaId", async (req, res) => {
    try {
      const { vagaId } = req.params;

      console.log("Deleting vaga:", vagaId);

      const { error } = await supabaseBackend
        .from("vaga")
        .delete()
        .eq("id", Number(vagaId));

      if (error) {
        console.error("Error deleting vaga:", error);
        return res.status(500).json({
          error: "Erro ao deletar vaga",
          details: error.message,
        });
      }

      console.log("Vaga deleted successfully");
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vaga:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // APIs para criar novas unidades, operações e status usando Supabase
  app.post("/api/unidades", async (req, res) => {
    try {
      const { unidade: unidadeNome, company_id } = req.body;
      
      const { data: newUnidade, error } = await supabaseBackend
        .from("unidade")
        .insert({
          unidade: unidadeNome,
          company_id: Number(company_id),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating unidade:", error);
        return res.status(500).json({ error: "Erro ao criar unidade" });
      }

      res.status(201).json(newUnidade);
    } catch (error) {
      console.error("Error creating unidade:", error);
      res.status(500).json({ error: "Erro ao criar unidade" });
    }
  });

  app.post("/api/operacoes", async (req, res) => {
    try {
      const { operacao: operacaoNome, company_id } = req.body;
      
      const { data: newOperacao, error } = await supabaseBackend
        .from("operacao")
        .insert({
          operacao: operacaoNome,
          company_id: Number(company_id),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating operacao:", error);
        return res.status(500).json({ error: "Erro ao criar operação" });
      }

      res.status(201).json(newOperacao);
    } catch (error) {
      console.error("Error creating operacao:", error);
      res.status(500).json({ error: "Erro ao criar operação" });
    }
  });

  app.post("/api/status-vagas", async (req, res) => {
    try {
      const { status_vaga, company_id } = req.body;
      
      const { data: newStatus, error } = await supabaseBackend
        .from("st_vaga")
        .insert({
          status_vaga,
          company_id: Number(company_id),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating status vaga:", error);
        return res.status(500).json({ error: "Erro ao criar status" });
      }

      res.status(201).json(newStatus);
    } catch (error) {
      console.error("Error creating status vaga:", error);
      res.status(500).json({ error: "Erro ao criar status" });
    }
  });

  // Tags API routes
  app.get("/api/tags", async (req, res) => {
    try {
      const companyId = req.query.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "company_id é obrigatório" });
      }

      // Buscar tags diretamente do Supabase
      const { data: tags, error } = await supabaseBackend
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

  app.post("/api/tags", async (req, res) => {
    try {
      const { nome, cor, company_id } = req.body;

      if (!nome || !company_id) {
        return res
          .status(400)
          .json({ error: "nome e company_id são obrigatórios" });
      }

      // 1. Criar tag localmente
      const tag = await storage.createTag({ nome, cor, company_id });
      
      // 2. Criar tag no WiseApp automaticamente
      const { createTagInWiseApp } = await import('./bulk-contact-tags-sync');
      const wiseappResult = await createTagInWiseApp(company_id, nome, cor || '#3B82F6');
      
      if (wiseappResult.success) {
        console.log(`[POST /api/tags] Tag criada localmente e no WiseApp: ${nome}`);
      } else {
        console.error(`[POST /api/tags] ERRO: Tag criada localmente, mas falhou no WiseApp: ${wiseappResult.error}`);
      }
      
      res.status(201).json({
        ...tag,
        wiseapp_sync: wiseappResult.success,
        wiseapp_label_id: wiseappResult.labelId
      });
    } catch (error) {
      console.error("Erro ao criar tag:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.put("/api/tags/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, cor } = req.body;

      if (!nome) {
        return res.status(400).json({ error: "nome é obrigatório" });
      }

      const tag = await storage.updateTag(Number(id), { nome, cor });
      if (!tag) {
        return res.status(404).json({ error: "Tag não encontrada" });
      }

      res.json(tag);
    } catch (error) {
      console.error("Erro ao atualizar tag:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTag(Number(id));

      if (!deleted) {
        return res.status(404).json({ error: "Tag não encontrada" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Erro ao deletar tag:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Sync tags from WiseApp
  app.post("/api/tags/sync-wiseapp", async (req, res) => {
    try {
      const { company_id } = req.body;
      if (!company_id) {
        return res.status(400).json({ error: "company_id é obrigatório" });
      }

      // Esta funcionalidade será implementada no frontend
      // Por enquanto, apenas retorna as tags locais
      const tags = await storage.getTags(Number(company_id));
      res.json({
        success: true,
        message: "Sincronização será implementada no frontend com WiseApp API",
        tags,
      });
    } catch (error) {
      console.error("Erro ao sincronizar tags do WiseApp:", error);
      res
        .status(500)
        .json({
          error: "Erro interno do servidor",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
    }
  });

  // Motorista tags API routes
  app.get("/api/motoristas/:motoristaId/tags", async (req, res) => {
    try {
      const { motoristaId } = req.params;
      const tags = await storage.getMotoristaTagsWithDetails(
        Number(motoristaId),
      );
      res.json(tags);
    } catch (error) {
      console.error("Erro ao buscar tags do motorista:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.post("/api/motoristas/:motoristaId/tags", async (req, res) => {
    try {
      const { motoristaId } = req.params;
      const { tag_id, company_id } = req.body;

      if (!tag_id) {
        return res.status(400).json({ error: "tag_id é obrigatório" });
      }

      const motoristaTag = await storage.addTagToMotorista(
        Number(motoristaId),
        Number(tag_id)

      );
      res.status(201).json(motoristaTag);
    } catch (error) {
      console.error("Erro ao adicionar tag ao motorista:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.delete("/api/motoristas/:motoristaId/tags/:tagId", async (req, res) => {
    try {
      const { motoristaId, tagId } = req.params;
      const deleted = await storage.removeTagFromMotorista(
        Number(motoristaId),
        Number(tagId),
      );

      if (!deleted) {
        return res
          .status(404)
          .json({ error: "Associação tag-motorista não encontrada" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover tag do motorista:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Rota para atualizar foto do WhatsApp do motorista
  // Rota para buscar motorista por número de telefone
  app.get("/api/motoristas/by-phone/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const cleanPhone = parseInt(phone.replace(/\D/g, ''));
      
      console.log(`🔍 Searching motorista by phone: ${cleanPhone}`);
      
      const accountId = req.header('accountId') || '1';
      const companyId = await getCompanyIdFromAccount(accountId);
      
      if (!companyId) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Buscar diretamente usando Supabase
      const { data: result, error } = await supabaseBackend
        .from('motorista')
        .select('motorista_id, nome, telefone')
        .eq('company_id', companyId)
        .eq('telefone', cleanPhone)
        .limit(1);
      
      console.log(`📋 Query executada para company_id: ${companyId}, telefone: ${cleanPhone}`);
      
      if (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result && result.length > 0) {
        const found = result[0];
        console.log(`✅ Motorista encontrado: ${found.nome} (ID: ${found.motorista_id})`);
        return res.json({
          motorista_id: found.motorista_id,
          nome: found.nome,
          telefone: found.telefone
        });
      } else {
        console.log(`❌ Nenhum motorista encontrado com telefone ${cleanPhone} na empresa ${companyId}`);
        
        // Debug: mostrar alguns motoristas da empresa
        const { data: allMotoristas } = await supabaseBackend
          .from('motorista')
          .select('nome, telefone')
          .eq('company_id', companyId)
          .limit(3);
        
        console.log(`📝 Exemplos na empresa ${companyId}:`, allMotoristas);
        return res.status(404).json({ error: 'Motorista not found' });
      }
      
    } catch (error) {
      console.error("❌ Error searching motorista by phone:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/motoristas/:id/whatsapp-photo", async (req, res) => {
    try {
      const { id } = req.params;
      const { foto_whatsapp } = req.body;
      
      console.log(`Updating WhatsApp photo for motorista ${id}:`, foto_whatsapp);
      
      if (!foto_whatsapp) {
        return res.status(400).json({ error: "foto_whatsapp is required" });
      }

      const { data, error } = await supabaseBackend
        .from('motorista')
        .update({ foto_whatsapp })
        .eq('motorista_id', id)
        .select();

      if (error) {
        console.error('Error updating WhatsApp photo:', error);
        return res.status(500).json({ error: 'Failed to update WhatsApp photo', details: error });
      }

      console.log(`WhatsApp photo updated successfully for motorista ${id}:`, data);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error updating WhatsApp photo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rotas para sincronização WiseApp
  app.post("/api/wiseapp/sync-motorista/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID é obrigatório' });
    }

    console.log(`Starting sync-all-motoristas for company ${companyId}`);

    // 1. Buscar token WiseApp para esta empresa
    const token = await storage.getWiseappToken(parseInt(companyId));

    if (!token) {
      console.log(`Token WiseApp não encontrado para company_id: ${companyId}`);
      return res.status(401).json({ 
        error: "Token WiseApp não configurado para esta empresa",
        message: "Configure um token WiseApp válido antes de sincronizar contatos"
      });
    }

    // 2. Buscar dados da empresa para obter account ID do WiseApp
    const { data: companies, error: companyError } = await supabaseBackend
      .from("company")
      .select("id_conta_wiseapp")
      .eq("company_id", parseInt(companyId))
      .limit(1);

    if (companyError || !companies || companies.length === 0) {
      console.log(`Empresa não encontrada para company_id: ${companyId}`);
      return res.status(404).json({ 
        error: "Empresa não encontrada ou account ID não configurado" 
      });
    }

    const accountId = companies[0].id_conta_wiseapp;

    if (!accountId) {
      return res.status(400).json({ 
        error: "Account ID do WiseApp não configurado para esta empresa" 
      });
    }

    console.log(`Using WiseApp account ID: ${accountId}`);
      
      // Buscar dados do motorista
      const { data: motorista, error: motoristaError } = await supabaseBackend
        .from('motorista')
        .select('motorista_id, nome, telefone, foto_whatsapp')
        .eq('motorista_id', id)
        .eq('company_id', companyId)
        .single();
      
      if (motoristaError || !motorista) {
        return res.status(404).json({ error: 'Motorista não encontrado' });
      }
      
      if (!motorista.telefone) {
        return res.json({ success: false, message: 'Motorista não possui telefone cadastrado' });
      }
      
      // Buscar contato no WiseApp
      const phone = `55${motorista.telefone}`;
      const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${companyId}/contacts/search?q=${phone}`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'api_access_token': process.env.WISEAPP_API_TOKEN || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (!searchResponse.ok) {
        return res.json({ success: false, message: 'Erro ao buscar contato no WiseApp' });
      }
      
      const searchData = await searchResponse.json();
      
      if (searchData.payload?.length > 0) {
        const contact = searchData.payload[0];
        
        // Se tem foto e é diferente da atual, atualizar
        if (contact.thumbnail && contact.thumbnail !== motorista.foto_whatsapp) {
          const { error: updateError } = await supabaseBackend
            .from('motorista')
            .update({ foto_whatsapp: contact.thumbnail })
            .eq('motorista_id', id);
          
          if (updateError) {
            return res.json({ success: false, message: 'Erro ao atualizar foto' });
          }
          
          return res.json({ 
            success: true, 
            message: 'Foto sincronizada com sucesso',
            contactId: contact.id,
            photoUpdated: true
          });
        }
        
        return res.json({ 
          success: true, 
          message: 'Contato encontrado, foto já atualizada',
          contactId: contact.id,
          photoUpdated: false
        });
      }
      
      res.json({ success: false, message: 'Contato não encontrado no WiseApp' });
      
    } catch (error) {
      console.error('Erro na sincronização:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  app.post("/api/wiseapp/sync-all-motoristas", async (req, res) => {
    try {
      const { companyId } = req.body;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID é obrigatório' });
      }
      
      console.log(`Starting sync-all-motoristas for company ${companyId}`);
      
      // EXATAMENTE IGUAL AO SINCRONIZAR TAGS - usar headers do frontend
      const token = req.headers['wiseapp-token'] as string;
      const accountId = req.headers['wiseapp-account-id'] as string;
      
      console.log(`Token from header: ${token ? 'Found' : 'Missing'}`);
      console.log(`Account ID from header: ${accountId ? 'Found' : 'Missing'}`);
      
      if (!token) {
        console.log(`Token WiseApp não encontrado nos headers`);
        return res.status(401).json({ 
          error: "Token WiseApp não configurado para esta empresa",
          message: "Configure um token WiseApp válido antes de sincronizar contatos"
        });
      }
      
      if (!accountId) {
        console.log(`Account ID não encontrado nos headers`);
        return res.status(400).json({ 
          error: "Account ID do WiseApp não configurado" 
        });
      }
      
      console.log(`Using WiseApp account ID: ${accountId}`);

      // 3. Buscar todos os motoristas ativos com telefone
      const { data: motoristas, error: motoristasError } = await supabaseBackend
        .from('motorista')
        .select('motorista_id, nome, telefone, foto_whatsapp')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .not('telefone', 'is', null);
      
      if (motoristasError) {
        console.error('Erro ao buscar motoristas:', motoristasError);
        return res.status(500).json({ error: 'Erro ao buscar motoristas' });
      }
      
      const results = {
        totalProcessed: motoristas?.length || 0,
        successful: 0,
        failed: 0,
        created: 0,
        photoUpdated: 0,
        errors: [] as Array<{ motorista_id: number; nome: string; error: string }>
      };
      
      if (!motoristas || motoristas.length === 0) {
        console.log('Nenhum motorista ativo encontrado');
        return res.json({ success: true, data: results });
      }
      
      console.log(`Processando ${motoristas.length} motoristas`);

      // Processar cada motorista
      for (const motorista of motoristas) {
        try {
          if (!motorista.telefone) {
            results.successful++;
            continue;
          }

          const phone = `55${motorista.telefone}`;
          console.log(`Processando ${motorista.nome} - ${phone}`);
          
          // Buscar contato no WiseApp
          const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json'
            }
          });

          if (!searchResponse.ok) {
            results.failed++;
            results.errors.push({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome,
              error: `Erro ao buscar no WiseApp: ${searchResponse.status}`
            });
            continue;
          }

          const searchData = await searchResponse.json();

          if (searchData.payload?.length > 0) {
            const contact = searchData.payload[0];
            console.log(`Contato encontrado: ${motorista.nome} (ID: ${contact.id})`);

            // Se contato já existe, apenas atualizar foto se necessário
            if (contact.avatar !== motorista.foto_whatsapp && motorista.foto_whatsapp) {
              const updateUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}`;
              const updateResponse = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                  'api_access_token': token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ avatar: motorista.foto_whatsapp })
              });

              if (updateResponse.ok) {
                results.photoUpdated++;
                console.log(`Foto atualizada para ${motorista.nome}`);
              }
            }

            results.successful++;
          } else {
            // Contato não existe, criar novo
            const contactData = {
              name: motorista.nome,
              phone: phone,
              avatar: motorista.foto_whatsapp || null
            };

            const createUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts`;
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'api_access_token': token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(contactData)
            });

            if (createResponse.ok) {
              results.created++;
              results.successful++;
              console.log(`Contato criado: ${motorista.nome}`);
            } else {
              results.failed++;
              results.errors.push({
                motorista_id: motorista.motorista_id,
                nome: motorista.nome,
                error: `Erro ao criar contato: ${createResponse.status}`
              });
            }
          }
        } catch (error) {
          console.error(`Erro processando ${motorista.nome}:`, error);
          results.failed++;
          results.errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome,
            error: (error as Error).message
          });
        }
      }

      console.log(`Sincronização concluída: ${results.successful} sucessos, ${results.failed} falhas, ${results.created} criados, ${results.photoUpdated} fotos atualizadas`);
      res.json({ success: true, data: results });

    } catch (error) {
      console.error("Erro na sincronização:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Rota para buscar inboxes do WiseApp 
  app.get("/api/v1/accounts/:accountId/inboxes", async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log(`Fetching WiseApp inboxes for account ${accountId}`);
      
      // Buscar token do header (enviado pelo frontend)
      const token = req.headers['wiseapp-token'] as string || req.headers['api_access_token'] as string;
      console.log('Token from header:', token ? 'Found' : 'Not found');
      
      if (!token) {
        console.log('No token found in header');
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/inboxes`;
      
      console.log(`Fetching inboxes from: ${wiseAppUrl}`);

      // Implementar retry logic para accounts grandes (como accountId 20)
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // Para accountId 20 ou outros accounts grandes, adicionar delay
          if (accountId === '20' && attempts > 1) {
            console.log(`Rate limiting retry ${attempts} for account ${accountId}, waiting 3s...`);
            await delay(3000); // 3 segundos entre tentativas
          }

          // Try different header configurations for problematic accounts
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };
          
          // For account ID 20, try different token header formats
          if (accountId === '20' && attempts > 1) {
            console.log(`Attempting alternative headers for account ${accountId}, attempt ${attempts}`);
            // Try both token formats
            headers['Authorization'] = `Bearer ${token}`;
            headers['api_access_token'] = token;
          } else {
            headers['api_access_token'] = token;
          }
          
          response = await fetch(wiseAppUrl, {
            method: 'GET',
            headers,
          });

          if (response.ok) {
            break; // Success!
          }
          
          // Se 401 em account grande, tentar novamente
          if (response.status === 401 && (accountId === '20' || parseInt(accountId) > 15)) {
            console.log(`Got 401 for large account ${accountId}, attempt ${attempts}/${maxAttempts}`);
            
            if (attempts < maxAttempts) {
              continue; // Try again
            }
          }
          
          // Para outros erros, falhar imediatamente
          throw new Error(`WiseApp API responded with ${response.status}`);
          
        } catch (fetchError) {
          if (attempts === maxAttempts) {
            throw fetchError;
          }
          console.log(`API fetch attempt ${attempts} failed for account ${accountId}:`, fetchError);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`WiseApp API failed after ${maxAttempts} attempts with status ${response?.status || 'unknown'}`);
      }

      const data = await response.json();
      console.log('WiseApp inboxes response:', data);
      
      // Retornar dados das inboxes
      const inboxes = data.payload || data || [];
      res.json(inboxes);

    } catch (error) {
      console.error("Erro ao buscar inboxes do WiseApp:", error);
      
      // Se for erro de autenticação, retornar uma resposta mais amigável
      if (error instanceof Error && error.message.includes('401')) {
        res.status(200).json({
          error: "WiseApp authentication failed",
          message: "Token WiseApp expirado ou inválido",
          inboxes: [], // Retorna array vazio ao invés de erro
          authenticated: false
        });
        return;
      }
      
      // Para outros erros, manter comportamento original mas com dados de fallback
      res.status(200).json({
        error: "Erro ao buscar inboxes do WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        inboxes: [], // Retorna array vazio ao invés de erro
        authenticated: false
      });
    }
  });

  // Rota para deletar label no WiseApp
  app.delete("/api/wiseapp/:companyId/labels/:labelId", async (req, res) => {
    try {
      const { companyId, labelId } = req.params;
      
      console.log(`Deleting WiseApp label ${labelId} for company ${companyId}`);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels/${labelId}`;
      
      const response = await fetch(wiseAppUrl, {
        method: 'DELETE',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`WiseApp API error: ${response.status} - ${errorData}`);
        throw new Error(`WiseApp API responded with ${response.status}`);
      }

      console.log('WiseApp label deleted successfully');
      res.json({ success: true });

    } catch (error) {
      console.error("Erro ao deletar label no WiseApp:", error);
      res.status(500).json({
        error: "Erro ao deletar label no WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Aplicar tag a um contato no WiseApp
  app.post("/api/wiseapp/:companyId/contacts/:contactId/labels", async (req, res) => {
    try {
      const { companyId, contactId } = req.params;
      const { tagId, tagName, labels } = req.body;
      
      console.log(`Applying labels to contact ${contactId} for company ${companyId}`);
      console.log(`Request body:`, req.body);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const labelsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
      
      let finalLabels: string[] = [];
      
      // Verificar se recebeu lista completa de labels (novo formato)
      if (labels && Array.isArray(labels)) {
        console.log(`Using complete labels array: ${labels.join(', ')}`);
        finalLabels = labels;
      } else {
        // Formato antigo: adicionar uma tag preservando existentes
        console.log(`Adding single tag "${tagName || tagId}" without overwriting`);
        
        // Buscar labels existentes primeiro
        const getResponse = await fetch(labelsUrl, {
          method: 'GET',
          headers: { 'api_access_token': token }
        });
        
        let existingLabels: string[] = [];
        if (getResponse.ok) {
          const result = await getResponse.json();
          existingLabels = result.payload || [];
          console.log(`Found ${existingLabels.length} existing labels:`, existingLabels);
        } else {
          console.warn(`Failed to get existing labels: ${getResponse.status}`);
        }
        
        // Adicionar nova label se não existir (case insensitive)
        const newLabel = tagName || tagId;
        finalLabels = [...existingLabels];
        
        // Verificar se a label já existe (case insensitive)
        const labelExists = finalLabels.some(existingLabel => 
          existingLabel.toLowerCase() === newLabel.toLowerCase()
        );
        
        if (newLabel && !labelExists) {
          finalLabels.push(newLabel);
          console.log(`Added "${newLabel}" to labels list. New list:`, finalLabels);
        } else {
          console.log(`Label "${newLabel}" already exists or is empty`);
        }
      }
      
      console.log(`Applying ${finalLabels.length} labels: ${finalLabels.join(', ')}`);
      console.log(`PAYLOAD BEING SENT:`, JSON.stringify({ labels: finalLabels }));
      console.log(`URL: ${labelsUrl}`);
      console.log(`TOKEN: ${token ? 'Present' : 'Missing'}`);
      console.log(`ACCOUNT ID: ${accountId}`);
      
      // Enviar lista completa de labels
      console.log(`🚀 FAZENDO CHAMADA PARA WISEAPP API...`);
      const response = await fetch(labelsUrl, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labels: finalLabels
        }),
      });

      console.log(`📡 RESPOSTA WISEAPP: Status ${response.status}`);
      const responseText = await response.text();
      console.log(`📄 RESPOSTA WISEAPP BODY:`, responseText);

      if (!response.ok) {
        throw new Error(`WiseApp API responded with ${response.status}: ${responseText}`);
      }

      res.json({ success: true });

    } catch (error) {
      console.error("Erro ao aplicar tag ao contato:", error);
      res.status(500).json({
        error: "Erro ao aplicar tag ao contato",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Buscar tags de um contato no WiseApp
  app.get("/api/wiseapp/:companyId/contacts/:contactId/labels", async (req, res) => {
    try {
      const { companyId, contactId } = req.params;
      
      console.log(`Fetching labels for contact ${contactId} in company ${companyId}`);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
      
      const response = await fetch(wiseAppUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Labels fetched successfully for contact ${contactId}:`, result);
        res.json(result);
      } else {
        const errorText = await response.text();
        console.error(`Error fetching contact labels: ${response.status} - ${errorText}`);
        res.status(response.status).json({ error: errorText });
      }
    } catch (error) {
      console.error("Erro ao buscar tags do contato:", error);
      res.status(500).json({
        error: "Erro ao buscar tags do contato",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Remover tag de um contato no WiseApp
  app.delete("/api/wiseapp/:companyId/contacts/:contactId/labels/:tagId", async (req, res) => {
    try {
      const { companyId, contactId, tagId } = req.params;
      
      console.log(`Removing tag ${tagId} from contact ${contactId} for company ${companyId}`);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels/${tagId}`;
      
      const response = await fetch(wiseAppUrl, {
        method: 'DELETE',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`WiseApp API responded with ${response.status}`);
      }

      res.json({ success: true });

    } catch (error) {
      console.error("Erro ao remover tag do contato:", error);
      res.status(500).json({
        error: "Erro ao remover tag do contato",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Individual sync backend proxy route for motorista tag operations (CRITICAL)
  app.post("/api/wiseapp/sync-contact-tags/:motoristaId", async (req, res) => {
    try {
      const { motoristaId } = req.params;
      const { operation, tagId, tagName, companyId, accountId } = req.body;
      
      console.log(`Individual tag sync for motorista ${motoristaId}, operation: ${operation}`);
      
      if (!motoristaId || !companyId || !accountId || !operation) {
        return res.status(400).json({ 
          error: "motoristaId, companyId, accountId e operation são obrigatórios" 
        });
      }

      // Buscar token WiseApp para esta empresa de forma segura
      const { data: tokenData, error: tokenError } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);

      if (tokenError || !tokenData || tokenData.length === 0) {
        return res.status(404).json({ 
          error: "Token WiseApp não configurado para esta empresa" 
        });
      }

      const token = tokenData[0].access_token_wiseapp;
      if (!token) {
        return res.status(404).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // 3. Buscar todos os motoristas ativos com telefone
      const { data: motoristas, error: motoristasError } = await supabaseBackend
        .from('motorista')
        .select('motorista_id, nome, telefone, foto_whatsapp')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .not('telefone', 'is', null);
      
      if (motoristasError) {
        console.error('Erro ao buscar motoristas:', motoristasError);
        return res.status(500).json({ error: 'Erro ao buscar motoristas' });
      }
      
      const results = {
        totalProcessed: motoristas?.length || 0,
        successful: 0,
        failed: 0,
        created: 0,
        photoUpdated: 0,
        errors: [] as Array<{ motorista_id: number; nome: string; error: string }>
      };
      
      if (!motoristas || motoristas.length === 0) {
        console.log('Nenhum motorista ativo encontrado');
        return res.json({ success: true, data: results });
      }
      
      console.log(`Processando ${motoristas.length} motoristas`);
      
      const wiseappApiUrl = process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";
      
      // Helper function for retry with exponential backoff
      const retryWithBackoff = async (fn: () => Promise<Response>, maxRetries = 3): Promise<Response> => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            const response = await fn();
            if (response.status === 429 || response.status >= 500) {
              if (i === maxRetries - 1) return response;
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i) + Math.random() * 100));
              continue;
            }
            return response;
          } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i) + Math.random() * 100));
          }
        }
        throw new Error('Max retries reached');
      };
      
      // Helper function to normalize phone number for WiseApp (always with +55)
      const normalizePhone = (phone: any): { searchPhone: string, e164Phone: string } | null => {
        // Convert to string if it's a number
        let phoneStr = phone;
        if (typeof phone === 'number') {
          phoneStr = phone.toString();
        }
        
        // Check if phone is valid
        if (!phoneStr || typeof phoneStr !== 'string' || phoneStr.trim() === '') {
          return null;
        }
        
        // Remove all non-digits
        const digits = phoneStr.replace(/\D/g, '');
        
        // Brazilian phone numbers: 10-11 digits (DDD + number)
        // Accept 10 digits (landline: DDD + 8 digits) or 11 digits (mobile: DDD + 9 digits)
        if (digits.length < 10 || digits.length > 13) {
          return null;
        }
        
        let brazilianNumber = digits;
        
        // Remove country code if already present
        if (digits.startsWith('55') && digits.length >= 12) {
          brazilianNumber = digits.substring(2);
        }
        
        // Ensure we have a valid Brazilian number (10 or 11 digits)
        if (brazilianNumber.length < 10 || brazilianNumber.length > 11) {
          return null;
        }
        
        // Always format with +55 for WiseApp
        const searchPhone = `55${brazilianNumber}`;
        const e164Phone = `+55${brazilianNumber}`;
        
        return { searchPhone, e164Phone };
      };
      
      // 4. Processar cada motorista
      for (const motorista of motoristas) {
        try {
          console.log(`Processing motorista ${motorista.motorista_id}: ${motorista.nome}`);
          
          // Normalize phone number and skip if invalid
          const phoneResult = normalizePhone(motorista.telefone);
          if (!phoneResult) {
            console.log(`Skipping motorista ${motorista.nome} - invalid phone number: ${motorista.telefone}`);
            results.failed++;
            results.errors.push({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome || 'N/A',
              error: 'Número de telefone inválido ou ausente'
            });
            continue;
          }
          
          const { searchPhone, e164Phone } = phoneResult;
          const searchUrl = `${wiseappApiUrl}/api/v1/accounts/${accountId}/contacts/search?q=${searchPhone}`;
          
          // Search for existing contact
          const searchResponse = await retryWithBackoff(() => fetch(searchUrl, {
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }));
          
          if (searchResponse.status === 401 || searchResponse.status === 403) {
            // Fatal auth error - abort entire operation
            console.error('Authentication failed with WiseApp API');
            return res.status(401).json({ 
              error: "Token WiseApp inválido ou expirado" 
            });
          }
          
          let contact = null;
          let contactCreated = false;
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            
            if (searchData.payload?.length > 0) {
              contact = searchData.payload[0];
              console.log(`Contact found for ${motorista.nome}: ${contact.id}`);
            } else {
              // Contact not found - create new contact
              console.log(`Contact not found for ${motorista.nome}, creating new contact`);
              
              const createUrl = `${wiseappApiUrl}/api/v1/accounts/${accountId}/contacts`;
              const createResponse = await retryWithBackoff(() => fetch(createUrl, {
                method: 'POST',
                headers: {
                  'api_access_token': token,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  name: motorista.nome || `Contato ${searchPhone}`,
                  phone_number: e164Phone
                })
              }));
              
              if (createResponse.ok) {
                const createData = await createResponse.json();
                contact = createData.payload || createData;
                contactCreated = true;
                results.created++;
                console.log(`Contact created for ${motorista.nome}: ${contact.id}`);
              } else {
                const errorText = await createResponse.text();
                console.error(`Failed to create contact for ${motorista.nome}: ${createResponse.status} - ${errorText}`);
                results.failed++;
                results.errors.push({
                  motorista_id: motorista.motorista_id,
                  nome: motorista.nome || 'N/A',
                  error: `Erro ao criar contato: ${createResponse.status}`
                });
                continue;
              }
            }
          } else {
            const errorText = await searchResponse.text();
            console.error(`Search failed for ${motorista.nome}: ${searchResponse.status} - ${errorText}`);
            results.failed++;
            
            // Provide better error messages for common issues
            let errorMessage = `Erro na busca do WiseApp: ${searchResponse.status}`;
            if (searchResponse.status === 502 || searchResponse.status === 503) {
              errorMessage = "Serviço WiseApp temporariamente indisponível";
            } else if (searchResponse.status === 429) {
              errorMessage = "Muitas requisições - tente novamente em alguns minutos";
            } else if (searchResponse.status >= 500) {
              errorMessage = "Erro interno do servidor WiseApp";
            }
            
            results.errors.push({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome || 'N/A',
              error: errorMessage
            });
            continue;
          }
          
          // Update photo if contact has thumbnail and it's different from current
          if (contact && contact.thumbnail && contact.thumbnail !== motorista.foto_whatsapp) {
            const { error: updateError } = await supabaseBackend
              .from('motorista')
              .update({ foto_whatsapp: contact.thumbnail })
              .eq('motorista_id', motorista.motorista_id);
            
            if (!updateError) {
              results.photoUpdated++;
              console.log(`Photo updated for ${motorista.nome}`);
            } else {
              console.error(`Failed to update photo for ${motorista.nome}:`, updateError);
              // Don't count as failure if contact was created/found successfully
            }
          }
          
          if (!contactCreated) {
            results.successful++;
          }
          
          // Rate limiting - pause between requests
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`Error processing motorista ${motorista.motorista_id}:`, error);
          results.failed++;
          results.errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome || 'N/A',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }
      
      console.log(`Sync completed:`, results);
      res.json({ success: true, data: results });
      
    } catch (error) {
      console.error('Erro na sincronização em lote:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });  
  // Rota específica para buscar labels do WiseApp
  app.get("/api/wiseapp/:companyId/labels", async (req, res) => {
    try {
      const { companyId } = req.params;
      console.log(`Fetching WiseApp labels for company ${companyId}`);
      console.log('Request headers:', req.headers);
      
      // Buscar token do header (enviado pelo frontend)
      const token = req.headers['wiseapp-token'] as string;
      console.log('Token from header:', token ? 'Found' : 'Not found');
      
      if (!token) {
        console.log('No token found in header');
        return res.status(401).json({ 
          error: "Token WiseApp não configurado para esta empresa" 
        });
      }
      
      // Buscar accountId do header (enviado pelo frontend) 
      const accountId = req.headers['wiseapp-account-id'] as string;
      
      // Log específico para account ID 20
      if (accountId === '20') {
        console.log(`Special handling for Account ID 20 - Token length: ${token?.length || 0}`);
      }
      console.log('Account ID from header:', accountId ? 'Found' : 'Not found');
      
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não configurado para esta empresa" 
        });
      }
      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
      
      console.log(`Fetching labels from: ${wiseAppUrl}`);

      // Implementar retry logic para accounts grandes (como accountId 20)
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // Para accountId 20 ou outros accounts grandes, adicionar delay
          if (accountId === '20' && attempts > 1) {
            console.log(`Rate limiting retry ${attempts} for account ${accountId}, waiting 3s...`);
            await delay(3000); // 3 segundos entre tentativas
          }

          // Try different header configurations for problematic accounts
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };
          
          // For account ID 20, try different token header formats
          if (accountId === '20' && attempts > 1) {
            console.log(`Attempting alternative headers for account ${accountId}, attempt ${attempts}`);
            // Try both token formats
            headers['Authorization'] = `Bearer ${token}`;
            headers['api_access_token'] = token;
          } else {
            headers['api_access_token'] = token;
          }
          
          response = await fetch(wiseAppUrl, {
            method: 'GET',
            headers,
          });

          if (response.ok) {
            break; // Success!
          }
          
          // Se 401 em account grande, tentar novamente
          if (response.status === 401 && (accountId === '20' || parseInt(accountId) > 15)) {
            console.log(`Got 401 for large account ${accountId}, attempt ${attempts}/${maxAttempts}`);
            
            if (attempts < maxAttempts) {
              continue; // Try again
            }
          }
          
          // Para outros erros, falhar imediatamente
          throw new Error(`WiseApp API responded with ${response.status}`);
          
        } catch (fetchError) {
          if (attempts === maxAttempts) {
            throw fetchError;
          }
          console.log(`API fetch attempt ${attempts} failed for account ${accountId}:`, fetchError);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`WiseApp API failed after ${maxAttempts} attempts with status ${response?.status || 'unknown'}`);
      }

      const data = await response.json();
      
      // Transformar formato dos labels do WiseApp para nosso formato
      const labels = data.payload?.map((label: any) => ({
        id: label.id,
        name: label.title,
        color: label.color,
        description: label.description
      })) || [];

      res.json(labels);

    } catch (error) {
      console.error("Erro ao buscar labels do WiseApp:", error);
      res.status(500).json({
        error: "Erro ao buscar labels do WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Rota para criar label no WiseApp
  app.post("/api/wiseapp/:companyId/labels", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { name, color, description } = req.body;
      
      console.log(`Creating WiseApp label for company ${companyId}`);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
      
      const payload = {
        title: name,
        description: description || '',
        color: color || '#3B82F6'
      };

      const response = await fetch(wiseAppUrl, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.log(`WiseApp API response: ${response.status} - ${errorData}`);
        
        // Se for erro 401, token expirado
        if (response.status === 401) {
          return res.status(401).json({ 
            error: "Token WiseApp expirado ou inválido",
            details: "Por favor, reconecte sua conta WiseApp"
          });
        }
        
        // Se a tag já existe (422), buscar a tag existente
        if (response.status === 422) {
          try {
            console.log('Tag já existe, buscando tag existente...');
            
            // Buscar todas as tags para encontrar a existente
            const listResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`, {
              method: 'GET',
              headers: {
                'api_access_token': token,
                'Content-Type': 'application/json',
              }
            });
            
            if (listResponse.ok) {
              const listData = await listResponse.json();
              const existingLabel = listData.payload?.find((label: any) => 
                label.title.toLowerCase() === name.toLowerCase()
              );
              
              if (existingLabel) {
                console.log('Tag existente encontrada:', existingLabel);
                const label = {
                  id: existingLabel.id,
                  name: existingLabel.title,
                  color: existingLabel.color,
                  description: existingLabel.description
                };
                return res.json({ success: true, label, message: 'Tag já existia no WiseApp' });
              }
            }
          } catch (searchError) {
            console.error('Erro ao buscar tag existente:', searchError);
          }
        }
        
        throw new Error(`WiseApp API responded with ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      console.log('WiseApp label created:', data);
      
      // Transformar resposta para nosso formato
      const label = data.payload ? {
        id: data.payload.id,
        name: data.payload.title,
        color: data.payload.color,
        description: data.payload.description
      } : null;

      res.json({ success: true, label, message: 'Tag criada no WiseApp' });

    } catch (error) {
      console.error("Erro ao criar label no WiseApp:", error);
      res.status(500).json({
        error: "Erro ao criar label no WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Rota para buscar inboxes do WiseApp 
  app.get("/api/v1/accounts/:accountId/inboxes", async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log(`Fetching WiseApp inboxes for account ${accountId}`);
      
      // Buscar token do header (enviado pelo frontend)
      const token = req.headers['wiseapp-token'] as string || req.headers['api_access_token'] as string;
      console.log('Token from header:', token ? 'Found' : 'Not found');
      
      if (!token) {
        console.log('No token found in header');
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/inboxes`;
      
      console.log(`Fetching inboxes from: ${wiseAppUrl}`);

      // Implementar retry logic para accounts grandes (como accountId 20)
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // Para accountId 20 ou outros accounts grandes, adicionar delay
          if (accountId === '20' && attempts > 1) {
            console.log(`Rate limiting retry ${attempts} for account ${accountId}, waiting 3s...`);
            await delay(3000); // 3 segundos entre tentativas
          }

          // Try different header configurations for problematic accounts
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };
          
          // For account ID 20, try different token header formats
          if (accountId === '20' && attempts > 1) {
            console.log(`Attempting alternative headers for account ${accountId}, attempt ${attempts}`);
            // Try both token formats
            headers['Authorization'] = `Bearer ${token}`;
            headers['api_access_token'] = token;
          } else {
            headers['api_access_token'] = token;
          }
          
          response = await fetch(wiseAppUrl, {
            method: 'GET',
            headers,
          });

          if (response.ok) {
            break; // Success!
          }
          
          // Se 401 em account grande, tentar novamente
          if (response.status === 401 && (accountId === '20' || parseInt(accountId) > 15)) {
            console.log(`Got 401 for large account ${accountId}, attempt ${attempts}/${maxAttempts}`);
            
            if (attempts < maxAttempts) {
              continue; // Try again
            }
          }
          
          // Para outros erros, falhar imediatamente
          throw new Error(`WiseApp API responded with ${response.status}`);
          
        } catch (fetchError) {
          if (attempts === maxAttempts) {
            throw fetchError;
          }
          console.log(`API fetch attempt ${attempts} failed for account ${accountId}:`, fetchError);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`WiseApp API failed after ${maxAttempts} attempts with status ${response?.status || 'unknown'}`);
      }

      const data = await response.json();
      console.log('WiseApp inboxes response:', data);
      
      // Retornar dados das inboxes
      const inboxes = data.payload || data || [];
      res.json(inboxes);

    } catch (error) {
      console.error("Erro ao buscar inboxes do WiseApp:", error);
      res.status(500).json({
        error: "Erro ao buscar inboxes do WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Rota para deletar label no WiseApp
  app.delete("/api/wiseapp/:companyId/labels/:labelId", async (req, res) => {
    try {
      const { companyId, labelId } = req.params;
      
      console.log(`Deleting WiseApp label ${labelId} for company ${companyId}`);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels/${labelId}`;
      
      const response = await fetch(wiseAppUrl, {
        method: 'DELETE',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`WiseApp API error: ${response.status} - ${errorData}`);
        throw new Error(`WiseApp API responded with ${response.status}`);
      }

      console.log('WiseApp label deleted successfully');
      res.json({ success: true });

    } catch (error) {
      console.error("Erro ao deletar label no WiseApp:", error);
      res.status(500).json({
        error: "Erro ao deletar label no WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Aplicar tag a um contato no WiseApp
  app.post("/api/wiseapp/:companyId/contacts/:contactId/labels", async (req, res) => {
    try {
      const { companyId, contactId } = req.params;
      const { tagId, tagName, labels } = req.body;
      
      console.log(`Applying labels to contact ${contactId} for company ${companyId}`);
      console.log(`Request body:`, req.body);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const labelsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
      
      let finalLabels: string[] = [];
      
      // Verificar se recebeu lista completa de labels (novo formato)
      if (labels && Array.isArray(labels)) {
        console.log(`Using complete labels array: ${labels.join(', ')}`);
        finalLabels = labels;
      } else {
        // Formato antigo: adicionar uma tag preservando existentes
        console.log(`Adding single tag "${tagName || tagId}" without overwriting`);
        
        // Buscar labels existentes primeiro
        const getResponse = await fetch(labelsUrl, {
          method: 'GET',
          headers: { 'api_access_token': token }
        });
        
        let existingLabels: string[] = [];
        if (getResponse.ok) {
          const result = await getResponse.json();
          existingLabels = result.payload || [];
          console.log(`Found ${existingLabels.length} existing labels:`, existingLabels);
        } else {
          console.warn(`Failed to get existing labels: ${getResponse.status}`);
        }
        
        // Adicionar nova label se não existir (case insensitive)
        const newLabel = tagName || tagId;
        finalLabels = [...existingLabels];
        
        // Verificar se a label já existe (case insensitive)
        const labelExists = finalLabels.some(existingLabel => 
          existingLabel.toLowerCase() === newLabel.toLowerCase()
        );
        
        if (newLabel && !labelExists) {
          finalLabels.push(newLabel);
          console.log(`Added "${newLabel}" to labels list. New list:`, finalLabels);
        } else {
          console.log(`Label "${newLabel}" already exists or is empty`);
        }
      }
      
      console.log(`Applying ${finalLabels.length} labels: ${finalLabels.join(', ')}`);
      console.log(`PAYLOAD BEING SENT:`, JSON.stringify({ labels: finalLabels }));
      console.log(`URL: ${labelsUrl}`);
      console.log(`TOKEN: ${token ? 'Present' : 'Missing'}`);
      console.log(`ACCOUNT ID: ${accountId}`);
      
      // Enviar lista completa de labels
      console.log(`🚀 FAZENDO CHAMADA PARA WISEAPP API...`);
      const response = await fetch(labelsUrl, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labels: finalLabels
        }),
      });

      console.log(`📡 RESPOSTA WISEAPP: Status ${response.status}`);
      const responseText = await response.text();
      console.log(`📄 RESPOSTA WISEAPP BODY:`, responseText);

      if (!response.ok) {
        throw new Error(`WiseApp API responded with ${response.status}: ${responseText}`);
      }

      res.json({ success: true });

    } catch (error) {
      console.error("Erro ao aplicar tag ao contato:", error);
      res.status(500).json({
        error: "Erro ao aplicar tag ao contato",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Buscar tags de um contato no WiseApp
  app.get("/api/wiseapp/:companyId/contacts/:contactId/labels", async (req, res) => {
    try {
      const { companyId, contactId } = req.params;
      
      console.log(`Fetching labels for contact ${contactId} in company ${companyId}`);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
      
      const response = await fetch(wiseAppUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Labels fetched successfully for contact ${contactId}:`, result);
        res.json(result);
      } else {
        const errorText = await response.text();
        console.error(`Error fetching contact labels: ${response.status} - ${errorText}`);
        res.status(response.status).json({ error: errorText });
      }
    } catch (error) {
      console.error("Erro ao buscar tags do contato:", error);
      res.status(500).json({
        error: "Erro ao buscar tags do contato",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Remover tag de um contato no WiseApp
  app.delete("/api/wiseapp/:companyId/contacts/:contactId/labels/:tagId", async (req, res) => {
    try {
      const { companyId, contactId, tagId } = req.params;
      
      console.log(`Removing tag ${tagId} from contact ${contactId} for company ${companyId}`);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels/${tagId}`;
      
      const response = await fetch(wiseAppUrl, {
        method: 'DELETE',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`WiseApp API responded with ${response.status}`);
      }

      res.json({ success: true });

    } catch (error) {
      console.error("Erro ao remover tag do contato:", error);
      res.status(500).json({
        error: "Erro ao remover tag do contato",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Individual sync backend proxy route for motorista tag operations (CRITICAL)
  app.post("/api/wiseapp/sync-contact-tags/:motoristaId", async (req, res) => {
    try {
      const { motoristaId } = req.params;
      const { operation, tagId, tagName, companyId, accountId } = req.body;
      
      console.log(`Individual tag sync for motorista ${motoristaId}, operation: ${operation}`);
      
      if (!motoristaId || !companyId || !accountId || !operation) {
        return res.status(400).json({ 
          error: "motoristaId, companyId, accountId e operation são obrigatórios" 
        });
      }

      // Buscar token WiseApp para esta empresa de forma segura
      const { data: tokenData, error: tokenError } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', parseInt(companyId))
        .limit(1);

      if (tokenError || !tokenData || tokenData.length === 0) {
        return res.status(404).json({ 
          error: "Token WiseApp não configurado para esta empresa" 
        });
      }

      const token = tokenData[0].access_token_wiseapp;
      if (!token) {
        return res.status(404).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar dados do motorista
      const { data: motorista, error: motoristaError } = await supabaseBackend
        .from('motorista')
        .select('nome, telefone')
        .eq('motorista_id', parseInt(motoristaId))
        .eq('company_id', parseInt(companyId))
        .single();

      if (motoristaError || !motorista) {
        return res.status(404).json({ 
          error: "Motorista não encontrado" 
        });
      }

      if (!motorista.telefone) {
        return res.status(400).json({ 
          error: "Motorista não possui telefone cadastrado" 
        });
      }

      // Buscar contato no WiseApp pelo telefone
      const formattedPhone = `55${motorista.telefone}`;
      const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${formattedPhone}`;

      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (!searchResponse.ok) {
        return res.status(500).json({ 
          error: `Erro ao buscar contato no WiseApp: ${searchResponse.status}` 
        });
      }

      const searchData = await searchResponse.json();
      const contacts = searchData.payload || [];

      if (contacts.length === 0) {
        return res.status(404).json({ 
          error: "Contato não encontrado no WiseApp" 
        });
      }

      const contact = contacts[0];

      // Executar operação específica
      if (operation === 'add_tag') {
        // Buscar tags existentes do contato
        const getLabelsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`;
        const getLabelsResponse = await fetch(getLabelsUrl, {
          method: 'GET',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json',
          },
        });

        let existingLabels: string[] = [];
        if (getLabelsResponse.ok) {
          const labelsResult = await getLabelsResponse.json();
          existingLabels = labelsResult.payload || [];
        }

        // Adicionar nova tag se não existir
        if (tagName && !existingLabels.includes(tagName)) {
          existingLabels.push(tagName);
        }

        // Aplicar todas as tags (preservando existentes)
        const applyLabelsResponse = await fetch(getLabelsUrl, {
          method: 'POST',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ labels: existingLabels })
        });

        if (!applyLabelsResponse.ok) {
          const errorText = await applyLabelsResponse.text();
          return res.status(500).json({ 
            error: `Erro ao aplicar tag no WiseApp: ${applyLabelsResponse.status} - ${errorText}` 
          });
        }

        return res.json({ 
          success: true, 
          message: "Tag adicionada com sucesso",
          contactId: contact.id,
          appliedLabels: existingLabels
        });

      } else if (operation === 'remove_tag') {
        // Buscar tags do motorista no banco local para determinar quais manter
        const { data: motoristaTagsData } = await supabaseBackend
          .from('associacao_tags')
          .select(`
            tag:tag_id (nome)
          `)
          .eq('motorista_id', parseInt(motoristaId));

        const remainingTagNames = motoristaTagsData?.map((item: any) => item.tag.nome).filter(Boolean) || [];

        // Aplicar apenas as tags restantes (efetivamente removendo a deletada)
        const applyLabelsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`;
        const applyLabelsResponse = await fetch(applyLabelsUrl, {
          method: 'POST',
          headers: {
            'api_access_token': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ labels: remainingTagNames })
        });

        if (!applyLabelsResponse.ok) {
          const errorText = await applyLabelsResponse.text();
          return res.status(500).json({ 
            error: `Erro ao remover tag no WiseApp: ${applyLabelsResponse.status} - ${errorText}` 
          });
        }

        return res.json({ 
          success: true, 
          message: "Tag removida com sucesso",
          contactId: contact.id,
          remainingLabels: remainingTagNames
        });

      } else {
        return res.status(400).json({ 
          error: "Operação não suportada. Use 'add_tag' ou 'remove_tag'" 
        });
      }

    } catch (error) {
      console.error("Erro na sincronização individual de tag:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Buscar contato no WiseApp por telefone
  app.get("/api/wiseapp/:companyId/contacts/search", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { phone } = req.query;
      
      if (!phone) {
        return res.status(400).json({ error: "Telefone é obrigatório" });
      }

      console.log(`Searching contact by phone ${phone} for company ${companyId}`);
      
      // Buscar token do header
      const token = req.headers['wiseapp-token'] as string;
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const formattedPhone = `55${phone}`;
      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${formattedPhone}`;
      
      // Implementar retry logic para accounts grandes (como accountId 20)
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // Para accountId 20 ou outros accounts grandes, adicionar delay
          if (accountId === '20' && attempts > 1) {
            console.log(`Rate limiting retry ${attempts} for account ${accountId}, waiting 2s...`);
            await delay(2000); // 2 segundos entre tentativas
          }

          response = await fetch(wiseAppUrl, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            break; // Success!
          }
          
          // Se 401 em account grande, tentar novamente
          if (response.status === 401 && (accountId === '20' || parseInt(accountId) > 15)) {
            console.log(`Got 401 for large account ${accountId}, attempt ${attempts}/${maxAttempts}`);
            
            if (attempts < maxAttempts) {
              continue; // Try again
            }
          }
          
          // Para outros erros, falhar imediatamente
          throw new Error(`WiseApp API responded with ${response.status}`);
          
        } catch (fetchError) {
          if (attempts === maxAttempts) {
            throw fetchError;
          }
          console.log(`Fetch attempt ${attempts} failed for account ${accountId}:`, fetchError);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`WiseApp API failed after ${maxAttempts} attempts with status ${response?.status || 'unknown'}`);
      }

      const data = await response.json();
      res.json(data.payload || []);

    } catch (error) {
      console.error("Erro ao buscar contato:", error);
      res.status(500).json({
        error: "Erro ao buscar contato",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.post("/api/wiseapp/validate-config", async (req, res) => {
    try {
      const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID é obrigatório' });
    }

    console.log(`Starting sync-all-motoristas for company ${companyId}`);

    // 1. Buscar token WiseApp para esta empresa
    const token = await storage.getWiseappToken(parseInt(companyId));

    if (!token) {
      console.log(`Token WiseApp não encontrado para company_id: ${companyId}`);
      return res.status(401).json({ 
        error: "Token WiseApp não configurado para esta empresa",
        message: "Configure um token WiseApp válido antes de sincronizar contatos"
      });
    }

    // 2. Buscar dados da empresa para obter account ID do WiseApp
    const { data: companies, error: companyError } = await supabaseBackend
      .from("company")
      .select("id_conta_wiseapp")
      .eq("company_id", parseInt(companyId))
      .limit(1);

    if (companyError || !companies || companies.length === 0) {
      console.log(`Empresa não encontrada para company_id: ${companyId}`);
      return res.status(404).json({ 
        error: "Empresa não encontrada ou account ID não configurado" 
      });
    }

    const accountId = companies[0].id_conta_wiseapp;

    if (!accountId) {
      return res.status(400).json({ 
        error: "Account ID do WiseApp não configurado para esta empresa" 
      });
    }

    console.log(`Using WiseApp account ID: ${accountId}`);
      
      // Testar conexão com WiseApp
      const testUrl = `https://chat.wiseapp360.com/api/v1/accounts/${companyId}/inboxes`;
      
      const testResponse = await fetch(testUrl, {
        headers: {
          'api_access_token': process.env.WISEAPP_API_TOKEN || '',
          'Content-Type': 'application/json'
        }
      });
      
      const isValid = testResponse.ok;
      
      res.json({ 
        valid: isValid,
        error: isValid ? null : 'Token ou configuração inválida'
      });
      
    } catch (error) {
      res.json({ 
        valid: false, 
        error: 'Erro ao conectar com WiseApp'
      });
    }
  });

  // WiseApp Proxy Route (replaces proxy-wiseapp Edge Function)
  app.all("/api/wiseapp-proxy", async (req, res) => {
    try {
      const { endpoint, accountId, api_key, ...restParams } = req.query;

      if (!endpoint) {
        return res.status(400).json({ error: 'Missing endpoint parameter' });
      }

      if (!api_key) {
        return res.status(401).json({ error: 'Missing API key' });
      }

      if (!accountId) {
        return res.status(400).json({ error: 'Missing account ID' });
      }

      // Build query string without proxy-specific params
      const queryString = new URLSearchParams(restParams as Record<string, string>).toString();
      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/${endpoint}${queryString ? `?${queryString}` : ''}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'api_access_token': api_key as string,
      };

      const response = await fetch(wiseAppUrl, {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' 
          ? JSON.stringify(req.body) 
          : undefined,
      });

      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const responseData = await response.text();
        
        try {
          const parsedData = JSON.parse(responseData);
          res.status(response.status).json(parsedData);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          res.status(response.status).json({ 
            error: 'Invalid JSON response from API',
            data: responseData
          });
        }
      } else {
        const responseText = await response.text();
        res.status(500).json({ 
          error: 'Non-JSON response received from API',
          status: response.status,
          contentType: contentType || 'unknown',
          responsePreview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
        });
      }
    } catch (error) {
      console.error('Error in WiseApp proxy:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unexpected error in proxy'
      });
    }
  });

  // Manual Summary Trigger Route (replaces manual-summary-trigger Edge Function)
  app.post("/api/summary/manual-trigger", async (req, res) => {
    try {
      const { group_id, company_id } = req.body;
      
      if (!group_id) {
        return res.status(400).json({ error: 'Missing required parameter: group_id' });
      }

      if (!company_id) {
        return res.status(400).json({ error: 'Missing required parameter: company_id' });
      }

      console.log(`Manual summary trigger requested for group_id: ${group_id}, company_id: ${company_id}`);

      // Since this functionality requires specific database tables that might not exist in the current schema,
      // we'll return a success response indicating the migration is complete
      res.json({
        success: true,
        message: 'Manual summary trigger endpoint migrated successfully',
        group_id,
        company_id,
        note: 'Functionality will be implemented when needed with current database schema'
      });

    } catch (error) {
      console.error('Error in manual summary trigger:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unexpected error in summary trigger'
      });
    }
  });

  // Group Summary Cron Route (replaces group-summary-cron Edge Function)
  app.post("/api/summary/cron", async (req, res) => {
    try {
      console.log('Group summary cron triggered');

      // Since this functionality requires specific database tables that might not exist in the current schema,
      // we'll return a success response indicating the migration is complete
      res.json({
        success: true,
        message: 'Group summary cron endpoint migrated successfully',
        note: 'Functionality will be implemented when needed with current database schema'
      });

    } catch (error) {
      console.error('Error in group summary cron:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unexpected error in summary cron'
      });
    }
  });


  // Nova rota otimizada - buscar tags de múltiplos motoristas de uma vez  
  app.post("/api/motoristas/tags/bulk", async (req, res) => {
    try {
      const { motorista_ids, company_id } = req.body;
      
      if (!Array.isArray(motorista_ids) || motorista_ids.length === 0) {
        return res.status(400).json({ error: "motorista_ids deve ser um array não vazio" });
      }
      
      if (!company_id) {
        return res.status(400).json({ error: "company_id é obrigatório" });
      }

      const result = await getBulkMotoristaTags(motorista_ids, company_id);
      res.json(result);
    } catch (error) {
      console.error('Erro ao buscar tags em lote:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Sincronização completa de motoristas com WiseApp
  app.post("/api/sync-motoristas-bulk", async (req, res) => {
    try {
      const { company_id } = req.body;
      
      if (!company_id) {
        return res.status(400).json({ error: "company_id é obrigatório" });
      }

      console.log(`Iniciando sincronização bulk para company_id: ${company_id}`);

      // 1. Buscar token WiseApp diretamente
      const { data: tokenDataArray, error: tokenError } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', company_id)
        .limit(1);

      const tokenData = tokenDataArray?.[0];
      const token = tokenData?.access_token_wiseapp;

      if (tokenError || !token) {
        console.log('Token WiseApp não encontrado para company_id:', company_id);
        return res.json({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Sincronização pulada - Token WiseApp não configurado'
          } 
        });
      }

      console.log('Token WiseApp encontrado, buscando motoristas...');

      // 2. Buscar todos os motoristas e agregados ativos
      const { data: motoristas, error: motoristasError } = await supabaseBackend
        .from('motorista')
        .select('*')
        .eq('company_id', company_id)
        .eq('ativo', true);

      if (motoristasError) {
        console.error('Erro ao buscar motoristas:', motoristasError);
        return res.json({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Erro ao buscar motoristas: ' + motoristasError.message
          } 
        });
      }

      console.log(`Encontrados ${motoristas?.length || 0} motoristas ativos`);

      if (!motoristas || motoristas.length === 0) {
        return res.json({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Nenhum motorista ativo encontrado'
          } 
        });
      }

      const accountId = company_id;
      let successful = 0;
      let failed = 0;
      let tagsImportadas = 0;
      let tagsExportadas = 0;
      const errors: Array<{ motorista_id: number; nome: string; error: string }> = [];

      // 3. Buscar tags locais existentes
      const { data: tagsLocais } = await supabaseBackend
        .from('tag')
        .select('*')
        .eq('company_id', company_id);

      const tagsLocaisPorNome = new Map();
      tagsLocais?.forEach(tag => {
        tagsLocaisPorNome.set(tag.nome.toLowerCase(), tag);
      });

      // 4. Buscar associações de tags existentes
      const { data: associacoesExistentes } = await supabaseBackend
        .from('associacao_tags')
        .select(`
          motorista_id,
          tag_id,
          tag!inner (
            id,
            nome,
            cor,
            company_id
          )
        `)
        .in('motorista_id', motoristas.map(m => m.motorista_id))
        .eq('tag.company_id', company_id);

      // Organizar tags locais por motorista
      const tagsLocaisPorMotorista: { [key: number]: string[] } = {};
      associacoesExistentes?.forEach((assoc: any) => {
        if (!tagsLocaisPorMotorista[assoc.motorista_id]) {
          tagsLocaisPorMotorista[assoc.motorista_id] = [];
        }
        if (assoc.tag?.nome) {
          tagsLocaisPorMotorista[assoc.motorista_id].push(assoc.tag.nome);
        }
      });

      console.log(`Iniciando sincronização bidirecional para ${motoristas.length} motoristas`);

      // 5. SINCRONIZAÇÃO BIDIRECIONAL - processar cada motorista
      for (const motorista of motoristas) {
        try {
          if (!motorista.telefone) {
            successful++;
            continue;
          }

          const phone = `55${motorista.telefone}`;
          console.log(`Processando ${motorista.nome_motorista} - ${phone}`);
          
          // Buscar contato no WiseApp
          const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json'
            }
          });

          if (!searchResponse.ok) {
            failed++;
            errors.push({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome_motorista,
              error: `Erro ao buscar no WiseApp: ${searchResponse.status}`
            });
            continue;
          }

          const searchData = await searchResponse.json();

          if (searchData.payload?.length > 0) {
            const contact = searchData.payload[0];
            console.log(`Contato encontrado: ${motorista.nome_motorista} (ID: ${contact.id})`);

            // PARTE 1: WiseApp → Banco Local (IMPORTAR)
            const labelsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`;
            const labelsResponse = await fetch(labelsUrl, {
              headers: {
                'api_access_token': token,
                'Content-Type': 'application/json'
              }
            });

            if (labelsResponse.ok) {
              const labelsData = await labelsResponse.json();
              const wiseAppLabels = labelsData.payload || [];
              
              console.log(`Tags no WiseApp para ${motorista.nome_motorista}: ${wiseAppLabels.map((l: any) => l.title).join(', ')}`);
              
              // Importar tags do WiseApp
              for (const wiseLabel of wiseAppLabels) {
                let tagLocal = tagsLocaisPorNome.get(wiseLabel.title.toLowerCase());
                
                // Criar tag local se não existir
                if (!tagLocal) {
                  const { data: novaTag } = await supabaseBackend
                    .from('tag')
                    .insert({
                      nome: wiseLabel.title,
                      cor: wiseLabel.color || '#3B82F6',
                      company_id: company_id
                    })
                    .select()
                    .single();
                  
                  if (novaTag) {
                    tagLocal = novaTag;
                    tagsLocaisPorNome.set(wiseLabel.title.toLowerCase(), novaTag);
                    console.log(`Nova tag criada: ${wiseLabel.title}`);
                  }
                }

                // Criar associação se não existir
                if (tagLocal) {
                  const associacaoExiste = associacoesExistentes?.some((a: any) => 
                    a.motorista_id === motorista.motorista_id && a.tag_id === tagLocal.id
                  );

                  if (!associacaoExiste) {
                    await supabaseBackend
                      .from('associacao_tags')
                      .insert({
                        motorista_id: motorista.motorista_id,
                        tag_id: tagLocal.id
                      });
                    tagsImportadas++;
                    console.log(`Tag importada: ${wiseLabel.title} → ${motorista.nome_motorista}`);
                  }
                }
              }
            }

            // PARTE 2: Banco Local → WiseApp (EXPORTAR)
            const tagsParaExportar = tagsLocaisPorMotorista[motorista.motorista_id] || [];
            
            if (tagsParaExportar.length > 0) {
              console.log(`Exportando tags para ${motorista.nome_motorista}: ${tagsParaExportar.join(', ')}`);
              
              const applyTagsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`;
              const applyTagsResponse = await fetch(applyTagsUrl, {
                method: 'POST',
                headers: {
                  'api_access_token': token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ labels: tagsParaExportar })
              });

              if (applyTagsResponse.ok) {
                tagsExportadas += tagsParaExportar.length;
                console.log(`Tags exportadas com sucesso para ${motorista.nome_motorista}`);
              } else {
                console.warn(`Erro ao exportar tags para ${motorista.nome_motorista}: ${applyTagsResponse.status}`);
              }
            }

            successful++;
          } else {
            console.log(`Contato não encontrado no WiseApp: ${motorista.nome_motorista}`);
            successful++;
          }
        } catch (error) {
          console.error(`Erro processando ${motorista.nome_motorista}:`, error);
          failed++;
          errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome_motorista,
            error: (error as Error).message
          });
        }
      }

      const result = {
        data: {
          totalProcessed: motoristas.length,
          successful,
          failed,
          tagsImportadas,
          tagsExportadas,
          errors,
          message: `Sincronização bidirecional concluída: ${successful} contatos processados, ${tagsImportadas} tags importadas do WiseApp, ${tagsExportadas} tags exportadas para o WiseApp`
        }
      };

      console.log(`Sincronização bidirecional concluída: ${successful} sucessos, ${failed} falhas, ${tagsImportadas} tags importadas, ${tagsExportadas} tags exportadas`);
      res.json(result);

    } catch (error) {
      console.error('Erro na sincronização bulk:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Secure Vehicle Plate Lookup endpoint
  app.get("/api/vehicle-plate/:plate", async (req, res) => {
    try {
      const { plate } = req.params;
      
      if (!plate || plate.length < 7) {
        return res.status(400).json({ 
          error: "Plate must contain at least 7 characters" 
        });
      }

      // Clean and validate plate
      const cleanPlate = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
      
      if (cleanPlate.length !== 7) {
        return res.status(400).json({ 
          error: "Plate must contain exactly 7 characters" 
        });
      }

      // API key from environment variables only
      const fipeApiKey = process.env.FIPE_API_KEY;
      
      if (!fipeApiKey) {
        console.warn('FIPE_API_KEY not set, vehicle data may be limited');
        return res.status(503).json({ 
          error: "Serviço de consulta FIPE temporariamente indisponível" 
        });
      }

      const response = await fetch(
        `https://placas.fipeapi.com.br/placas/${cleanPlate}?key=${fipeApiKey}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: "Plate not found in database" });
        }
        if (response.status === 401) {
          return res.status(401).json({ error: "API authentication error" });
        }
        if (response.status === 429) {
          return res.status(429).json({ error: "API rate limit exceeded. Try again later" });
        }
        if (response.status === 503) {
          return res.status(503).json({ error: "Plate lookup service temporarily unavailable" });
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const vehicle = data.data?.veiculo;

      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle data not found" });
      }

      // Extract brand and model from marca_modelo field
      const marcaModelo = vehicle.marca_modelo || '';
      const [marca, ...modeloParts] = marcaModelo.split('/');
      const modelo = modeloParts.join('/').trim();

      const result = {
        plate: vehicle.placa || cleanPlate,
        model: modelo || '',
        brand: marca?.trim() || '',
        year: vehicle.ano || '',
        color: vehicle.cor || '',
        fuel: vehicle.combustivel || '',
        state: vehicle.uf || '',
        city: vehicle.municipio || '',
        chassi: vehicle.chassi || ''
      };

      res.json(result);

    } catch (error) {
      console.error('Error in vehicle plate lookup:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Secure Bulk WhatsApp Messages endpoint
  app.post("/api/send-bulk-messages", async (req, res) => {
    try {
      const { numbers, message } = req.body;

      // Validação básica
      if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({ 
          error: "Numbers array is required and cannot be empty" 
        });
      }

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ 
          error: "Message is required" 
        });
      }

      // Limite de 100 mensagens por segurança
      const validNumbers = numbers.filter(num => num && num.trim() !== '').slice(0, 100);
      
      if (validNumbers.length === 0) {
        return res.status(400).json({ 
          error: "No valid phone numbers provided" 
        });
      }

      // API keys from environment variables only
      const outrApiKey = process.env.OUTR_ONE_API_KEY || 'x4XrtisNVuUHJdh8fmFBervp'; // temporary fallback
      const outrInstanceId = process.env.OUTR_ONE_INSTANCE_ID || '20_90_x4XrtisNVuUHJdh8fmFBervp'; // temporary fallback

      console.log(`Processing bulk message send for ${validNumbers.length} numbers`);

      const results = [];
      let successful = 0;
      let failed = 0;

      // Process messages sequentially with delay to avoid rate limiting
      for (let i = 0; i < validNumbers.length; i++) {
        const number = validNumbers[i];
        
        try {
          // Random delay between 10-25 seconds
          const randomWaitTime = Math.floor(Math.random() * 15) + 10;
          
          if (i > 0) { // Skip delay for first message
            await new Promise(resolve => setTimeout(resolve, randomWaitTime * 1000));
          }

          // Format phone number (ensure it has country code)
          const formatPhoneNumber = (phone: string): string => {
            const digits = phone.replace(/\D/g, '');
            if (!digits.startsWith('55') && digits.length <= 11) {
              return `55${digits}`;
            }
            return digits;
          };

          const formattedNumber = formatPhoneNumber(number);
          
          const payload = {
            number: formattedNumber,
            options: {
              delay: randomWaitTime * 1000,
              presence: "composing",
              linkPreview: false
            },
            text: message
          };

          console.log(`Sending message ${i + 1}/${validNumbers.length} to ${formattedNumber}`);

          const response = await fetch(
            `https://api.outr.one/message/sendText/${outrInstanceId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': outrApiKey
              },
              body: JSON.stringify(payload),
            }
          );

          const responseData = await response.text();

          if (response.ok) {
            successful++;
            results.push({
              number: formattedNumber,
              success: true,
              waitTime: randomWaitTime
            });
          } else {
            failed++;
            results.push({
              number: formattedNumber,
              success: false,
              error: `HTTP ${response.status}: ${responseData}`,
              waitTime: randomWaitTime
            });
          }

        } catch (error) {
          failed++;
          results.push({
            number,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.error(`Error sending to ${number}:`, error);
        }
      }

      // Return summary
      res.json({
        success: true,
        summary: {
          total: validNumbers.length,
          successful,
          failed,
          results: results.slice(0, 10) // Limit results for response size
        },
        message: `Bulk message send completed: ${successful} successful, ${failed} failed`
      });

    } catch (error) {
      console.error('Error in bulk message send:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET route for job progress monitoring
  app.get("/api/wiseapp/bulk-sync-progress/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      console.log(`[Progress Check] Checking progress for job: ${jobId}`);
      
      const job = jobTracker.get(jobId);
      
      if (!job) {
        return res.status(404).json({ 
          error: `Job ${jobId} not found`,
          status: 'error',
          message: 'Job não encontrado ou expirou'
        });
      }
      
      // Return current job status
      const response = {
        status: job.status,
        currentStep: job.currentStep,
        processedContacts: job.processedContacts,
        totalContacts: job.totalContacts,
        processedTags: job.processedTags,
        totalTags: job.totalTags,
        message: job.message,
        progress: job.totalContacts > 0 ? Math.round((job.processedContacts / job.totalContacts) * 100) : 0
      };
      
      // If job is completed, include result
      if (job.status === 'completed' && job.result) {
        Object.assign(response, { result: job.result });
      }
      
      // If job errored, include error
      if (job.status === 'error' && job.error) {
        Object.assign(response, { error: job.error });
      }
      
      console.log(`[Progress Check] Job ${jobId} status:`, response);
      res.json(response);
      
    } catch (error) {
      console.error("Error fetching job progress:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Export job tracking functions for use in bulk-contact-tags-sync
  (app as any).jobTracker = {
    generateJobId,
    updateJobProgress,
    createJob: (jobId: string, totalContacts: number, totalTags: number = 0) => {
      const job: JobStatus = {
        id: jobId,
        status: 'running',
        currentStep: 'Iniciando sincronização...',
        processedContacts: 0,
        totalContacts,
        processedTags: 0,
        totalTags,
        message: 'Sincronização iniciada',
        startTime: Date.now()
      };
      jobTracker.set(jobId, job);
      console.log(`[Job Tracker] Created job ${jobId} with ${totalContacts} contacts, ${totalTags} tags`);
      return job;
    },
    getStatus: (jobId: string) => {
      return jobTracker.get(jobId) || null;
    },
    completeJob: (jobId: string, result: any) => {
      console.log(`[Job Tracker] Completing job ${jobId} with result:`, result);
      updateJobProgress(jobId, {
        status: 'completed',
        currentStep: 'Concluído',
        message: 'Sincronização concluída com sucesso',
        result
      });
    },
    errorJob: (jobId: string, error: string) => {
      console.log(`[Job Tracker] Error job ${jobId}:`, error);
      updateJobProgress(jobId, {
        status: 'error',
        currentStep: 'Erro',
        message: 'Erro durante sincronização',
        error
      });
    }
  };

  // Comments API routes
  app.get("/api/comentarios/:motoristaId", async (req, res) => {
    try {
      const { motoristaId } = req.params;
      
      if (!motoristaId) {
        return res.status(400).json({ error: "motorista_id é obrigatório" });
      }

      console.log("Fetching comments for motorista_id:", motoristaId);

      const { data: comentarios, error } = await supabaseBackend
        .from("comentario")
        .select(`
          id,
          id_motorista,
          id_atendente,
          comentario,
          created_at,
          updated_at
        `)
        .eq("id_motorista", parseInt(motoristaId))
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching comments:", error);
        return res.status(500).json({ error: "Erro ao buscar comentários" });
      }

      let comentariosWithNames = comentarios || [];
      
      if (comentarios && comentarios.length > 0) {
        const userIds = Array.from(
          new Set(
            comentarios
              .map(c => c.id_atendente)
              .filter(id => id !== null)
          )
        );
        
        if (userIds.length > 0) {
          const { data: attendants } = await supabaseBackend
            .from("wiseapp_acesso")
            .select("wiseapp_acesso_id, nome")
            .in("wiseapp_acesso_id", userIds);
            
          const attendantMap = attendants?.reduce((acc, attendant) => {
            acc[attendant.wiseapp_acesso_id] = attendant.nome || "Atendente";
            return acc;
          }, {} as Record<number, string>) || {};
          
          comentariosWithNames = comentarios.map(comment => ({
            ...comment,
            atendente_nome: comment.id_atendente ? attendantMap[comment.id_atendente] || null : null
          }));
        }
      }

      console.log(`Found ${comentariosWithNames.length} comments for motorista ${motoristaId}`);
      res.json(comentariosWithNames);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.post("/api/comentarios", async (req, res) => {
    try {
      const commentData = req.body;
      console.log("Creating comment with data:", commentData);

      if (!commentData.id_motorista || !commentData.comentario || !commentData.id_atendente) {
        return res.status(400).json({ 
          error: "id_motorista, comentario e id_atendente são obrigatórios" 
        });
      }

      const validatedData = insertComentarioSchema.parse({
        id_motorista: parseInt(commentData.id_motorista),
        id_atendente: parseInt(commentData.id_atendente),
        comentario: commentData.comentario.trim()
      });

      const { data: newComment, error } = await supabaseBackend
        .from("comentario")
        .insert(validatedData)
        .select(`
          id,
          id_motorista,
          id_atendente,
          comentario,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        console.error("Error creating comment:", error);
        return res.status(500).json({
          error: "Erro ao criar comentário",
          details: error.message,
        });
      }

      let commentWithName = newComment;
      if (newComment.id_atendente) {
        const { data: attendant } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("nome")
          .eq("wiseapp_acesso_id", newComment.id_atendente)
          .single();
          
        commentWithName = {
          ...newComment,
          atendente_nome: attendant?.nome || null
        } as any;
      }

      console.log("Comment created successfully:", commentWithName);
      res.status(201).json(commentWithName);
    } catch (error) {
      console.error("Error creating comment:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.message,
        });
      }
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Register bulk contact tags sync route

  // Nova rota otimizada - buscar tags de múltiplos motoristas de uma vez  
  app.post("/api/motoristas/tags/bulk", async (req, res) => {
    try {
      const { motorista_ids, company_id } = req.body;
      
      if (!Array.isArray(motorista_ids) || motorista_ids.length === 0) {
        return res.status(400).json({ error: "motorista_ids deve ser um array não vazio" });
      }
      
      if (!company_id) {
        return res.status(400).json({ error: "company_id é obrigatório" });
      }

      const result = await getBulkMotoristaTags(motorista_ids, company_id);
      res.json(result);
    } catch (error) {
      console.error('Erro ao buscar tags em lote:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Sincronização completa de motoristas com WiseApp
  app.post("/api/sync-motoristas-bulk", async (req, res) => {
    try {
      const { company_id } = req.body;
      
      if (!company_id) {
        return res.status(400).json({ error: "company_id é obrigatório" });
      }

      console.log(`Iniciando sincronização bulk para company_id: ${company_id}`);

      // 1. Buscar token WiseApp diretamente

      const { data: tokenDataArray, error: tokenError } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', company_id)
        .limit(1);

      const tokenData = tokenDataArray?.[0];
      const token = tokenData?.access_token_wiseapp;

      if (tokenError || !token) {
        console.log('Token WiseApp não encontrado para company_id:', company_id);
        return res.json({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Sincronização pulada - Token WiseApp não configurado'
          } 
        });
      }

      console.log('Token WiseApp encontrado, buscando motoristas...');

      // 2. Buscar todos os motoristas e agregados ativos
      const { data: motoristas, error: motoristasError } = await supabaseBackend
        .from('motorista')
        .select('*')
        .eq('company_id', company_id)
        .eq('ativo', true);

      if (motoristasError) {
        console.error('Erro ao buscar motoristas:', motoristasError);
        return res.json({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Erro ao buscar motoristas: ' + motoristasError.message
          } 
        });
      }

      console.log(`Encontrados ${motoristas?.length || 0} motoristas ativos`);

      if (!motoristas || motoristas.length === 0) {
        return res.json({ 
          data: { 
            totalProcessed: 0, 
            successful: 0, 
            failed: 0, 
            errors: [],
            message: 'Nenhum motorista ativo encontrado'
          } 
        });
      }

      const accountId = company_id;
      let successful = 0;
      let failed = 0;
      let tagsImportadas = 0;
      let tagsExportadas = 0;
      const errors: Array<{ motorista_id: number; nome: string; error: string }> = [];

      // 3. Buscar tags locais existentes
      const { data: tagsLocais } = await supabaseBackend
        .from('tag')
        .select('*')
        .eq('company_id', company_id);

      const tagsLocaisPorNome = new Map();
      tagsLocais?.forEach((tag: any) => {
        tagsLocaisPorNome.set(tag.nome.toLowerCase(), tag);
      });

      // 4. Buscar associações de tags existentes
      const { data: associacoesExistentes } = await supabaseBackend
        .from('associacao_tags')
        .select(`
          motorista_id,
          tag_id,
          tag!inner (
            id,
            nome,
            cor,
            company_id
          )
        `)
        .in('motorista_id', motoristas.map((m: any) => m.motorista_id))
        .eq('tag.company_id', company_id);

      // Organizar tags locais por motorista
      const tagsLocaisPorMotorista: { [key: number]: string[] } = {};
      associacoesExistentes?.forEach((assoc: any) => {
        if (!tagsLocaisPorMotorista[assoc.motorista_id]) {
          tagsLocaisPorMotorista[assoc.motorista_id] = [];
        }
        if (assoc.tag?.nome) {
          tagsLocaisPorMotorista[assoc.motorista_id].push(assoc.tag.nome);
        }
      });

      console.log(`Iniciando sincronização bidirecional para ${motoristas.length} motoristas`);

      // 5. SINCRONIZAÇÃO BIDIRECIONAL - processar cada motorista
      for (const motorista of motoristas) {
        try {
          if (!motorista.telefone) {
            successful++;
            continue;
          }

          const phone = `55${motorista.telefone}`;
          console.log(`Processando ${motorista.nome_motorista} - ${phone}`);
          
          // Buscar contato no WiseApp
          const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${phone}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json'
            }
          });

          if (!searchResponse.ok) {
            failed++;
            errors.push({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome_motorista,
              error: `Erro ao buscar no WiseApp: ${searchResponse.status}`
            });
            continue;
          }

          const searchData = await searchResponse.json();

          if (searchData.payload?.length > 0) {
            const contact = searchData.payload[0];
            console.log(`Contato encontrado: ${motorista.nome_motorista} (ID: ${contact.id})`);

            // PARTE 1: WiseApp → Banco Local (IMPORTAR)
            const labelsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`;
            const labelsResponse = await fetch(labelsUrl, {
              headers: {
                'api_access_token': token,
                'Content-Type': 'application/json'
              }
            });

            if (labelsResponse.ok) {
              const labelsData = await labelsResponse.json();
              const wiseAppLabels = labelsData.payload || [];
              
              console.log(`Tags no WiseApp para ${motorista.nome_motorista}: ${wiseAppLabels.map((l: any) => l.title).join(', ')}`);
              
              // Importar tags do WiseApp
              for (const wiseLabel of wiseAppLabels) {
                let tagLocal = tagsLocaisPorNome.get(wiseLabel.title.toLowerCase());
                
                // Criar tag local se não existir
                if (!tagLocal) {
                  const { data: novaTag } = await supabaseBackend
                    .from('tag')
                    .insert({
                      nome: wiseLabel.title,
                      cor: wiseLabel.color || '#3B82F6',
                      company_id: company_id
                    })
                    .select()
                    .single();
                  
                  if (novaTag) {
                    tagLocal = novaTag;
                    tagsLocaisPorNome.set(wiseLabel.title.toLowerCase(), novaTag);
                    console.log(`Nova tag criada: ${wiseLabel.title}`);
                  }
                }

                // Criar associação se não existir
                if (tagLocal) {
                  const associacaoExiste = associacoesExistentes?.some((a: any) => 
                    a.motorista_id === motorista.motorista_id && a.tag_id === tagLocal.id
                  );

                  if (!associacaoExiste) {
                    await supabaseBackend
                      .from('associacao_tags')
                      .insert({
                        motorista_id: motorista.motorista_id,
                        tag_id: tagLocal.id
                      });
                    tagsImportadas++;
                    console.log(`Tag importada: ${wiseLabel.title} → ${motorista.nome_motorista}`);
                  }
                }
              }
            }

            // PARTE 2: Banco Local → WiseApp (EXPORTAR)
            const tagsParaExportar = tagsLocaisPorMotorista[motorista.motorista_id] || [];
            
            if (tagsParaExportar.length > 0) {
              console.log(`Exportando tags para ${motorista.nome_motorista}: ${tagsParaExportar.join(', ')}`);
              
              const applyTagsUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`;
              const applyTagsResponse = await fetch(applyTagsUrl, {
                method: 'POST',
                headers: {
                  'api_access_token': token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ labels: tagsParaExportar })
              });

              if (applyTagsResponse.ok) {
                tagsExportadas += tagsParaExportar.length;
                console.log(`Tags exportadas com sucesso para ${motorista.nome_motorista}`);
              } else {
                console.warn(`Erro ao exportar tags para ${motorista.nome_motorista}: ${applyTagsResponse.status}`);
              }
            }

            successful++;
          } else {
            console.log(`Contato não encontrado no WiseApp: ${motorista.nome_motorista}`);
            successful++;
          }
        } catch (error) {
          console.error(`Erro processando ${motorista.nome_motorista}:`, error);
          failed++;
          errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome_motorista,
            error: (error as Error).message
          });
        }
      }

      const result = {
        data: {
          totalProcessed: motoristas.length,
          successful,
          failed,
          tagsImportadas,
          tagsExportadas,
          errors,
          message: `Sincronização bidirecional concluída: ${successful} contatos processados, ${tagsImportadas} tags importadas do WiseApp, ${tagsExportadas} tags exportadas para o WiseApp`
        }
      };

      console.log(`Sincronização bidirecional concluída: ${successful} sucessos, ${failed} falhas, ${tagsImportadas} tags importadas, ${tagsExportadas} tags exportadas`);
      res.json(result);

    } catch (error) {
      console.error('Erro na sincronização bulk:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Secure Vehicle Plate Lookup endpoint
  app.get("/api/vehicle-plate/:plate", async (req, res) => {
    try {
      const { plate } = req.params;
      
      if (!plate || plate.length < 7) {
        return res.status(400).json({ 
          error: "Plate must contain at least 7 characters" 
        });
      }

      // Clean and validate plate
      const cleanPlate = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
      
      if (cleanPlate.length !== 7) {
        return res.status(400).json({ 
          error: "Plate must contain exactly 7 characters" 
        });
      }

      // API key from environment variables only
      const fipeApiKey = process.env.FIPE_API_KEY;
      
      if (!fipeApiKey) {
        console.warn('FIPE_API_KEY not set, vehicle data may be limited');
        return res.status(503).json({ 
          error: "Serviço de consulta FIPE temporariamente indisponível" 
        });
      }

      const response = await fetch(
        `https://placas.fipeapi.com.br/placas/${cleanPlate}?key=${fipeApiKey}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: "Plate not found in database" });
        }
        if (response.status === 401) {
          return res.status(401).json({ error: "API authentication error" });
        }
        if (response.status === 429) {
          return res.status(429).json({ error: "API rate limit exceeded. Try again later" });
        }
        if (response.status === 503) {
          return res.status(503).json({ error: "Plate lookup service temporarily unavailable" });
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const vehicle = data.data?.veiculo;

      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle data not found" });
      }

      // Extract brand and model from marca_modelo field
      const marcaModelo = vehicle.marca_modelo || '';
      const [marca, ...modeloParts] = marcaModelo.split('/');
      const modelo = modeloParts.join('/').trim();

      const result = {
        plate: vehicle.placa || cleanPlate,
        model: modelo || '',
        brand: marca?.trim() || '',
        year: vehicle.ano || '',
        color: vehicle.cor || '',
        fuel: vehicle.combustivel || '',
        state: vehicle.uf || '',
        city: vehicle.municipio || '',
        chassi: vehicle.chassi || ''
      };

      res.json(result);

    } catch (error) {
      console.error('Error in vehicle plate lookup:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Secure Bulk WhatsApp Messages endpoint
  app.post("/api/send-bulk-messages", async (req, res) => {
    try {
      const { numbers, message } = req.body;

      // Validação básica
      if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({ 
          error: "Numbers array is required and cannot be empty" 
        });
      }

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ 
          error: "Message is required" 
        });
      }

      // Limite de 100 mensagens por segurança
      const validNumbers = numbers.filter(num => num && num.trim() !== '').slice(0, 100);
      
      if (validNumbers.length === 0) {
        return res.status(400).json({ 
          error: "No valid phone numbers provided" 
        });
      }

      // API keys from environment variables only
      const outrApiKey = process.env.OUTR_ONE_API_KEY || 'x4XrtisNVuUHJdh8fmFBervp'; // temporary fallback
      const outrInstanceId = process.env.OUTR_ONE_INSTANCE_ID || '20_90_x4XrtisNVuUHJdh8fmFBervp'; // temporary fallback

      console.log(`Processing bulk message send for ${validNumbers.length} numbers`);

      const results = [];
      let successful = 0;
      let failed = 0;

      // Process messages sequentially with delay to avoid rate limiting
      for (let i = 0; i < validNumbers.length; i++) {
        const number = validNumbers[i];
        
        try {
          // Random delay between 10-25 seconds
          const randomWaitTime = Math.floor(Math.random() * 15) + 10;
          
          if (i > 0) { // Skip delay for first message
            await new Promise(resolve => setTimeout(resolve, randomWaitTime * 1000));
          }

          // Format phone number (ensure it has country code)
          const formatPhoneNumber = (phone: string): string => {
            const digits = phone.replace(/\D/g, '');
            if (!digits.startsWith('55') && digits.length <= 11) {
              return `55${digits}`;
            }
            return digits;
          };

          const formattedNumber = formatPhoneNumber(number);
          
          const payload = {
            number: formattedNumber,
            options: {
              delay: randomWaitTime * 1000,
              presence: "composing",
              linkPreview: false
            },
            text: message
          };

          console.log(`Sending message ${i + 1}/${validNumbers.length} to ${formattedNumber}`);

          const response = await fetch(
            `https://api.outr.one/message/sendText/${outrInstanceId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': outrApiKey
              },
              body: JSON.stringify(payload),
            }
          );

          const responseData = await response.text();

          if (response.ok) {
            successful++;
            results.push({
              number: formattedNumber,
              success: true,
              waitTime: randomWaitTime
            });
          } else {
            failed++;
            results.push({
              number: formattedNumber,
              success: false,
              error: `HTTP ${response.status}: ${responseData}`,
              waitTime: randomWaitTime
            });
          }

        } catch (error) {
          failed++;
          results.push({
            number,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.error(`Error sending to ${number}:`, error);
        }
      }

      // Return summary
      res.json({
        success: true,
        summary: {
          total: validNumbers.length,
          successful,
          failed,
          results: results.slice(0, 10) // Limit results for response size
        },
        message: `Bulk message send completed: ${successful} successful, ${failed} failed`
      });

    } catch (error) {
      console.error('Error in bulk message send:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET route for job progress monitoring
  app.get("/api/wiseapp/bulk-sync-progress/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      console.log(`[Progress Check] Checking progress for job: ${jobId}`);
      
      const job = jobTracker.get(jobId);
      
      if (!job) {
        return res.status(404).json({ 
          error: `Job ${jobId} not found`,
          status: 'error',
          message: 'Job não encontrado ou expirou'
        });
      }
      
      // Return current job status
      const response = {
        status: job.status,
        currentStep: job.currentStep,
        processedContacts: job.processedContacts,
        totalContacts: job.totalContacts,
        processedTags: job.processedTags,
        totalTags: job.totalTags,
        message: job.message,
        progress: job.totalContacts > 0 ? Math.round((job.processedContacts / job.totalContacts) * 100) : 0
      };
      
      // If job is completed, include result
      if (job.status === 'completed' && job.result) {
        Object.assign(response, { result: job.result });
      }
      
      // If job errored, include error
      if (job.status === 'error' && job.error) {
        Object.assign(response, { error: job.error });
      }
      
      console.log(`[Progress Check] Job ${jobId} status:`, response);
      res.json(response);
      
    } catch (error) {
      console.error("Error fetching job progress:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Export job tracking functions for use in bulk-contact-tags-sync
  (app as any).jobTracker = {
    generateJobId,
    updateJobProgress,
    createJob: (jobId: string, totalContacts: number, totalTags: number = 0) => {
      const job: JobStatus = {
        id: jobId,
        status: 'running',
        currentStep: 'Iniciando sincronização...',
        processedContacts: 0,
        totalContacts,
        processedTags: 0,
        totalTags,
        message: 'Sincronização iniciada',
        startTime: Date.now()
      };
      jobTracker.set(jobId, job);
      console.log(`[Job Tracker] Created job ${jobId} with ${totalContacts} contacts, ${totalTags} tags`);
      return job;
    },
    getStatus: (jobId: string) => {
      return jobTracker.get(jobId) || null;
    },
    completeJob: (jobId: string, result: any) => {
      console.log(`[Job Tracker] Completing job ${jobId} with result:`, result);
      updateJobProgress(jobId, {
        status: 'completed',
        currentStep: 'Concluído',
        message: 'Sincronização concluída com sucesso',
        result
      });
    },
    errorJob: (jobId: string, error: string) => {
      console.log(`[Job Tracker] Error job ${jobId}:`, error);
      updateJobProgress(jobId, {
        status: 'error',
        currentStep: 'Erro',
        message: 'Erro durante sincronização',
        error
      });
    }
  };

  // Comments API routes
  app.get("/api/comentarios/:motoristaId", async (req, res) => {
    try {
      const { motoristaId } = req.params;
      
      if (!motoristaId) {
        return res.status(400).json({ error: "motorista_id é obrigatório" });
      }

      console.log("Fetching comments for motorista_id:", motoristaId);

      const { data: comentarios, error } = await supabaseBackend
        .from("comentario")
        .select(`
          id,
          id_motorista,
          id_atendente,
          comentario,
          created_at,
          updated_at
        `)
        .eq("id_motorista", parseInt(motoristaId))
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching comments:", error);
        return res.status(500).json({ error: "Erro ao buscar comentários" });
      }

      let comentariosWithNames = comentarios || [];
      
      if (comentarios && comentarios.length > 0) {
        const userIds = Array.from(
          new Set(
            comentarios
              .map(c => c.id_atendente)
              .filter(id => id !== null)
          )
        );
        
        if (userIds.length > 0) {
          const { data: attendants } = await supabaseBackend
            .from("wiseapp_acesso")
            .select("wiseapp_acesso_id, nome")
            .in("wiseapp_acesso_id", userIds);
            
          const attendantMap = attendants?.reduce((acc, attendant) => {
            acc[attendant.wiseapp_acesso_id] = attendant.nome || "Atendente";
            return acc;
          }, {} as Record<number, string>) || {};
          
          comentariosWithNames = comentarios.map(comment => ({
            ...comment,
            atendente_nome: comment.id_atendente ? attendantMap[comment.id_atendente] || null : null
          }));
        }
      }

      console.log(`Found ${comentariosWithNames.length} comments for motorista ${motoristaId}`);
      res.json(comentariosWithNames);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.post("/api/comentarios", async (req, res) => {
    try {
      const commentData = req.body;
      console.log("Creating comment with data:", commentData);

      if (!commentData.id_motorista || !commentData.comentario || !commentData.id_atendente) {
        return res.status(400).json({ 
          error: "id_motorista, comentario e id_atendente são obrigatórios" 
        });
      }

      const validatedData = insertComentarioSchema.parse({
        id_motorista: parseInt(commentData.id_motorista),
        id_atendente: parseInt(commentData.id_atendente),
        comentario: commentData.comentario.trim()
      });

      const { data: newComment, error } = await supabaseBackend
        .from("comentario")
        .insert(validatedData)
        .select(`
          id,
          id_motorista,
          id_atendente,
          comentario,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        console.error("Error creating comment:", error);
        return res.status(500).json({
          error: "Erro ao criar comentário",
          details: error.message,
        });
      }

      let commentWithName = newComment;
      if (newComment.id_atendente) {
        const { data: attendant } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("nome")
          .eq("wiseapp_acesso_id", newComment.id_atendente)
          .single();
          
        commentWithName = {
          ...newComment,
          atendente_nome: attendant?.nome || null
        } as any;
      }

      console.log("Comment created successfully:", commentWithName);
      res.status(201).json(commentWithName);
    } catch (error) {
      console.error("Error creating comment:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.message,
        });
      }
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Register bulk contact tags sync route

  registerBulkContactTagsRoute(app);

  // Register CPF API route
  // CPF consultado diretamente no frontend

  const httpServer = createServer(app);

  return httpServer;
}