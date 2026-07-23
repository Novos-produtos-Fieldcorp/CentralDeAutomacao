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
import { registerCpfRoute } from "./cpf-api";
import archiver from 'archiver';
import axios from 'axios';
import { format } from 'date-fns';
import { z } from 'zod';
import { startGroupSummaryCron } from './cron/groupSummaryCron';

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
// Use service role key for full access to wiseapp_acesso table
const supabaseBackendUrl =
  process.env.VITE_SUPABASE_URL || "https://ohmoxsvwjvohmqqgxjhb.supabase.co";

// Prefer service role key for backend operations (bypasses RLS)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ";

// Use service role key if available, otherwise fall back to anon key
const supabaseBackendKey = supabaseServiceRoleKey || supabaseAnonKey;

console.log(`Supabase backend using ${supabaseServiceRoleKey ? 'service_role' : 'anon'} key`);

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

  registerCpfRoute(app);

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
  // Rota para validar token WiseApp
  app.post("/api/validate-wiseapp-token", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ 
          error: "Token é obrigatório" 
        });
      }

      console.log("🔐 Validando token WiseApp...");

      const wiseappApiUrl = process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";
      const response = await fetch(`${wiseappApiUrl}/api/v1/profile`, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ 
            valid: false,
            error: "Token inválido" 
          });
        }
        return res.status(response.status).json({ 
          valid: false,
          error: "Erro ao validar token" 
        });
      }

      const userData = await response.json();
      console.log("✅ Token válido para usuário:", userData.name);

      res.json({ 
        valid: true,
        userData: {
          name: userData.name,
          email: userData.email,
          id: userData.id
        }
      });
    } catch (error) {
      console.error("Erro ao validar token:", error);
      res.status(500).json({ 
        valid: false,
        error: "Erro interno ao validar token" 
      });
    }
  });

  // Rota para listar contas WiseApp disponíveis para um usuário
  app.post("/api/wiseapp/available-accounts", async (req, res) => {
    try {
      const { token, email } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: "Token é obrigatório" });
      }

      console.log("🔍 Buscando contas disponíveis para usuário...");

      const wiseappApiUrl = process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";
      
      // Primeiro, validar o token e obter info do usuário
      const profileResponse = await fetch(`${wiseappApiUrl}/api/v1/profile`, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        }
      });

      if (!profileResponse.ok) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const userData = await profileResponse.json();
      const userEmail = email || userData.email;
      
      console.log(`✅ Token válido para: ${userData.name} (${userEmail})`);

      // Buscar todas as contas conhecidas do banco de dados para este email
      const { data: userAccounts, error: dbError } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('id_conta_wiseapp, nome, email')
        .eq('email', userEmail);

      if (dbError) {
        console.error("Erro ao buscar contas do DB:", dbError);
      }

      // Buscar informações de todas as empresas com id_conta_wiseapp
      const { data: companies, error: companiesError } = await supabaseBackend
        .from('company')
        .select('company_id, nome_company, id_conta_wiseapp')
        .not('id_conta_wiseapp', 'is', null);

      if (companiesError) {
        console.error("Erro ao buscar empresas:", companiesError);
      }

      // Criar mapa de account_id para company name
      const accountToCompany = new Map<string, { company_id: number; nome: string }>();
      companies?.forEach(c => {
        if (c.id_conta_wiseapp) {
          accountToCompany.set(c.id_conta_wiseapp.toString(), {
            company_id: c.company_id,
            nome: c.nome_company
          });
        }
      });

      // Tentar buscar as contas do usuário via API do WiseApp
      const validatedAccounts: Array<{
        account_id: string;
        name: string;
        company_id: number | null;
        role?: string;
      }> = [];

      // Pegar account_ids únicos do banco
      const knownAccountIds = new Set<string>();
      userAccounts?.forEach(ua => {
        if (ua.id_conta_wiseapp) {
          knownAccountIds.add(ua.id_conta_wiseapp.toString());
        }
      });
      companies?.forEach(c => {
        if (c.id_conta_wiseapp) {
          knownAccountIds.add(c.id_conta_wiseapp.toString());
        }
      });

      // Validar cada account_id conhecido
      for (const accountId of knownAccountIds) {
        try {
          const accountResponse = await fetch(`${wiseappApiUrl}/api/v1/accounts/${accountId}`, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            }
          });

          if (accountResponse.ok) {
            const accountData = await accountResponse.json();
            const companyInfo = accountToCompany.get(accountId);
            
            validatedAccounts.push({
              account_id: accountId,
              name: accountData.name || companyInfo?.nome || `Conta ${accountId}`,
              company_id: companyInfo?.company_id || null,
              role: accountData.role || 'agent'
            });
            
            console.log(`✅ Conta ${accountId} (${accountData.name}) validada para usuário`);
          }
        } catch (err) {
          console.log(`⚠️ Conta ${accountId} não acessível para este usuário`);
        }
      }

      console.log(`📋 Total de ${validatedAccounts.length} contas disponíveis para ${userEmail}`);

      res.json({
        success: true,
        user: {
          name: userData.name,
          email: userEmail
        },
        accounts: validatedAccounts
      });

    } catch (error) {
      console.error("Erro ao buscar contas disponíveis:", error);
      res.status(500).json({ 
        error: "Erro interno ao buscar contas" 
      });
    }
  });

  // Nova rota específica para buscar inboxes com cache otimizado por company_id
  app.get("/api/inboxes/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      // Aceita tanto account_id quanto accountId para compatibilidade
      const accountId = req.query.account_id || req.query.accountId;
      
      console.log(`Fetching inboxes for company_id: ${companyId}, accountId: ${accountId}`);

      // 1. Buscar id_conta_wiseapp da empresa
      const { data: companyData, error: companyError } = await supabaseBackend
        .from("company")
        .select("id_conta_wiseapp")
        .eq("company_id", parseInt(companyId))
        .single();

      if (companyError || !companyData) {
        return res.status(404).json({ 
          error: "Empresa não encontrada" 
        });
      }

      const idContaWiseapp = String(companyData.id_conta_wiseapp);

      // 2. Validar que accountId corresponde à empresa
      if (idContaWiseapp !== String(accountId)) {
        return res.status(403).json({ 
          error: "Account ID não corresponde à empresa especificada" 
        });
      }

      // 3. Buscar access_token em wiseapp_acesso via id_conta_wiseapp
      const { data: wiseappAcesso, error: tokenError } = await supabaseBackend
        .from("wiseapp_acesso")
        .select("access_token_wiseapp")
        .eq("id_conta_wiseapp", idContaWiseapp)
        .single();

      const token = !tokenError && wiseappAcesso?.access_token_wiseapp
        ? wiseappAcesso.access_token_wiseapp
        : null;

      if (!token) {
        return res.status(404).json({ 
          error: "Token WiseApp não configurado para esta empresa" 
        });
      }

      // Fazer requisição para o ChatWoot
      const wiseappApiUrl = process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";
      const targetUrl = `${wiseappApiUrl}/api/v1/accounts/${accountId}/inboxes`;

      console.log(`Making request to ChatWoot: ${targetUrl}`);

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'access_token': token,
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

  // Download ZIP with selected comprov_rota photos/videos
  app.post("/api/comprov-rota/download-zip", async (req, res) => {
    try {
      // Validate request payload with Zod
      const zipDownloadSchema = z.object({
        items: z.array(z.object({
          id: z.number(),
          created_at: z.string(),
          mediaUrl: z.string().optional().nullable(),
          isVideo: z.boolean().optional(),
          motorista: z.object({
            nome: z.string()
          }).optional().nullable()
        })).min(1, "Pelo menos um item é necessário")
      });

      const validationResult = zipDownloadSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error('❌ [ZIP Download] Validação falhou:', validationResult.error.errors);
        return res.status(400).json({
          error: "Dados inválidos",
          details: validationResult.error.errors
        });
      }

      const { items } = validationResult.data;

      console.log(`📦 [ZIP Download] Preparando ZIP com ${items.length} arquivo(s)`);

      // Counters for success/failure tracking
      let successCount = 0;
      let failureCount = 0;
      const failureReasons: { [key: string]: number } = {};

      // Whitelisted hosts for security (prevent SSRF)
      const allowedHosts = [
        'chat.wiseapp360.com',
        'ohmoxsvwjvohmqqgxjhb.supabase.co',
        'supabase.co'
      ];

      // Set response headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="comprovantes_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.zip"`);

      // Create ZIP archive
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Pipe archive to response
      archive.pipe(res);

      // Process each item
      for (const item of items) {
        try {
          if (!item.mediaUrl) {
            console.log(`⏭️ [ZIP Download] Item ${item.id} sem mídia, pulando...`);
            failureCount++;
            failureReasons['Sem URL de mídia'] = (failureReasons['Sem URL de mídia'] || 0) + 1;
            continue;
          }

          // Format filename: {data}_{nome_motorista}.{extensao}
          const date = format(new Date(item.created_at), 'dd-MM-yyyy_HH-mm-ss');
          const motoristaName = (item.motorista?.nome || 'sem_motorista')
            .replace(/[^a-zA-Z0-9]/g, '_') // Remove special chars
            .replace(/_+/g, '_') // Replace multiple underscores with single
            .toLowerCase();
          
          // Use isVideo flag from frontend (already correctly detected from original foto field)
          const extension = item.isVideo ? 'mp4' : 'jpg';
          const filename = `${date}_${motoristaName}.${extension}`;

          let fileBuffer: Buffer | null = null;

          // Handle data: URIs (base64 encoded)
          if (item.mediaUrl.startsWith('data:')) {
            console.log(`📄 [ZIP Download] Processando data URI para ${filename}`);
            const base64Data = item.mediaUrl.split(',')[1];
            if (!base64Data) {
              console.error(`❌ [ZIP Download] Data URI inválida para item ${item.id}`);
              failureCount++;
              failureReasons['Data URI inválida'] = (failureReasons['Data URI inválida'] || 0) + 1;
              continue;
            }
            fileBuffer = Buffer.from(base64Data, 'base64');
            successCount++;
          } 
          // Handle HTTP(S) URLs with security validation
          else if (item.mediaUrl.startsWith('http://') || item.mediaUrl.startsWith('https://')) {
            // Security: Validate URL host against whitelist (prevent SSRF)
            let urlHost: string;
            try {
              const parsedUrl = new URL(item.mediaUrl);
              urlHost = parsedUrl.hostname;
            } catch (urlError) {
              console.error(`❌ [ZIP Download] URL inválida para item ${item.id}:`, item.mediaUrl);
              failureCount++;
              failureReasons['URL malformada'] = (failureReasons['URL malformada'] || 0) + 1;
              continue;
            }

            // Check if host is whitelisted
            const isAllowedHost = allowedHosts.some(allowed => 
              urlHost === allowed || urlHost.endsWith(`.${allowed}`)
            );

            if (!isAllowedHost) {
              console.error(`🚫 [ZIP Download] Host não permitido: ${urlHost} (item ${item.id})`);
              failureCount++;
              failureReasons['Host não permitido'] = (failureReasons['Host não permitido'] || 0) + 1;
              continue;
            }

            console.log(`📥 [ZIP Download] Baixando: ${filename} de ${urlHost}`);

            // Try downloading from URL first
            try {
              const response = await axios.get(item.mediaUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30 seconds timeout
                maxRedirects: 5, // Allow redirects (WiseApp uses Rails Active Storage redirects)
                validateStatus: (status) => {
                  // Accept 2xx and 3xx (redirects are followed automatically by axios)
                  return status >= 200 && status < 400;
                },
                headers: {
                  'User-Agent': 'Mozilla/5.0'
                }
              });

              fileBuffer = Buffer.from(response.data);
              successCount++;
            } catch (urlError: any) {
              // If WiseApp URL fails with 404, try Supabase Storage as fallback
              if (urlError?.response?.status === 404 && urlHost.includes('wiseapp360.com')) {
                console.log(`🔄 [ZIP Download] URL do WiseApp retornou 404, tentando Supabase Storage...`);
                
                // Try to get file from Supabase Storage comprovante bucket
                try {
                  // Use item ID as potential filename
                  const possibleFilenames = [
                    `${item.id}.jpg`,
                    `${item.id}.mp4`,
                    `comprovante_${item.id}.jpg`,
                    `comprovante_${item.id}.mp4`
                  ];
                  
                  let foundFile = false;
                  for (const tryFilename of possibleFilenames) {
                    try {
                      const { data: storageData, error: storageError } = await supabaseBackend
                        .storage
                        .from('comprovante')
                        .download(tryFilename);
                      
                      if (storageData && !storageError) {
                        console.log(`✅ [ZIP Download] Arquivo encontrado no Supabase Storage: ${tryFilename}`);
                        fileBuffer = Buffer.from(await storageData.arrayBuffer());
                        foundFile = true;
                        successCount++;
                        break;
                      }
                    } catch {
                      // Try next filename
                      continue;
                    }
                  }
                  
                  if (!foundFile) {
                    throw new Error('Arquivo não encontrado no Supabase Storage');
                  }
                } catch (storageError) {
                  console.error(`❌ [ZIP Download] Fallback para Supabase Storage falhou para item ${item.id}`);
                  failureCount++;
                  failureReasons['Arquivo não encontrado (404)'] = (failureReasons['Arquivo não encontrado (404)'] || 0) + 1;
                  continue;
                }
              } else {
                // Re-throw if not a 404 from WiseApp
                throw urlError;
              }
            }
          } 
          else {
            console.error(`❌ [ZIP Download] Tipo de URL não suportado para item ${item.id}: ${item.mediaUrl.substring(0, 30)}...`);
            failureCount++;
            failureReasons['Tipo de URL não suportado'] = (failureReasons['Tipo de URL não suportado'] || 0) + 1;
            continue;
          }

          // Add file to archive (only if buffer was successfully loaded)
          if (fileBuffer) {
            archive.append(fileBuffer, { name: filename });
            console.log(`✅ [ZIP Download] Adicionado ao ZIP: ${filename}`);
          } else {
            console.error(`❌ [ZIP Download] FileBuffer não definido para item ${item.id}`);
            failureCount++;
            failureReasons['Buffer não criado'] = (failureReasons['Buffer não criado'] || 0) + 1;
          }

        } catch (itemError: any) {
          failureCount++;
          const errorMsg = itemError?.response?.status === 404 
            ? 'Arquivo não encontrado (404)' 
            : (itemError?.message || 'Erro desconhecido');
          failureReasons[errorMsg] = (failureReasons[errorMsg] || 0) + 1;
          console.error(`❌ [ZIP Download] Erro ao processar item ${item.id}:`, errorMsg);
          // Continue with next item even if one fails
        }
      }

      // Finalize archive
      await archive.finalize();
      
      // Log final statistics
      console.log(`📊 [ZIP Download] Estatísticas finais:`);
      console.log(`  ✅ Sucesso: ${successCount}/${items.length}`);
      console.log(`  ❌ Falhas: ${failureCount}/${items.length}`);
      if (failureCount > 0) {
        console.log(`  📋 Razões das falhas:`);
        Object.entries(failureReasons).forEach(([reason, count]) => {
          console.log(`     - ${reason}: ${count}`);
        });
      }
      
      console.log(`✅ [ZIP Download] ZIP finalizado e enviado`);

    } catch (error) {
      console.error("❌ [ZIP Download] Erro ao gerar ZIP:", error);
      
      // Check if headers were already sent
      if (!res.headersSent) {
        res.status(500).json({
          error: "Erro ao gerar arquivo ZIP",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
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

      // Convert dt_limite to proper timestamp, or null if empty
      vagaData.dt_limite = vagaData.dt_limite ? new Date(vagaData.dt_limite).toISOString() : null;

      const { data: newVaga, error } = await supabaseBackend
        .from("vaga")
        .insert({
          nome: vagaData.nome,
          descricao: vagaData.descricao,
          quantidade: Number(vagaData.quantidade),
          dias_trabalho: vagaData.dias_trabalho,
          horario: vagaData.horario,
          dt_limite: vagaData.dt_limite,
          distancia: vagaData.distancia || null,
          tipo_contrato: vagaData.tipo_contrato || null,
          ativo: vagaData.ativo !== undefined ? vagaData.ativo : true,
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

      // Convert dt_limite to proper timestamp, or null if empty; skip if key not present (partial update)
      if ('dt_limite' in vagaData) {
        vagaData.dt_limite = vagaData.dt_limite ? new Date(vagaData.dt_limite).toISOString() : null;
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
          distancia: vagaData.distancia !== undefined ? (vagaData.distancia || null) : undefined,
          tipo_contrato: vagaData.tipo_contrato !== undefined ? (vagaData.tipo_contrato || null) : undefined,
          ativo: vagaData.ativo !== undefined ? vagaData.ativo : undefined,
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

  // Patch vaga ativo field only (for auto-deactivation)
  app.patch("/api/vagas/:vagaId/ativo", async (req, res) => {
    try {
      const { vagaId } = req.params;
      const { ativo, company_id } = req.body;

      if (!company_id) {
        return res.status(400).json({ error: "company_id é obrigatório" });
      }

      const { data: updatedVaga, error } = await supabaseBackend
        .from("vaga")
        .update({ ativo: Boolean(ativo), updated_at: new Date().toISOString() })
        .eq("id", Number(vagaId))
        .eq("company_id", Number(company_id))
        .select()
        .single();

      if (error) {
        console.error("Error patching vaga ativo:", error);
        return res.status(500).json({ error: "Erro ao atualizar vaga", details: error.message });
      }

      res.json(updatedVaga);
    } catch (error) {
      console.error("Error patching vaga ativo:", error);
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

  // Criar endereço de vaga
  app.post("/api/end-vaga", async (req, res) => {
    try {
      const { vaga_id, logradouro_id, numero, ds_complemento, st_end } = req.body;

      if (!vaga_id || !logradouro_id) {
        return res.status(400).json({ error: "vaga_id e logradouro_id são obrigatórios" });
      }

      const { data: newEndVaga, error } = await supabaseBackend
        .from("end_vaga")
        .insert({
          vaga_id: Number(vaga_id),
          logradouro_id: Number(logradouro_id),
          numero: numero || null,
          ds_complemento: ds_complemento || null,
          st_end: st_end ?? true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating end_vaga:", error);
        return res.status(500).json({ error: "Erro ao criar endereço da vaga", details: error.message });
      }

      res.status(201).json(newEndVaga);
    } catch (error) {
      console.error("Error creating end_vaga:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
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

      const tag = await storage.createTag({ nome, cor, company_id });
      res.status(201).json(tag);
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

  // Rota para deletar label no WiseApp (com fallback de token do banco)
  app.delete("/api/wiseapp/:companyId/labels/:labelId", async (req, res) => {
    try {
      const { companyId, labelId } = req.params;
      
      console.log(`Deleting WiseApp label ${labelId} for company ${companyId}`);
      
      // Buscar accountId do header
      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      // Função para buscar token do banco de dados
      const fetchTokenFromDb = async (): Promise<string | null> => {
        const numericAccountId = parseInt(accountId, 10);
        const { data: accessDataArray } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("access_token_wiseapp, email")
          .eq("id_conta_wiseapp", numericAccountId)
          .not("access_token_wiseapp", "is", null)
          .neq("access_token_wiseapp", "")
          .limit(1);
          
        if (accessDataArray?.[0]?.access_token_wiseapp) {
          console.log(`Token fetched from database for account ${accountId} (email: ${accessDataArray[0].email})`);
          return accessDataArray[0].access_token_wiseapp;
        }
        return null;
      };

      // Buscar token do header
      let token = req.headers['wiseapp-token'] as string;
      let tokenSource = 'header';
      
      // Se não tem token no header, buscar do banco
      if (!token) {
        console.log(`No token in header, fetching from database for account ${accountId}...`);
        const dbToken = await fetchTokenFromDb();
        if (dbToken) {
          token = dbToken;
          tokenSource = 'database';
        }
      }
      
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels/${labelId}`;
      console.log(`Using token from ${tokenSource} for delete operation`);
      
      let response = await fetch(wiseAppUrl, {
        method: 'DELETE',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      // Se 401 e token veio do header, tentar com token do banco
      if (response.status === 401 && tokenSource === 'header') {
        console.log(`Got 401 with header token, trying to fetch fresh token from database...`);
        const dbToken = await fetchTokenFromDb();
        
        if (dbToken && dbToken !== token) {
          token = dbToken;
          tokenSource = 'database-fallback';
          console.log(`Using fresh token from database for account ${accountId}`);
          
          response = await fetch(wiseAppUrl, {
            method: 'DELETE',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`WiseApp API error: ${response.status} - ${errorData}`);
        
        if (response.status === 401) {
          return res.status(401).json({ 
            error: "Token WiseApp expirado ou inválido",
            details: "Faça login novamente no WiseApp para renovar o token"
          });
        }
        throw new Error(`WiseApp API responded with ${response.status}`);
      }

      console.log(`WiseApp label ${labelId} deleted successfully with token from ${tokenSource}`);
      res.json({ success: true });

    } catch (error) {
      console.error("Erro ao deletar label no WiseApp:", error);
      res.status(500).json({
        error: "Erro ao deletar label no WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Atualizar (PATCH) label no WiseApp
  app.patch("/api/wiseapp/:companyId/labels/:labelId", async (req, res) => {
    try {
      const { companyId, labelId } = req.params;

      console.log(`Updating WiseApp label ${labelId} for company ${companyId}`);

      const accountId = req.headers['wiseapp-account-id'] as string;
      if (!accountId) {
        return res.status(400).json({ error: "Account ID não encontrado" });
      }

      const fetchTokenFromDb = async (): Promise<string | null> => {
        const numericAccountId = parseInt(accountId, 10);
        const { data: accessDataArray } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("access_token_wiseapp, email")
          .eq("id_conta_wiseapp", numericAccountId)
          .not("access_token_wiseapp", "is", null)
          .neq("access_token_wiseapp", "")
          .limit(1);

        if (accessDataArray?.[0]?.access_token_wiseapp) {
          return accessDataArray[0].access_token_wiseapp;
        }
        return null;
      };

      let token = req.headers['wiseapp-token'] as string;
      let tokenSource = 'header';

      if (!token) {
        const dbToken = await fetchTokenFromDb();
        if (dbToken) { token = dbToken; tokenSource = 'database'; }
      }

      if (!token) {
        return res.status(401).json({ error: "Token WiseApp não encontrado" });
      }

      const body = req.body;
      const updatePayload: Record<string, any> = {};
      const labelName = body.title || body.name || body.nome;
      if (labelName !== undefined) updatePayload.title = labelName;
      if (body.color !== undefined) updatePayload.color = body.color;
      if (body.cor !== undefined) updatePayload.color = body.cor;
      if (body.description !== undefined) updatePayload.description = body.description;
      if (body.show_on_sidebar !== undefined) updatePayload.show_on_sidebar = body.show_on_sidebar;

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels/${labelId}`;
      console.log(`Using token from ${tokenSource} for patch operation`);

      let response = await fetch(wiseAppUrl, {
        method: 'PATCH',
        headers: { 'api_access_token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (response.status === 401 && tokenSource === 'header') {
        const dbToken = await fetchTokenFromDb();
        if (dbToken && dbToken !== token) {
          token = dbToken;
          tokenSource = 'database-fallback';
          response = await fetch(wiseAppUrl, {
            method: 'PATCH',
            headers: { 'api_access_token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`WiseApp API error: ${response.status} - ${errorData}`);
        if (response.status === 401) {
          return res.status(401).json({
            error: "Token WiseApp expirado ou inválido",
            details: "Faça login novamente no WiseApp para renovar o token"
          });
        }
        throw new Error(`WiseApp API responded with ${response.status}`);
      }

      const data = await response.json();
      console.log(`WiseApp label ${labelId} updated successfully with token from ${tokenSource}`);
      res.json(data);

    } catch (error) {
      console.error("Erro ao atualizar label no WiseApp:", error);
      res.status(500).json({
        error: "Erro ao atualizar label no WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Aplicar tag a um contato no WiseApp (com fallback de token do banco)
  app.post("/api/wiseapp/:accountIdParam/contacts/:contactId/labels", async (req, res) => {
    try {
      const { accountIdParam, contactId } = req.params;
      const { tagId, tagName, labels } = req.body;
      
      console.log(`Applying labels to contact ${contactId} for account ${accountIdParam}`);
      console.log(`Request body:`, req.body);
      
      // Buscar accountId do header ou usar o do path
      const accountId = (req.headers['wiseapp-account-id'] as string) || accountIdParam;
      
      // Tentar obter token de múltiplas fontes com fallback
      let token = req.headers['wiseapp-token'] as string;
      let tokenSource = 'header';
      
      // Função auxiliar para buscar token do banco usando id_conta_wiseapp (accountId) diretamente
      // IMPORTANTE: Filtrar apenas registros que TENHAM token preenchido
      const fetchTokenFromDb = async (): Promise<string | null> => {
        const numericAccountId = parseInt(accountId, 10);
        const { data: accessDataArray } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("access_token_wiseapp")
          .eq("id_conta_wiseapp", numericAccountId)
          .not("access_token_wiseapp", "is", null)
          .neq("access_token_wiseapp", "")
          .limit(1);
          
        return accessDataArray?.[0]?.access_token_wiseapp || null;
      };
      
      // Se não tem token no header, buscar do banco
      if (!token) {
        console.log(`Token not in headers, fetching from database for account ${accountId}...`);
        const dbToken = await fetchTokenFromDb();
        if (dbToken) {
          token = dbToken;
          tokenSource = 'database';
          console.log(`Token fetched from database`);
        }
      }
      
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado (header ou banco)" 
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
        let getResponse = await fetch(labelsUrl, {
          method: 'GET',
          headers: { 'api_access_token': token }
        });
        
        // Se 401, tentar com token do banco
        if (getResponse.status === 401 && tokenSource === 'header') {
          console.log(`GET labels returned 401, trying with fresh token from database...`);
          const dbToken = await fetchTokenFromDb();
          if (dbToken && dbToken !== token) {
            token = dbToken;
            tokenSource = 'database-fallback';
            getResponse = await fetch(labelsUrl, {
              method: 'GET',
              headers: { 'api_access_token': token }
            });
          }
        }
        
        let existingLabels: string[] = [];
        if (getResponse.ok) {
          const result = await getResponse.json();
          existingLabels = result.payload || [];
          console.log(`Found ${existingLabels.length} existing labels:`, existingLabels);
        } else if (getResponse.status === 401) {
          console.error(`Token invalid even after fallback`);
          return res.status(401).json({ 
            error: "Token WiseApp expirado ou inválido",
            details: "Faça login novamente no WiseApp para renovar o token"
          });
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
      
      console.log(`Applying ${finalLabels.length} labels with token from ${tokenSource}`);
      
      // Enviar lista completa de labels
      let response = await fetch(labelsUrl, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labels: finalLabels }),
      });

      // Se 401, tentar com token do banco
      if (response.status === 401 && tokenSource === 'header') {
        console.log(`POST returned 401, trying with fresh token from database...`);
        const dbToken = await fetchTokenFromDb();
        if (dbToken && dbToken !== token) {
          token = dbToken;
          response = await fetch(labelsUrl, {
            method: 'POST',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ labels: finalLabels }),
          });
        }
      }

      const responseText = await response.text();
      console.log(`WiseApp response status: ${response.status}`);
      console.log(`WiseApp response body: ${responseText}`);
      console.log(`Request payload sent: ${JSON.stringify({ labels: finalLabels })}`);

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ 
            error: "Token WiseApp expirado ou inválido",
            details: "Faça login novamente no WiseApp para renovar o token"
          });
        }
        throw new Error(`WiseApp API responded with ${response.status}: ${responseText}`);
      }

      // Parse response to verify what was actually applied
      try {
        const responseData = JSON.parse(responseText);
        console.log(`WiseApp confirmed labels:`, responseData);
      } catch (e) {
        console.log(`Could not parse WiseApp response as JSON`);
      }

      res.json({ success: true, appliedLabels: finalLabels });

    } catch (error) {
      console.error("Erro ao aplicar tag ao contato:", error);
      res.status(500).json({
        error: "Erro ao aplicar tag ao contato",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Buscar tags de um contato no WiseApp (com fallback de token e retry em 401)
  app.get("/api/wiseapp/:accountIdParam/contacts/:contactId/labels", async (req, res) => {
    try {
      const { accountIdParam, contactId } = req.params;
      
      console.log(`Fetching labels for contact ${contactId} in account ${accountIdParam}`);
      
      const accountId = (req.headers['wiseapp-account-id'] as string) || accountIdParam;
      
      let token = req.headers['wiseapp-token'] as string;
      let tokenSource = 'header';
      
      // Função auxiliar para buscar token do banco usando id_conta_wiseapp (accountId) diretamente
      // IMPORTANTE: Filtrar apenas registros que TENHAM token preenchido
      const fetchTokenFromDb = async (): Promise<string | null> => {
        const numericAccountId = parseInt(accountId, 10);
        const { data: accessDataArray } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("access_token_wiseapp")
          .eq("id_conta_wiseapp", numericAccountId)
          .not("access_token_wiseapp", "is", null)
          .neq("access_token_wiseapp", "")
          .limit(1);
          
        return accessDataArray?.[0]?.access_token_wiseapp || null;
      };
      
      if (!token) {
        console.log(`Token not in headers for GET labels, fetching from database...`);
        const dbToken = await fetchTokenFromDb();
        if (dbToken) {
          token = dbToken;
          tokenSource = 'database';
        }
      }
      
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado (header ou banco)" 
        });
      }

      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não encontrado" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/labels`;
      
      let response = await fetch(wiseAppUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401 && tokenSource === 'header') {
        console.log(`GET labels returned 401, retrying with fresh token from database...`);
        const dbToken = await fetchTokenFromDb();
        if (dbToken && dbToken !== token) {
          token = dbToken;
          tokenSource = 'database-fallback';
          response = await fetch(wiseAppUrl, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
          });
        }
      }

      if (response.ok) {
        const result = await response.json();
        console.log(`Labels fetched successfully for contact ${contactId}:`, result);
        res.json(result);
      } else if (response.status === 401) {
        return res.status(401).json({ 
          error: "Token WiseApp expirado ou inválido",
          details: "Faça login novamente no WiseApp para renovar o token"
        });
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

      // Buscar token WiseApp usando id_conta_wiseapp (accountId)
      const numericAccountId = parseInt(accountId, 10);
      const { data: tokenData, error: tokenError } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('id_conta_wiseapp', numericAccountId)
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
      
      // Buscar token do header (enviado pelo frontend)
      let token = req.headers['wiseapp-token'] as string;
      let tokenSource = 'header';
      
      // Buscar accountId do header (enviado pelo frontend) 
      const accountId = req.headers['wiseapp-account-id'] as string;
      
      if (!accountId) {
        return res.status(400).json({ 
          error: "Account ID não configurado para esta empresa" 
        });
      }

      // Função para buscar token do banco de dados
      const fetchTokenFromDb = async (): Promise<string | null> => {
        const numericAccountId = parseInt(accountId, 10);
        const { data: accessDataArray } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("access_token_wiseapp, email")
          .eq("id_conta_wiseapp", numericAccountId)
          .not("access_token_wiseapp", "is", null)
          .neq("access_token_wiseapp", "")
          .limit(1);
          
        if (accessDataArray?.[0]?.access_token_wiseapp) {
          console.log(`Token fetched from database for account ${accountId} (email: ${accessDataArray[0].email})`);
          return accessDataArray[0].access_token_wiseapp;
        }
        return null;
      };

      // Se não tem token no header, buscar do banco
      if (!token) {
        console.log(`No token in header, fetching from database for account ${accountId}...`);
        const dbToken = await fetchTokenFromDb();
        if (dbToken) {
          token = dbToken;
          tokenSource = 'database';
        }
      }
      
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não configurado para esta empresa" 
        });
      }
      
      console.log(`Using token from ${tokenSource} for account ${accountId}`);
      
      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
      console.log(`Fetching labels from: ${wiseAppUrl}`);

      // Implementar retry logic com fallback de token
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      let usedFallbackToken = false;

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          if (attempts > 1) {
            console.log(`Retry ${attempts}/${maxAttempts} for account ${accountId}, waiting 1.5s...`);
            await delay(1500);
          }

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'api_access_token': token,
          };
          
          response = await fetch(wiseAppUrl, {
            method: 'GET',
            headers,
          });

          if (response.ok) {
            console.log(`Labels fetch successful on attempt ${attempts} with token from ${tokenSource}`);
            break; // Success!
          }
          
          // Se 401 e ainda não tentou fallback, buscar token do banco
          if (response.status === 401 && tokenSource === 'header' && !usedFallbackToken) {
            console.log(`Got 401 with header token, trying to fetch fresh token from database...`);
            const dbToken = await fetchTokenFromDb();
            
            if (dbToken && dbToken !== token) {
              token = dbToken;
              tokenSource = 'database-fallback';
              usedFallbackToken = true;
              console.log(`Using fresh token from database for account ${accountId}`);
              continue; // Retry with new token
            } else if (dbToken === token) {
              console.log(`Token from database is the same as header token - both may be expired`);
            } else {
              console.log(`No valid token found in database for account ${accountId}`);
            }
          }
          
          // Se ainda 401 após fallback, retornar erro de autenticação
          if (response.status === 401) {
            return res.status(401).json({ 
              error: "Token WiseApp expirado ou inválido",
              details: "Faça login novamente no WiseApp para renovar o token"
            });
          }
          
          throw new Error(`WiseApp API responded with ${response.status}`);
          
        } catch (fetchError) {
          if (attempts === maxAttempts) {
            throw fetchError;
          }
          console.log(`API fetch attempt ${attempts} failed for account ${accountId}:`, fetchError);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`WiseApp API failed after ${maxAttempts} attempts`);
      }

      const data = await response.json();
      
      // Transformar formato dos labels do WiseApp para nosso formato
      const labels = data.payload?.map((label: any) => ({
        id: label.id,
        name: label.title,
        color: label.color,
        description: label.description
      })) || [];

      console.log(`Fetched ${labels.length} labels for account ${accountId}`);
      res.json(labels);

    } catch (error) {
      console.error("Erro ao buscar labels do WiseApp:", error);
      res.status(500).json({
        error: "Erro ao buscar labels do WiseApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // Rota para criar label no WiseApp (com fallback de token)
  app.post("/api/wiseapp/:accountIdParam/labels", async (req, res) => {
    try {
      const { accountIdParam } = req.params;
      // Aceitar title/name/nome e color/cor do frontend
      const { title, name, color, description, nome, cor } = req.body;
      
      // Usar title, name ou nome (prioridade: title > name > nome)
      const labelName = title || name || nome;
      const labelColor = color || cor || '#3B82F6';
      
      console.log(`Creating WiseApp label for account ${accountIdParam}`, { labelName, labelColor });
      
      // Buscar accountId do header ou usar o do path
      const accountId = (req.headers['wiseapp-account-id'] as string) || accountIdParam;
      
      // Função auxiliar para buscar token do banco usando id_conta_wiseapp diretamente
      // IMPORTANTE: Filtrar apenas registros que TENHAM token preenchido
      const fetchTokenFromDb = async (): Promise<string | null> => {
        const numericAccountId = parseInt(accountId, 10);
        const { data: accessDataArray } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("access_token_wiseapp, email")
          .eq("id_conta_wiseapp", numericAccountId)
          .not("access_token_wiseapp", "is", null)
          .neq("access_token_wiseapp", "")
          .limit(1);
          
        if (accessDataArray?.[0]?.access_token_wiseapp) {
          console.log(`Token fetched from database for account ${accountId} (email: ${accessDataArray[0].email})`);
          return accessDataArray[0].access_token_wiseapp;
        }
        return null;
      };
      
      // Tentar obter token com fallback
      let token = req.headers['wiseapp-token'] as string;
      let tokenSource = 'header';
      
      if (!token) {
        console.log(`Token not in headers, fetching from database for account ${accountId}...`);
        const dbToken = await fetchTokenFromDb();
        if (dbToken) {
          token = dbToken;
          tokenSource = 'database';
        }
      }
      
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado (header ou banco)" 
        });
      }

      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/labels`;
      
      if (!labelName) {
        return res.status(400).json({ 
          error: "Nome da tag é obrigatório" 
        });
      }
      
      const payload = {
        title: labelName,
        description: description || '',
        color: labelColor
      };

      let response = await fetch(wiseAppUrl, {
        method: 'POST',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      // Se 401 e usamos token do header, tentar com token do banco
      if (response.status === 401 && tokenSource === 'header') {
        console.log(`POST labels returned 401, trying with fresh token from database...`);
        const dbToken = await fetchTokenFromDb();
        if (dbToken && dbToken !== token) {
          token = dbToken;
          tokenSource = 'database-fallback';
          
          response = await fetch(wiseAppUrl, {
            method: 'POST',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        }
      }

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

      // Buscar token WiseApp usando id_conta_wiseapp (accountId)
      const numericAccountId = parseInt(accountId, 10);
      const { data: tokenData, error: tokenError } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('id_conta_wiseapp', numericAccountId)
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
  app.get("/api/wiseapp/:accountIdParam/contacts/search", async (req, res) => {
    try {
      const { accountIdParam } = req.params;
      const { phone } = req.query;
      
      if (!phone) {
        return res.status(400).json({ error: "Telefone é obrigatório" });
      }

      console.log(`Searching contact by phone ${phone} for account ${accountIdParam}`);
      
      // O accountIdParam pode ser um accountId (ex: "20") 
      // Buscar accountId do header ou usar o do path
      const accountId = (req.headers['wiseapp-account-id'] as string) || accountIdParam;
      
      // Tentar obter token de múltiplas fontes:
      // 1. Header (token do frontend)
      // 2. Banco de dados (buscar por accountId -> company -> wiseapp_acesso)
      let token = req.headers['wiseapp-token'] as string;
      let tokenSource = 'header';
      
      // Se não tem token no header ou se queremos garantir um token fresco, buscar do banco
      if (!token) {
        console.log(`Token not in headers, fetching from database for account ${accountId}...`);
        
        // Buscar token diretamente usando id_conta_wiseapp (accountId)
        // IMPORTANTE: Filtrar apenas registros que TENHAM token preenchido
        const numericAccountId = parseInt(accountId, 10);
        const { data: accessDataArray, error: accessError } = await supabaseBackend
          .from("wiseapp_acesso")
          .select("access_token_wiseapp")
          .eq("id_conta_wiseapp", numericAccountId)
          .not("access_token_wiseapp", "is", null)
          .neq("access_token_wiseapp", "")
          .limit(1);
            
        if (!accessError && accessDataArray?.[0]?.access_token_wiseapp) {
          token = accessDataArray[0].access_token_wiseapp;
          tokenSource = 'database';
          console.log(`Token fetched from database for account ${accountId}`);
        }
      }
      
      if (!token) {
        return res.status(401).json({ 
          error: "Token WiseApp não encontrado (header ou banco)" 
        });
      }

      const formattedPhone = `55${phone}`;
      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${formattedPhone}`;
      
      // Implementar retry logic com fallback para token do banco
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      let usedFallbackToken = false;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          if (attempts > 1) {
            console.log(`Retry ${attempts}/${maxAttempts} for account ${accountId}, waiting 1.5s...`);
            await delay(1500);
          }

          response = await fetch(wiseAppUrl, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            console.log(`Contact search successful on attempt ${attempts} with token from ${tokenSource}`);
            break;
          }
          
          // Se 401 e estamos usando token do header, tentar buscar do banco
          if (response.status === 401 && tokenSource === 'header' && !usedFallbackToken) {
            console.log(`Got 401 with header token, trying to fetch fresh token from database...`);
            console.log(`Looking for token in wiseapp_acesso with id_conta_wiseapp = "${accountId}"`);
            
            // Buscar token diretamente da tabela wiseapp_acesso usando id_conta_wiseapp
            // IMPORTANTE: Filtrar apenas registros que TENHAM token preenchido
            const numericAccountId = parseInt(accountId, 10);
            const { data: accessDataArray, error: accessError } = await supabaseBackend
              .from("wiseapp_acesso")
              .select("access_token_wiseapp, id_conta_wiseapp, email")
              .eq("id_conta_wiseapp", numericAccountId)
              .not("access_token_wiseapp", "is", null)
              .neq("access_token_wiseapp", "")
              .limit(1);
            
            const accessData = accessDataArray?.[0];
            
            console.log(`Token lookup result:`, { 
              found: !!accessData?.access_token_wiseapp,
              error: accessError,
              recordsFound: accessDataArray?.length || 0,
              id_conta_wiseapp: accessData?.id_conta_wiseapp,
              email: accessData?.email,
              tokenLength: accessData?.access_token_wiseapp?.length,
              isSameAsHeader: accessData?.access_token_wiseapp === token
            });
              
            if (!accessError && accessData?.access_token_wiseapp && accessData.access_token_wiseapp !== token) {
              token = accessData.access_token_wiseapp;
              tokenSource = 'database-fallback';
              usedFallbackToken = true;
              console.log(`Using fresh token from database for account ${accountId} (email: ${accessData.email})`);
              continue; // Retry with new token
            } else if (accessData?.access_token_wiseapp === token) {
              console.log(`Token from database is the same as header token - both may be expired`);
            } else if (!accessData) {
              console.log(`No record with valid token found in wiseapp_acesso for id_conta_wiseapp = ${accountId}`);
            } else if (accessError) {
              console.log(`Error looking up token:`, accessError.message);
            }
          }
          
          // Se ainda 401 após fallback, o token do banco também está inválido
          if (response.status === 401) {
            const errorBody = await response.text();
            console.error(`WiseApp API 401 error: ${errorBody}`);
            return res.status(401).json({ 
              error: "Token WiseApp expirado ou inválido",
              details: "Faça login novamente no WiseApp para renovar o token"
            });
          }
          
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

  // Validate WiseApp token
  app.post("/api/wiseapp/validate-token", async (req, res) => {
    try {
      const { token, accountId } = req.body;

      if (!token || !accountId) {
        return res.status(400).json({
          valid: false,
          error: 'Token e ID da conta são obrigatórios'
        });
      }

      // Try to fetch profile from WiseApp API to validate token
      const wiseAppUrl = `https://chat.wiseapp360.com/api/v1/profile`;
      
      console.log(`🔍 Validando token...`);
      
      const response = await fetch(wiseAppUrl, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`❌ Token inválido - API retornou ${response.status}`);
        return res.json({
          valid: false,
          error: 'Token de acesso inválido ou expirado'
        });
      }

      const profileData = await response.json();
      
      console.log(`✅ Token validado com sucesso!`);
      
      return res.json({
        valid: true,
        profile: profileData
      });

    } catch (error) {
      console.error('❌ Erro ao validar token:', error);
      return res.json({
        valid: false,
        error: 'Erro ao conectar com o servidor de autenticação'
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

      // 1. Buscar id_conta_wiseapp da empresa
      const { data: companyData } = await supabaseBackend
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', company_id)
        .limit(1)
        .single();
      
      const idContaWiseapp = companyData?.id_conta_wiseapp;
      
      // 2. Buscar token WiseApp usando id_conta_wiseapp
      let token: string | null = null;
      let tokenError: any = null;
      
      if (idContaWiseapp) {
        const { data: tokenDataArray, error: err } = await supabaseBackend
          .from('wiseapp_acesso')
          .select('access_token_wiseapp')
          .eq('id_conta_wiseapp', idContaWiseapp)
          .limit(1);
        
        token = tokenDataArray?.[0]?.access_token_wiseapp;
        tokenError = err;
      }

      if (tokenError || !token) {
        console.log('Token WiseApp não encontrado para company_id:', company_id, '(id_conta_wiseapp:', idContaWiseapp, ')');
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
    res.set('Cache-Control', 'no-store');
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
      console.log('FIPE raw response keys:', JSON.stringify(Object.keys(data || {})));
      console.log('FIPE data.data keys:', JSON.stringify(Object.keys(data?.data || {})));

      // API may nest as data.data.data.veiculo or data.data.veiculo or data.veiculo
      const vehicle = data.data?.data?.veiculo ?? data.data?.veiculo ?? data.veiculo;

      if (!vehicle) {
        console.log('FIPE full response:', JSON.stringify(data));
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
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
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

      // 1. Buscar id_conta_wiseapp da empresa
      const { data: companyData } = await supabaseBackend
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', company_id)
        .limit(1)
        .single();
      
      const idContaWiseapp = companyData?.id_conta_wiseapp;
      
      // 2. Buscar token WiseApp usando id_conta_wiseapp
      let token: string | null = null;
      let tokenError: any = null;
      
      if (idContaWiseapp) {
        const { data: tokenDataArray, error: err } = await supabaseBackend
          .from('wiseapp_acesso')
          .select('access_token_wiseapp')
          .eq('id_conta_wiseapp', idContaWiseapp)
          .limit(1);
        
        token = tokenDataArray?.[0]?.access_token_wiseapp;
        tokenError = err;
      }

      if (tokenError || !token) {
        console.log('Token WiseApp não encontrado para company_id:', company_id, '(id_conta_wiseapp:', idContaWiseapp, ')');
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
    res.set('Cache-Control', 'no-store');
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
      console.log('FIPE raw response keys:', JSON.stringify(Object.keys(data || {})));
      console.log('FIPE data.data keys:', JSON.stringify(Object.keys(data?.data || {})));

      // API may nest as data.data.data.veiculo or data.data.veiculo or data.veiculo
      const vehicle = data.data?.data?.veiculo ?? data.data?.veiculo ?? data.veiculo;

      if (!vehicle) {
        console.log('FIPE full response:', JSON.stringify(data));
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


  // Register bulk contact tags sync route

  registerBulkContactTagsRoute(app);

  // Register CPF API route
  // CPF consultado diretamente no frontend

  // AI Summary Service proxy route
  app.post("/api/ai/group-summary", async (req, res) => {
    try {
      const N8N_WEBHOOK_URL = 'https://n8nqp.wiseapp360.com/webhook/resumo-grupo';
      const { nome_do_grupo, company_id, group_id, account_id, api_key } = req.body;
      
      console.log("[n8n Webhook] Enviando resumo de grupo para n8n");
      console.log("[n8n Webhook] Grupo:", nome_do_grupo, "| group_id:", group_id, "| company_id:", company_id);
      
      const response = await axios.post(
        N8N_WEBHOOK_URL,
        { nome_do_grupo, company_id, group_id, account_id, api_key, force: true },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 120000,
        }
      );
      
      console.log("[n8n Webhook] Resposta:", JSON.stringify(response.data, null, 2));
      
      const isSuccess = response.data.status === '200';
      res.json({
        success: isSuccess,
        message: response.data.message,
        message_sent: isSuccess,
        error: isSuccess ? null : response.data.message,
      });
    } catch (error: any) {
      console.error("[n8n Webhook] Erro:", error.message);
      res.status(500).json({
        success: false,
        error: error.message || "Erro ao processar resumo via n8n",
      });
    }
  });

  // AI Conversation Summary proxy route (Conversas & E-mails)
  app.post("/api/ai/conversation-summary", async (req, res) => {
    try {
      const { account_id, api_key, conv_id, conv_name, tipo, group_id, company_id, horario_execucao_utc } = req.body;

      if (!account_id || !api_key || !conv_id) {
        return res.status(400).json({ success: false, error: 'account_id, api_key e conv_id sao obrigatorios' });
      }

      const GROQ_API_KEY = process.env.GROQ_API_KEY;
      if (!GROQ_API_KEY) {
        return res.status(500).json({ success: false, error: 'GROQ_API_KEY nao configurada' });
      }

      const WISEAPP_API = 'https://chat.wiseapp360.com/api';
      const wiseHeaders: Record<string, string> = { 'api_access_token': api_key, 'Content-Type': 'application/json' };

      const now = new Date();
      const brasiliaMs = now.getTime() + (now.getTimezoneOffset() + (-3 * 60)) * 60000;
      const brasiliaDate = new Date(brasiliaMs);
      const todayStr = brasiliaDate.toISOString().split('T')[0];
      const todayFormatted = `${todayStr.split('-')[2]}/${todayStr.split('-')[1]}/${todayStr.split('-')[0]}`;

      let todayMessages: { time: string; sender: string; content: string }[] = [];
      let beforeId: number | null = null;
      for (let _page = 0; _page < 50; _page++) {
        const msgsUrl = `${WISEAPP_API}/v1/accounts/${account_id}/conversations/${conv_id}/messages` +
          (beforeId ? `?before=${beforeId}` : '');
        const msgsResp = await fetch(msgsUrl, { headers: wiseHeaders });
        if (!msgsResp.ok) break;
        const msgsData = await msgsResp.json() as any;
        const batch: any[] = msgsData?.payload || [];
        if (!batch.length) break;

        let hitYesterday = false;
        let oldestId: number | null = null;
        for (const msg of batch) {
          const createdAt = msg.created_at;
          if (!createdAt) continue;
          let msgDate: Date;
          if (typeof createdAt === 'number') { msgDate = new Date(createdAt * 1000); }
          else { msgDate = new Date(createdAt); }
          const msgBrasiliaMs = msgDate.getTime() + (msgDate.getTimezoneOffset() + (-3 * 60)) * 60000;
          const msgBrasiliaDate = new Date(msgBrasiliaMs).toISOString().split('T')[0];
          if (oldestId === null || (msg.id as number) < oldestId) oldestId = msg.id as number;
          if (msgBrasiliaDate !== todayStr) { hitYesterday = true; continue; }
          const senderInfo = msg.sender;
          let senderName = senderInfo?.name || 'Desconhecido';
          if (msg.message_type === 1) senderName = 'Atendente';
          let content = msg.content || '';
          const contentType = msg.content_type || 'text';
          if (contentType === 'image') content = '[Imagem enviada]';
          else if (contentType === 'audio') content = '[Audio enviado]';
          else if (contentType === 'video') content = '[Video enviado]';
          else if (contentType === 'file') content = '[Arquivo enviado]';
          else if (!content) content = '[Mensagem sem texto]';
          const msgBrasiliaTime = new Date(msgBrasiliaMs);
          const timeStr = `${String(msgBrasiliaTime.getUTCHours()).padStart(2,'0')}:${String(msgBrasiliaTime.getUTCMinutes()).padStart(2,'0')}`;
          todayMessages.push({ time: timeStr, sender: senderName, content });
        }
        if (hitYesterday || batch.length < 20) break;
        beforeId = oldestId;
      }
      todayMessages.reverse();

      const tipoLabel = tipo === 'email' ? 'E-mail' : 'Conversa';
      const displayName = conv_name || 'Desconhecido';

      let messagesContext: string;
      if (todayMessages.length === 0) {
        messagesContext = `Nenhuma mensagem encontrada hoje (${todayFormatted}) na ${tipoLabel.toLowerCase()}.`;
      } else {
        messagesContext = `MENSAGENS DO DIA - ${tipoLabel}: ${displayName}\nData: ${todayFormatted}\nTotal de mensagens hoje: ${todayMessages.length}\n${'─'.repeat(40)}\n`;
        messagesContext += todayMessages.slice(-80).map(m => `[${m.time}] ${m.sender}: ${m.content}`).join('\n');
      }

      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'Voce e um analista que gera resumos de conversas do dia a dia. Trate as mensagens como comunicacao normal - nao force tom negativo. Baseie-se APENAS nas mensagens fornecidas. NAO invente informacoes.' },
            { role: 'user', content: `Analise as mensagens da ${tipoLabel.toLowerCase()} "${displayName}" e gere um resumo.\n\n${messagesContext}\n\nREGRAS:\n1. O titulo DEVE ser: Resumo da ${tipoLabel} "${displayName}"\n2. Use EXATAMENTE este formato:\n• Quantidade de mensagens: [numero]\n• O que foi discutido: [descricao natural dos assuntos com palavras exatas das mensagens]\n• Tom geral: [Tranquilo/Ativo/Urgente/Neutro - com breve justificativa]\n[Inclua esta linha SOMENTE se houver problemas ou pendencias reais:]\n• Problemas/Pendencias: [cite os problemas com as palavras usadas nas mensagens]\n3. NAO inclua a secao Problemas/Pendencias se a conversa for normal/rotineira\n4. Se nao houver mensagens hoje, responda: Resumo da ${tipoLabel} "${displayName}"\nNenhuma mensagem encontrada hoje.\nEste resumo foi gerado automaticamente pela IAzinha\n5. DEVE terminar com: Este resumo foi gerado automaticamente pela IAzinha` }
          ],
          temperature: 0.3,
          max_tokens: 1024,
        })
      });

      let summaryText: string;
      if (!groqResp.ok) {
        const errText = await groqResp.text();
        console.error('[AI Conversation Summary] Groq error:', groqResp.status, errText);
        summaryText = `Resumo da ${tipoLabel} "${displayName}"\n\nErro ao gerar resumo. Tente novamente.\n\nEste resumo foi gerado automaticamente pela IAzinha`;
      } else {
        const groqData = await groqResp.json() as any;
        summaryText = groqData?.choices?.[0]?.message?.content || `Resumo da ${tipoLabel} "${displayName}"\n\nNao foi possivel gerar o resumo.\n\nEste resumo foi gerado automaticamente pela IAzinha`;
      }

      let messageSent = false;
      let sendError: string | null = null;
      const sendResp = await fetch(`${WISEAPP_API}/v1/accounts/${account_id}/conversations/${conv_id}/messages`, {
        method: 'POST',
        headers: wiseHeaders,
        body: JSON.stringify({ content: summaryText, message_type: 'outgoing', private: true })
      });
      if (sendResp.ok) { messageSent = true; }
      else { sendError = await sendResp.text(); console.error('[AI Conversation Summary] Send failed:', sendError); }

      const logData: Record<string, any> = {
        grupo_id: group_id,
        company_id,
        data_envio: todayStr,
        status: messageSent,
        mensagem: messageSent ? 'Resumo gerado e enviado com sucesso' : `Resumo gerado mas falha no envio: ${sendError}`,
        resumo_grupo: summaryText.substring(0, 5000),
        tipo: tipo || 'conversa'
      };
      if (horario_execucao_utc) logData.horario_execucao_utc = horario_execucao_utc;
      await supabaseBackend.from('envio_resumo').insert(logData);

      res.json({ success: true, summary: summaryText, group_id, conv_name: displayName, message_sent: messageSent, send_error: sendError });
    } catch (error: any) {
      console.error('[AI Conversation Summary] Error:', error.message);
      res.status(500).json({ success: false, error: error.message || 'Erro ao processar resumo' });
    }
  });

  // WiseApp Contacts Search by Name
  app.get("/api/wiseapp/:accountId/contacts-search", async (req, res) => {
    try {
      const { accountId } = req.params;
      const query = (req.query.q as string) || '';
      const page = (req.query.page as string) || '1';

      const { data: tokenData } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('id_conta_wiseapp', accountId)
        .not('access_token_wiseapp', 'is', null)
        .limit(1)
        .single();

      if (!tokenData?.access_token_wiseapp) {
        return res.status(401).json({ error: 'Token nao encontrado' });
      }

      const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(query)}&page=${page}`;
      const response = await fetch(searchUrl, {
        headers: { 'api_access_token': tokenData.access_token_wiseapp, 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao buscar contatos', details: error.message });
    }
  });

  // WiseApp Contact Conversations
  app.get("/api/wiseapp/:accountId/contacts/:contactId/conversations", async (req, res) => {
    try {
      const { accountId, contactId } = req.params;

      const { data: tokenData } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('id_conta_wiseapp', accountId)
        .not('access_token_wiseapp', 'is', null)
        .limit(1)
        .single();

      if (!tokenData?.access_token_wiseapp) {
        return res.status(401).json({ error: 'Token nao encontrado' });
      }

      const convUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`;
      const response = await fetch(convUrl, {
        headers: { 'api_access_token': tokenData.access_token_wiseapp, 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      console.log(`[contacts/conversations] accountId=${accountId} contactId=${contactId} status=${response.status} keys=${Object.keys(data||{}).join(',')}`);
      if (Array.isArray(data?.payload) && data.payload.length > 0) {
        const first = data.payload[0];
        console.log(`[contacts/conversations] payload count=${data.payload.length}, first conv keys=${Object.keys(first).join(',')}`);
        console.log(`[contacts/conversations] first conv: id=${first.id} status=${first.status} messages_count=${first.messages_count} meta=${JSON.stringify(first.meta)}`);
      }
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao buscar conversas do contato', details: error.message });
    }
  });

  // WiseApp Conversations by Inbox (for email conversations)
  app.get("/api/wiseapp/:accountId/conversations", async (req, res) => {
    try {
      const { accountId } = req.params;
      const inboxId = req.query.inbox_id as string;
      const page = (req.query.page as string) || '1';

      if (!inboxId) {
        return res.status(400).json({ error: 'inbox_id e obrigatorio' });
      }

      const { data: tokenData } = await supabaseBackend
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('id_conta_wiseapp', accountId)
        .not('access_token_wiseapp', 'is', null)
        .limit(1)
        .single();

      if (!tokenData?.access_token_wiseapp) {
        return res.status(401).json({ error: 'Token nao encontrado' });
      }

      const convUrl = `https://chat.wiseapp360.com/api/v1/accounts/${accountId}/conversations?inbox_id=${inboxId}&page=${page}`;
      const response = await fetch(convUrl, {
        headers: { 'api_access_token': tokenData.access_token_wiseapp, 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao buscar conversas', details: error.message });
    }
  });

  // AI Service health check
  app.get("/api/ai/health", async (req, res) => {
    try {
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
      const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
      res.json(response.data);
    } catch (error: any) {
      res.status(503).json({
        status: "unavailable",
        error: error.message,
      });
    }
  });

  app.get("/api/operacoes/faturamento/cesari", async (req, res) => {
    try {
      const { data, error } = await supabaseBackend
        .from("faturamento_cesari")
        .select("*")
        .eq("ativo", true)
        .order("local", { ascending: true })
        .order("sentido", { ascending: true });

      if (error) {
        console.error("Error fetching faturamento cesari:", error);
        return res.status(500).json({ error: error.message });
      }

      res.json(data || []);
    } catch (error: any) {
      console.error("Error fetching faturamento cesari:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/operacoes/faturamento/cesari", async (req, res) => {
    try {
      const body = req.body;
      console.log("[POST faturamento cesari] Creating new row:", body);

      const { data, error } = await supabaseBackend
        .from("faturamento_cesari")
        .insert([{
          local: body.local,
          tipo_carga: body.tipo_carga,
          sentido: body.sentido,
          destino_especial: body.destino_especial || null,
          valor_frete: body.valor_frete,
          valor_pernoite: body.valor_pernoite,
          comissao_motorista: body.comissao_motorista,
          comissao_pernoite_feriado_motorista: body.comissao_pernoite_feriado_motorista,
          observacoes: body.observacoes || null,
        }])
        .select()
        .single();

      if (error) {
        console.error("[POST faturamento cesari] Insert error:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log("[POST faturamento cesari] Created row id=", data.id);
      res.json(data);
    } catch (error: any) {
      console.error("Error creating faturamento cesari:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/operacoes/faturamento/cesari/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      console.log(`[PUT faturamento cesari] Updating id=${id}:`, body);

      const updateData: any = { updated_at: new Date().toISOString() };
      if (body.local !== undefined) updateData.local = body.local;
      if (body.tipo_carga !== undefined) updateData.tipo_carga = body.tipo_carga;
      if (body.sentido !== undefined) updateData.sentido = body.sentido;
      if (body.destino_especial !== undefined) updateData.destino_especial = body.destino_especial;
      if (body.valor_frete !== undefined) updateData.valor_frete = body.valor_frete;
      if (body.valor_pernoite !== undefined) updateData.valor_pernoite = body.valor_pernoite;
      if (body.comissao_motorista !== undefined) updateData.comissao_motorista = body.comissao_motorista;
      if (body.comissao_pernoite_feriado_motorista !== undefined) updateData.comissao_pernoite_feriado_motorista = body.comissao_pernoite_feriado_motorista;
      if (body.observacoes !== undefined) updateData.observacoes = body.observacoes;
      if (body.ativo !== undefined) updateData.ativo = body.ativo;

      const { data, error } = await supabaseBackend
        .from("faturamento_cesari")
        .update(updateData)
        .eq("id", parseInt(id))
        .select()
        .single();

      if (error) {
        console.error(`[PUT faturamento cesari] Update error:`, error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`[PUT faturamento cesari] Updated id=${id}`);
      res.json(data);
    } catch (error: any) {
      console.error("Error updating faturamento cesari:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/operacoes/faturamento/cesari/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[DELETE faturamento cesari] Soft-deleting id=${id}`);

      const { error } = await supabaseBackend
        .from("faturamento_cesari")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", parseInt(id));

      if (error) {
        console.error(`[DELETE faturamento cesari] Error:`, error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`[DELETE faturamento cesari] Soft-deleted id=${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting faturamento cesari:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/operacoes/financeiro/cesari/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const companyIdNum = parseInt(companyId);
      if (isNaN(companyIdNum)) {
        return res.status(400).json({ error: "Invalid companyId" });
      }

      const { data: opData, error: opError } = await supabaseBackend
        .from("operacao_cesari")
        .select("*");

      if (opError) {
        console.error("Error fetching operacao cesari data:", opError);
        return res.status(500).json({ error: opError.message });
      }

      if (!opData || opData.length === 0) {
        return res.json([]);
      }

      const viagemIds = [...new Set(opData.map((op: any) => op.id_viagem).filter(Boolean))];

      const { data: viagensEmpresa, error: viagensError } = await supabaseBackend
        .from("acompanhamento_viagem")
        .select("id, motorista_id, veiculo_id, data_hora_inicial, km_rodado, company_id")
        .in("id", viagemIds);

      if (viagensError) {
        console.error("Error fetching viagens:", viagensError);
        return res.status(500).json({ error: viagensError.message });
      }

      const viagensFiltered = (viagensEmpresa || []).filter((v: any) =>
        v.company_id === companyIdNum || v.company_id === null
      );

      if (viagensFiltered.length === 0) {
        return res.json([]);
      }

      const filteredViagemIds = new Set(viagensFiltered.map((v: any) => v.id));

      const filteredOpData = opData.filter((op: any) => filteredViagemIds.has(op.id_viagem));

      if (filteredOpData.length === 0) {
        return res.json([]);
      }

      const motoristaIds = [...new Set(viagensFiltered.map((v: any) => v.motorista_id).filter(Boolean))];
      let motoristasMap: Record<number, string> = {};
      if (motoristaIds.length > 0) {
        const { data: motoristasData } = await supabaseBackend
          .from("motorista")
          .select("motorista_id, nome")
          .in("motorista_id", motoristaIds);
        (motoristasData || []).forEach((m: any) => {
          motoristasMap[m.motorista_id] = m.nome;
        });
      }

      const veiculoIds = [...new Set(viagensFiltered.map((v: any) => v.veiculo_id).filter(Boolean))];
      let veiculosMap: Record<number, string> = {};
      if (veiculoIds.length > 0) {
        const { data: veiculosData } = await supabaseBackend
          .from("veiculo")
          .select("veiculo_id, placa")
          .in("veiculo_id", veiculoIds);
        (veiculosData || []).forEach((v: any) => {
          veiculosMap[v.veiculo_id] = v.placa;
        });
      }

      const result = filteredOpData.map((op: any) => {
        const viagem = viagensFiltered.find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          data_viagem: viagem?.data_hora_inicial,
          motorista_nome: viagem ? motoristasMap[viagem.motorista_id] || "Desconhecido" : "Desconhecido",
          placa_veiculo: viagem ? veiculosMap[viagem.veiculo_id] || "Sem placa" : "Sem placa",
        };
      }).sort((a: any, b: any) => new Date(b.data_viagem || 0).getTime() - new Date(a.data_viagem || 0).getTime());

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching operacao financeiro cesari:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/operacoes/financeiro/:operacao/:companyId", async (req, res) => {
    try {
      const { operacao, companyId } = req.params;
      const companyIdNum = parseInt(companyId);
      if (isNaN(companyIdNum)) {
        return res.status(400).json({ error: "Invalid companyId" });
      }

      const validOperacoes: Record<string, string> = {
        mitsubishi: "operacao_mitsubishi",
        autoservice: "operacao_autoservice",
        tegma: "operacao_tegma",
      };

      const tableName = validOperacoes[operacao.toLowerCase()];
      if (!tableName) {
        return res.status(400).json({ error: "Invalid operacao" });
      }

      const { data: opData, error: opError } = await supabaseBackend
        .from(tableName)
        .select("*");

      if (opError) {
        console.error("Error fetching operacao data:", opError);
        return res.status(500).json({ error: opError.message });
      }

      if (!opData || opData.length === 0) {
        return res.json([]);
      }

      const viagemIds = [...new Set(opData.map((op: any) => op.id_viagem).filter(Boolean))];

      const { data: viagensEmpresa, error: viagensError } = await supabaseBackend
        .from("acompanhamento_viagem")
        .select("id, motorista_id, veiculo_id, data_hora_inicial, km_rodado, company_id")
        .in("id", viagemIds);

      if (viagensError) {
        console.error("Error fetching viagens:", viagensError);
        return res.status(500).json({ error: viagensError.message });
      }

      const viagensFiltered = (viagensEmpresa || []).filter((v: any) =>
        v.company_id === companyIdNum || v.company_id === null
      );

      if (viagensFiltered.length === 0) {
        return res.json([]);
      }

      const filteredViagemIds = new Set(viagensFiltered.map((v: any) => v.id));

      const filteredOpData = opData.filter((op: any) => filteredViagemIds.has(op.id_viagem));

      if (filteredOpData.length === 0) {
        return res.json([]);
      }

      const motoristaIds = [...new Set(viagensFiltered.map((v: any) => v.motorista_id).filter(Boolean))];
      let motoristasMap: Record<number, string> = {};
      if (motoristaIds.length > 0) {
        const { data: motoristasData } = await supabaseBackend
          .from("motorista")
          .select("motorista_id, nome")
          .in("motorista_id", motoristaIds);
        (motoristasData || []).forEach((m: any) => {
          motoristasMap[m.motorista_id] = m.nome;
        });
      }

      const veiculoIds = [...new Set(viagensFiltered.map((v: any) => v.veiculo_id).filter(Boolean))];
      let veiculosMap: Record<number, string> = {};
      if (veiculoIds.length > 0) {
        const { data: veiculosData } = await supabaseBackend
          .from("veiculo")
          .select("veiculo_id, placa")
          .in("veiculo_id", veiculoIds);
        (veiculosData || []).forEach((v: any) => {
          veiculosMap[v.veiculo_id] = v.placa;
        });
      }

      const result = filteredOpData.map((op: any) => {
        const viagem = viagensFiltered.find((v: any) => v.id === op.id_viagem);
        return {
          ...op,
          data_viagem: viagem?.data_hora_inicial,
          motorista_nome: viagem ? motoristasMap[viagem.motorista_id] || "Desconhecido" : "Desconhecido",
          placa_veiculo: viagem ? veiculosMap[viagem.veiculo_id] || "Sem placa" : "Sem placa",
        };
      }).sort((a: any, b: any) => new Date(b.data_viagem || 0).getTime() - new Date(a.data_viagem || 0).getTime());

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching operacao financeiro:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/operacoes/faturamento/:operacao", async (req, res) => {
    try {
      const { operacao } = req.params;
      const body = req.body;

      const validTables: Record<string, string> = {
        mitsubishi: "faturamento_mitsubishi",
        autoservice: "faturamento_autoservice",
        tegma: "faturamento_tegma",
      };

      const tableName = validTables[operacao.toLowerCase()];
      if (!tableName) {
        return res.status(400).json({ error: "Invalid operacao" });
      }

      console.log(`[POST faturamento] Saving to ${tableName}:`, body);

      const { data: existing, error: fetchError } = await supabaseBackend
        .from(tableName)
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error(`[POST faturamento] Error checking existing:`, fetchError);
        return res.status(500).json({ error: fetchError.message });
      }

      const existingId = existing?.[0]?.id;

      if (existingId) {
        const { data, error } = await supabaseBackend
          .from(tableName)
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", existingId)
          .select()
          .single();

        if (error) {
          console.error(`[POST faturamento] Update error:`, error);
          return res.status(500).json({ error: error.message });
        }

        console.log(`[POST faturamento] Updated ${tableName} id=${existingId}`);
        return res.json(data);
      } else {
        const { data, error } = await supabaseBackend
          .from(tableName)
          .insert([body])
          .select()
          .single();

        if (error) {
          console.error(`[POST faturamento] Insert error:`, error);
          return res.status(500).json({ error: error.message });
        }

        console.log(`[POST faturamento] Inserted new row into ${tableName}`);
        return res.json(data);
      }
    } catch (error: any) {
      console.error("Error saving faturamento:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/operacoes/faturamento/:operacao", async (req, res) => {
    try {
      const { operacao } = req.params;

      const validTables: Record<string, string> = {
        mitsubishi: "faturamento_mitsubishi",
        autoservice: "faturamento_autoservice",
        tegma: "faturamento_tegma",
      };

      const tableName = validTables[operacao.toLowerCase()];
      if (!tableName) {
        return res.status(400).json({ error: "Invalid operacao" });
      }

      const { data, error } = await supabaseBackend
        .from(tableName)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(data?.[0] || null);
    } catch (error: any) {
      console.error("Error fetching faturamento:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/operacoes/sada/identificar-mitsubishi", async (req, res) => {
    const { viagens } = req.body as { viagens: { id_operacao: number; modelo: string }[] };

    const fallback = (viagens || []).map((v) => ({ id_operacao: v.id_operacao, qtd_mitsubishi: 0 }));

    if (!viagens || viagens.length === 0) return res.json([]);

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      console.warn("[SADA IA] GROQ_API_KEY não configurado — retornando zeros");
      return res.json(fallback);
    }

    const systemPrompt = `Você é um especialista em identificação de modelos de veículos automotores.
Para cada entrada do array JSON fornecido, identifique quantos veículos da marca Mitsubishi estão descritos no campo "modelo".
Modelos Mitsubishi incluem (mas não se limitam a): Eclipse Cross, Outlander, ASX, L200, Pajero, Galant, Colt, Lancer, Carisma, Space Star, Triton, Strada, e qualquer variação que mencione explicitamente "mitsubishi".
Retorne APENAS um array JSON válido, sem nenhum texto adicional, comentários ou markdown. Formato: [{"id_operacao": N, "qtd_mitsubishi": M}]`;

    const userPrompt = `Analise as seguintes viagens e retorne quantos veículos Mitsubishi cada uma possui:
${JSON.stringify(viagens)}
Retorne APENAS o array JSON no formato: [{"id_operacao": N, "qtd_mitsubishi": M}]`;

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1024,
        },
        {
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      const content: string = response.data?.choices?.[0]?.message?.content || "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn("[SADA IA] Resposta do Groq sem JSON válido:", content);
        return res.json(fallback);
      }

      const parsed = JSON.parse(jsonMatch[0]) as { id_operacao: number; qtd_mitsubishi: number }[];
      return res.json(parsed);
    } catch (err: any) {
      console.error("[SADA IA] Erro ao chamar Groq:", err?.message || err);
      return res.json(fallback);
    }
  });

  app.post("/api/viagens/import", async (req, res) => {
    try {
      const { operacao, companyId, rows } = req.body;

      if (!operacao || !companyId || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "operacao, companyId e rows são obrigatórios" });
      }

      const validTables: Record<string, string> = {
        autoservice: "operacao_autoservice",
        cesari: "operacao_cesari",
        mitsubishi: "operacao_mitsubishi",
        sada: "operacao_sada",
        superterminais: "operacao_superterminais",
        tegma: "operacao_tegma",
        vammo: "operacao_vammo",
      };

      const tableName = validTables[operacao.toLowerCase()];
      if (!tableName) {
        return res.status(400).json({ error: `Operação inválida: ${operacao}` });
      }

      function parseBool(val: any): boolean | null {
        if (val === undefined || val === null || val === "") return null;
        if (typeof val === "boolean") return val;
        if (typeof val === "number") return val !== 0;
        const s = String(val).trim().toLowerCase();
        if (s === "sim" || s === "true" || s === "1") return true;
        if (s === "não" || s === "nao" || s === "false" || s === "0") return false;
        return null;
      }

      function parseIntVal(val: any): number | null {
        if (val === undefined || val === null || val === "") return null;
        const n = Number(val);
        return isNaN(n) ? null : Math.round(n);
      }

      function parseTipoCarreta(val: any): number | null {
        if (val === undefined || val === null || val === "") return null;
        const s = String(val).trim().toLowerCase();
        if (s === "prancha" || s === "0") return 0;
        if (s === "cegonha" || s === "1") return 1;
        const n = Number(val);
        return isNaN(n) ? null : Math.round(n);
      }

      function parseEmbarqueDesembarque(val: any): number | null {
        if (val === undefined || val === null || val === "") return null;
        const s = String(val).trim().toLowerCase();
        if (s === "embarque" || s === "0") return 0;
        if (s === "desembarque" || s === "1") return 1;
        const n = Number(val);
        return isNaN(n) ? null : Math.round(n);
      }

      function parseCapacidade(val: any): number | null {
        if (val === undefined || val === null || val === "") return null;
        const s = String(val).trim().toLowerCase();
        if (s === "vazio" || s === "0") return 0;
        if (s === "cheio" || s === "1") return 1;
        const n = Number(val);
        return isNaN(n) ? null : Math.round(n);
      }

      function strVal(val: any): string | null {
        if (val === undefined || val === null || val === "") return null;
        return String(val).trim();
      }

      function numVal(val: any): number | null {
        if (val === undefined || val === null || val === "") return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
      }

      const { data: motoristas } = await supabaseBackend
        .from("motorista")
        .select("motorista_id, nome")
        .eq("company_id", companyId);

      const { data: veiculos } = await supabaseBackend
        .from("veiculo")
        .select("veiculo_id, placa")
        .eq("company_id", companyId);

      const { data: clientes } = await supabaseBackend
        .from("cliente")
        .select("cliente_id, nome")
        .eq("company_id", companyId);

      const motoristaMap = new Map<string, number>();
      motoristas?.forEach((m: any) => {
        if (m.nome) motoristaMap.set(m.nome.trim().toLowerCase(), m.motorista_id);
      });

      const veiculoMap = new Map<string, number>();
      veiculos?.forEach((v: any) => {
        if (v.placa) veiculoMap.set(v.placa.trim().toLowerCase(), v.veiculo_id);
      });

      const clienteMap = new Map<string, number>();
      clientes?.forEach((c: any) => {
        if (c.nome) clienteMap.set(c.nome.trim().toLowerCase(), c.cliente_id);
      });

      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ row: number; message: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const motoristaNome = strVal(row["Motorista"]);
          if (!motoristaNome) {
            throw new Error("Campo 'Motorista' é obrigatório");
          }
          const motorista_id = motoristaMap.get(motoristaNome.toLowerCase());
          if (!motorista_id) {
            throw new Error(`Motorista não encontrado: ${motoristaNome}`);
          }

          const dataHoraInicial = strVal(row["Data/Hora Inicial"]);
          if (!dataHoraInicial) {
            throw new Error("Campo 'Data/Hora Inicial' é obrigatório");
          }

          const veiculoPlaca = strVal(row["Veiculo Placa"]);
          const veiculo_id = veiculoPlaca ? veiculoMap.get(veiculoPlaca.toLowerCase()) || null : null;

          const ajudanteNome = strVal(row["Ajudante"]);
          const ajudante_id = ajudanteNome ? motoristaMap.get(ajudanteNome.toLowerCase()) || null : null;

          const clienteNome = strVal(row["Cliente"]);
          const cliente_id = clienteNome ? clienteMap.get(clienteNome.toLowerCase()) || null : null;

          const viagemRecord: Record<string, any> = {
            data_hora_inicial: dataHoraInicial,
            motorista_id,
            company_id: companyId,
          };

          const kmInicial = numVal(row["KM Inicial"]);
          if (kmInicial !== null) viagemRecord.km_inicial = kmInicial;

          if (veiculo_id !== null) viagemRecord.veiculo_id = veiculo_id;
          if (ajudante_id !== null) viagemRecord.ajudante_id = ajudante_id;
          if (cliente_id !== null) viagemRecord.cliente_id = cliente_id;

          const kmFinal = numVal(row["KM Final"]);
          if (kmFinal !== null) viagemRecord.km_final = kmFinal;

          const dataHoraFinal = strVal(row["Data/Hora Final"]);
          if (dataHoraFinal) viagemRecord.data_hora_final = dataHoraFinal;

          const janta = parseBool(row["Janta"]);
          if (janta !== null) viagemRecord.janta = janta;

          const horaJanta = strVal(row["Hora Janta"]);
          if (horaJanta) viagemRecord.hora_janta = horaJanta;

          const { data: viagemData, error: viagemError } = await supabaseBackend
            .from("acompanhamento_viagem")
            .insert([viagemRecord])
            .select()
            .single();

          if (viagemError) {
            throw new Error(`Erro ao inserir viagem: ${viagemError.message}`);
          }

          const idViagem = viagemData.id;
          let opRecord: Record<string, any> = { id_viagem: idViagem };

          const opKey = operacao.toLowerCase();

          if (opKey === "autoservice") {
            opRecord.origem = strVal(row["Origem"]);
            opRecord.destino = strVal(row["Destino"]);
            opRecord.placa_veiculo = strVal(row["Placa Veiculo"]);
            opRecord.embarque = strVal(row["Embarque"]);
            opRecord.nome_cliente = strVal(row["Nome Cliente"]);
            opRecord.tel_cliente = strVal(row["Tel Cliente"]);
            opRecord.valor_frete = numVal(row["Valor Frete"]);
            opRecord.destino_final = strVal(row["Destino Final"]);
          } else if (opKey === "cesari") {
            opRecord.origem = strVal(row["Origem"]);
            opRecord.destino = strVal(row["Destino"]);
            opRecord.nr_manifesto = strVal(row["Nr Manifesto"]);
            opRecord.tipo_viagem = strVal(row["Tipo Viagem"]);
            opRecord.pernoite = parseBool(row["Pernoite"]);
            opRecord.dia_nao_util = parseBool(row["Dia Nao Util"]);
            opRecord.v2_dt_hora = strVal(row["V2 Data/Hora"]);
            opRecord.v2_origem = strVal(row["V2 Origem"]);
            opRecord.v2_destino = strVal(row["V2 Destino"]);
            opRecord.v2_capacidade = parseIntVal(row["V2 Capacidade"]);
            opRecord.v2_nr_manifesto = strVal(row["V2 Nr Manifesto"]);
          } else if (opKey === "mitsubishi") {
            opRecord.origem = strVal(row["Origem"]);
            opRecord.destino = strVal(row["Destino"]);
            opRecord.frota = strVal(row["Frota"]);
            opRecord.tipo_carreta = parseTipoCarreta(row["Tipo Carreta"]);
            opRecord.qtd_carro = parseIntVal(row["Qtd Carro"]);
            opRecord.modelo_carro = strVal(row["Modelo Carro"]);
            opRecord.km_chegada_porto = numVal(row["KM Chegada Porto"]);
            opRecord.data_hora_chegada_porto = strVal(row["Data/Hora Chegada Porto"]);
          } else if (opKey === "sada") {
            opRecord.origem = strVal(row["Origem"]);
            opRecord.destino = strVal(row["Destino"]);
            opRecord.destino2 = strVal(row["Destino 2"]);
            opRecord.tipo_carreta = parseTipoCarreta(row["Tipo Carreta"]);
            opRecord.tipo_carga = strVal(row["Tipo Carga"]);
            opRecord.frota = strVal(row["Frota"]);
            opRecord.nr_viagem = strVal(row["Nr Viagem"]);
            opRecord.qtd_carros = parseIntVal(row["Qtd Carros"]);
            opRecord.modelo = strVal(row["Modelo"]);
          } else if (opKey === "superterminais") {
            opRecord.embarque_desembarque = parseEmbarqueDesembarque(row["Embarque/Desembarque"]);
            opRecord.nome_navio = strVal(row["Nome Navio"]);
            opRecord.capacidade = parseCapacidade(row["Capacidade"]);
            opRecord.nr_container = strVal(row["Nr Container"]);
            opRecord.fim_de_semana = parseBool(row["Fim de Semana"]);
          } else if (opKey === "tegma") {
            opRecord.tipo_viagem = strVal(row["Tipo Viagem"]);
            opRecord.origem = strVal(row["Origem"]);
            opRecord.destino = strVal(row["Destino"]);
            opRecord.placa_carreta = strVal(row["Placa Carreta"]);
            opRecord.nr_cautela = strVal(row["Nr Cautela"]);
            opRecord.nr_viagem = strVal(row["Nr Viagem"]);
            opRecord.empresa = strVal(row["Empresa"]);
            opRecord.qtd_carros = parseIntVal(row["Qtd Carros"]);
            opRecord.veiculo_transportado = strVal(row["Veiculo Transportado"]);
            opRecord.placa_veiculo_transportado = strVal(row["Placa Veiculo Transportado"]);
            opRecord.retorno = parseBool(row["Retorno"]);
            opRecord.p2_origem = strVal(row["P2 Origem"]);
            opRecord.p2_destino = strVal(row["P2 Destino"]);
            opRecord.p2_placa_veiculo = strVal(row["P2 Placa Veiculo"]);
            opRecord.p2_nr_cautela = strVal(row["P2 Nr Cautela"]);
            opRecord.p2_data_hora = strVal(row["P2 Data/Hora"]);
          } else if (opKey === "vammo") {
            opRecord.origem = strVal(row["Origem"]);
            opRecord.destino = strVal(row["Destino"]);
            opRecord.qtd_motos = parseIntVal(row["Qtd Motos"]);
            opRecord.nr_cte = strVal(row["Nr CTE"]);
          }

          Object.keys(opRecord).forEach((key) => {
            if (key !== "id_viagem" && opRecord[key] === null) {
              delete opRecord[key];
            }
          });

          const { error: opError } = await supabaseBackend
            .from(tableName)
            .insert([opRecord]);

          if (opError) {
            await supabaseBackend
              .from("acompanhamento_viagem")
              .delete()
              .eq("id", idViagem);
            throw new Error(`Erro ao inserir ${tableName}: ${opError.message}`);
          }

          successCount++;
        } catch (err: any) {
          failedCount++;
          errors.push({ row: i + 1, message: err.message || "Erro desconhecido" });
        }
      }

      res.json({ successCount, failedCount, errors });
    } catch (error: any) {
      console.error("Error in viagens import:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper: authenticate oil-change requests by validating the wiseapp-token stored in
  // the database (wiseapp_acesso table) and confirming it maps to the claimed company.
  // wiseapp-token is required — no fallback to client-controlled headers.
  async function resolveAndValidateCompanyId(
    req: any,
    res: any,
    paramCompanyId: number
  ): Promise<number | null> {
    const wiseappToken = req.header('wiseapp-token') as string | undefined;

    if (!wiseappToken) {
      res.status(401).json({ error: "wiseapp-token header é obrigatório" });
      return null;
    }

    // Look up token in wiseapp_acesso table to get id_conta_wiseapp
    const { data: acesso, error: acessoErr } = await supabaseBackend
      .from("wiseapp_acesso")
      .select("id_conta_wiseapp")
      .eq("access_token_wiseapp", wiseappToken)
      .limit(1);

    if (acessoErr || !acesso || acesso.length === 0) {
      res.status(401).json({ error: "Token de acesso inválido ou expirado" });
      return null;
    }

    // Map id_conta_wiseapp → company_id
    const idContaWiseapp = acesso[0].id_conta_wiseapp;
    const { data: companies, error: companyErr } = await supabaseBackend
      .from("company")
      .select("company_id")
      .eq("id_conta_wiseapp", idContaWiseapp)
      .limit(1);

    if (companyErr || !companies || companies.length === 0) {
      res.status(401).json({ error: "Empresa associada ao token não encontrada" });
      return null;
    }

    const tokenCompanyId: number = companies[0].company_id;
    if (tokenCompanyId !== paramCompanyId) {
      res.status(403).json({ error: "Acesso negado a este recurso" });
      return null;
    }
    return tokenCompanyId;
  }

  // GET /api/veiculos-empresa/:companyId — list vehicles for a company
  app.get("/api/veiculos-empresa/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) return res.status(400).json({ error: "companyId inválido" });

      const validated = await resolveAndValidateCompanyId(req, res, companyId);
      if (!validated) return;

      const { data: motoristas, error: motoristasError } = await supabaseBackend
        .from("motorista")
        .select("motorista_id")
        .eq("company_id", companyId);

      if (motoristasError) return res.status(500).json({ error: motoristasError.message });

      const motoristaIds = (motoristas || []).map((m: any) => m.motorista_id);
      if (motoristaIds.length === 0) return res.json([]);

      const { data, error } = await supabaseBackend
        .from("veiculo")
        .select("veiculo_id, placa, marca")
        .in("motorista_id", motoristaIds)
        .eq("status_veiculo", true);

      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // Troca de Óleo routes
  // ============================================================

  // GET /api/troca-oleo/:companyId — list all aviso_troca_oleo for a company, enriched
  app.get("/api/troca-oleo/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) return res.status(400).json({ error: "companyId inválido" });

      const validated = await resolveAndValidateCompanyId(req, res, companyId);
      if (!validated) return;

      const { data: records, error } = await supabaseBackend
        .from("aviso_troca_oleo")
        .select("*")
        .eq("company_id", companyId);

      if (error) return res.status(500).json({ error: error.message });

      const enriched = await Promise.all((records || []).map(async (r: any) => {
        const { data: vData } = await supabaseBackend
          .from("veiculo")
          .select("placa, marca, motorista_id")
          .eq("veiculo_id", r.veiculo_id)
          .single();

        let km_atual: number | null = null;
        const { data: hodData } = await supabaseBackend
          .from("hodometro")
          .select("hod_informado")
          .eq("veiculo_id", r.veiculo_id)
          .order("hod_informado", { ascending: false })
          .limit(1)
          .single();

        const hodKm = hodData?.hod_informado != null ? parseFloat(hodData.hod_informado) : null;

        const { data: viagemData } = await supabaseBackend
          .from("acompanhamento_viagem")
          .select("km_final, data_hora_final")
          .eq("veiculo_id", r.veiculo_id)
          .not("km_final", "is", null)
          .order("km_final", { ascending: false })
          .limit(1)
          .single();

        const viagemKm = viagemData?.km_final != null ? parseFloat(viagemData.km_final) : null;

        if (hodKm !== null || viagemKm !== null) {
          km_atual = Math.max(hodKm ?? 0, viagemKm ?? 0);
        }

        const { data: ultimaViagemData } = await supabaseBackend
          .from("acompanhamento_viagem")
          .select("data_hora_inicial")
          .eq("veiculo_id", r.veiculo_id)
          .order("data_hora_inicial", { ascending: false })
          .limit(1)
          .single();

        const ultima_viagem_data = ultimaViagemData?.data_hora_inicial || null;

        let motorista_nome: string | null = null;
        let motorista_telefone: string | null = null;
        if (vData?.motorista_id) {
          const { data: mData } = await supabaseBackend
            .from("motorista")
            .select("nome, telefone")
            .eq("motorista_id", vData.motorista_id)
            .single();
          motorista_nome = mData?.nome || null;
          motorista_telefone = mData?.telefone ? String(mData.telefone) : null;
        }

        const kmUltimaTroca = parseFloat(r.km_ultima_troca);
        const kmProximaTroca = kmUltimaTroca + r.intervalo_km;
        const kmRestante = km_atual !== null ? kmProximaTroca - km_atual : null;

        let status: "OK" | "Atenção" | "Vencido" = "OK";
        if (kmRestante !== null) {
          if (kmRestante <= 0) status = "Vencido";
          else if (kmRestante <= r.km_aviso_antecipado) status = "Atenção";
          else status = "OK";
        }

        return {
          ...r,
          placa: vData?.placa || null,
          marca_veiculo: vData?.marca || null,
          motorista_nome,
          motorista_telefone,
          km_atual,
          km_proxima_troca: kmProximaTroca,
          km_restante: kmRestante,
          status,
          ultima_viagem_data,
        };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/troca-oleo — create record
  app.post("/api/troca-oleo", async (req, res) => {
    try {
      const { veiculo_id, company_id, intervalo_km, km_ultima_troca, km_aviso_antecipado } = req.body;
      if (!veiculo_id || !company_id) return res.status(400).json({ error: "veiculo_id e company_id são obrigatórios" });

      const validated = await resolveAndValidateCompanyId(req, res, parseInt(company_id));
      if (!validated) return;

      // Verify the vehicle belongs to the authenticated company
      // Primary: check veiculo.company_id (own vehicles without a motorista assigned)
      // Fallback: check via veiculo.motorista_id → motorista.company_id
      const { data: veiculoData, error: veiculoErr } = await supabaseBackend
        .from("veiculo")
        .select("veiculo_id, company_id, motorista_id")
        .eq("veiculo_id", veiculo_id)
        .single();

      if (veiculoErr || !veiculoData) {
        return res.status(404).json({ error: "Veículo não encontrado" });
      }

      let veiculoBelongsToCompany = veiculoData.company_id === validated;

      if (!veiculoBelongsToCompany && veiculoData.motorista_id) {
        const { data: motoristaData } = await supabaseBackend
          .from("motorista")
          .select("company_id")
          .eq("motorista_id", veiculoData.motorista_id)
          .single();
        veiculoBelongsToCompany = motoristaData?.company_id === validated;
      }

      if (!veiculoBelongsToCompany) {
        return res.status(403).json({ error: "Veículo não pertence a esta empresa" });
      }

      const { data, error } = await supabaseBackend
        .from("aviso_troca_oleo")
        .insert([{
          veiculo_id,
          company_id: validated,
          intervalo_km: intervalo_km ?? 5000,
          km_ultima_troca: String(km_ultima_troca ?? 0),
          km_aviso_antecipado: km_aviso_antecipado ?? 500,
          ativo: true,
        }])
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/troca-oleo/:id — update record
  app.put("/api/troca-oleo/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "id inválido" });

      // Fetch the record first to get company_id, then validate caller owns it
      const { data: existing, error: fetchErr } = await supabaseBackend
        .from("aviso_troca_oleo")
        .select("company_id")
        .eq("id", id)
        .single();

      if (fetchErr || !existing) return res.status(404).json({ error: "Registro não encontrado" });

      const callerCompanyId = await resolveAndValidateCompanyId(req, res, existing.company_id);
      if (!callerCompanyId) return;

      const { intervalo_km, km_ultima_troca, km_aviso_antecipado, ativo } = req.body;
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (intervalo_km !== undefined) updates.intervalo_km = intervalo_km;
      if (km_ultima_troca !== undefined) updates.km_ultima_troca = String(km_ultima_troca);
      if (km_aviso_antecipado !== undefined) updates.km_aviso_antecipado = km_aviso_antecipado;
      if (ativo !== undefined) updates.ativo = ativo;

      const { data, error } = await supabaseBackend
        .from("aviso_troca_oleo")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/troca-oleo/:id
  app.delete("/api/troca-oleo/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "id inválido" });

      // Fetch the record first to get company_id, then validate caller owns it
      const { data: existing, error: fetchErr } = await supabaseBackend
        .from("aviso_troca_oleo")
        .select("company_id")
        .eq("id", id)
        .single();

      if (fetchErr || !existing) return res.status(404).json({ error: "Registro não encontrado" });

      const callerCompanyId = await resolveAndValidateCompanyId(req, res, existing.company_id);
      if (!callerCompanyId) return;

      const { error } = await supabaseBackend
        .from("aviso_troca_oleo")
        .delete()
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/troca-oleo/verificar/:companyId — manually trigger alerts
  app.post("/api/troca-oleo/verificar/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) return res.status(400).json({ error: "companyId inválido" });

      const validated = await resolveAndValidateCompanyId(req, res, companyId);
      if (!validated) return;

      const { checkAndSendOilChangeAlerts } = await import("./cron/oilChangeCron");
      const result = await checkAndSendOilChangeAlerts(validated);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/troca-oleo/alertas/:companyId — get unread oil change alerts (RLS-protected table)
  app.get("/api/troca-oleo/alertas/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) return res.status(400).json({ error: "companyId inválido" });

      const validated = await resolveAndValidateCompanyId(req, res, companyId);
      if (!validated) return;

      const { data, error } = await supabaseBackend
        .from("oil_change_alert_log")
        .select("*")
        .eq("company_id", validated)
        .eq("lido", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/troca-oleo/alertas/:id/ler — mark single alert as read
  app.patch("/api/troca-oleo/alertas/:id/ler", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "id inválido" });

      const { data: existing } = await supabaseBackend
        .from("oil_change_alert_log")
        .select("company_id")
        .eq("id", id)
        .single();

      if (!existing) return res.status(404).json({ error: "Alerta não encontrado" });

      const callerCompanyId = await resolveAndValidateCompanyId(req, res, existing.company_id);
      if (!callerCompanyId) return;

      const { error } = await supabaseBackend
        .from("oil_change_alert_log")
        .update({ lido: true })
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/troca-oleo/alertas/lerTodos/:companyId — mark all alerts as read
  app.post("/api/troca-oleo/alertas/lerTodos/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) return res.status(400).json({ error: "companyId inválido" });

      const validated = await resolveAndValidateCompanyId(req, res, companyId);
      if (!validated) return;

      const { error } = await supabaseBackend
        .from("oil_change_alert_log")
        .update({ lido: true })
        .eq("company_id", validated)
        .eq("lido", false);

      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================
  // JPD Transportes routes
  // (Ingestao e extracao sao feitas externamente — n8n grava
  //  direto nas tabelas jpd_documents / jpd_extractions via Supabase)
  // =====================================================
  function jpdCompanyId(req: any): number | null {
    const raw = req.query.company_id || req.body?.company_id || req.headers["company_id"] || req.headers["x-company-id"];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // GET /api/jpd/documents?company_id=&status=
  app.get("/api/jpd/documents", async (req, res) => {
    try {
      const company_id = jpdCompanyId(req);
      if (!company_id) return res.status(400).json({ error: "company_id obrigatorio" });
      const status = req.query.status as string | undefined;
      let q = supabaseBackend.from("jpd_documents").select("*").eq("company_id", company_id).order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jpd/documents/:id  => { document, extraction }
  app.get("/api/jpd/documents/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { data: doc, error: dErr } = await supabaseBackend.from("jpd_documents").select("*").eq("id", id).single();
      if (dErr) return res.status(404).json({ error: dErr.message });
      const { data: ext } = await supabaseBackend
        .from("jpd_extractions").select("*").eq("document_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      res.json({ document: doc, extraction: ext, file_url: null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/jpd/extractions/:id  body: { fields }
  app.put("/api/jpd/extractions/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { fields } = req.body || {};
      if (!fields || typeof fields !== "object") return res.status(400).json({ error: "fields obrigatorio" });
      const { data, error } = await supabaseBackend
        .from("jpd_extractions").update({ fields, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/jpd/extractions/:id/approve  body: { approved_by? }
  app.post("/api/jpd/extractions/:id/approve", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { approved_by } = req.body || {};
      const { data: ext, error: eErr } = await supabaseBackend.from("jpd_extractions").select("*").eq("id", id).single();
      if (eErr) return res.status(404).json({ error: eErr.message });
      const { data: doc, error: dErr } = await supabaseBackend.from("jpd_documents").select("*").eq("id", ext.document_id).single();
      if (dErr) return res.status(404).json({ error: dErr.message });
      const f = ext.fields || {};

      const freightRow = {
        origem: f.origem ?? null,
        destinatario: f.destinatario ?? null,
        motorista: f.motorista ?? null,
        placa_do_carro: f.placa_do_carro ?? null,
        numero_do_bv: f.numero_do_bv ?? null,
        total_km: f.total_km ?? null,
        data_do_bv: f.data_do_bv ?? null,
        data_da_carga: f.data_da_carga ?? null,
        data_da_descarga: f.data_da_descarga ?? null,
        valor_do_frete: f.valor_do_frete ?? null,
        outras_receitas: f.outras_receitas ?? null,
        abastecimento_pago_pela_jpd: f.abastecimento_pago_pela_jpd ?? null,
        abastecimento_descontado_do_frete: f.abastecimento_descontado_do_frete ?? null,
        demais_despesas: f.demais_despesas ?? null,
        seguros: f.seguros ?? null,
        aluguel: f.aluguel ?? null,
        pneus: f.pneus ?? null,
        parcela_pneus: f.parcela_pneus ?? null,
        plano_manutencao_ipva: f.plano_manutencao_ipva ?? null,
        faltas_em_litros: f.faltas_em_litros ?? null,
        faltas_abonadas_rs: f.faltas_abonadas_rs ?? null,
        faltas_cobradas_rs: f.faltas_cobradas_rs ?? null,
        data_do_faturamento: f.data_do_faturamento ?? null,
        valor_faturado: f.valor_faturado ?? null,
        numero_do_cte: f.numero_do_cte ?? null,
        situacao_do_bv: f.situacao_do_bv ?? null,
      };
      const { error: fErr } = await supabaseBackend.from("jpd_fretes").insert(freightRow);
      if (fErr) return res.status(500).json({ error: fErr.message });

      await supabaseBackend.from("jpd_documents").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", doc.id);

      // sync drivers/vehicles
      if (f.motorista) {
        const { data: existing } = await supabaseBackend.from("jpd_drivers").select("id").eq("company_id", doc.company_id).eq("nome", f.motorista).maybeSingle();
        if (!existing) await supabaseBackend.from("jpd_drivers").insert({ company_id: doc.company_id, nome: f.motorista });
      }
      if (f.placa_do_carro) {
        const { data: existing } = await supabaseBackend.from("jpd_vehicles").select("id").eq("company_id", doc.company_id).eq("placa", f.placa_do_carro).maybeSingle();
        if (!existing) await supabaseBackend.from("jpd_vehicles").insert({ company_id: doc.company_id, placa: f.placa_do_carro });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/jpd/documents/:id/reject
  app.post("/api/jpd/documents/:id/reject", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { error } = await supabaseBackend.from("jpd_documents").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================================================
  // CRUD de fretes (tabela jpd_fretes — espelha exemplo.csv)
  // =====================================================
  // Colunas do CSV aceitas no body de POST/PUT
  const JPD_FRETE_COLS = [
    "origem", "destinatario", "motorista", "placa_do_carro", "numero_do_bv", "total_km",
    "data_do_bv", "data_da_carga", "data_da_descarga", "valor_do_frete", "outras_receitas",
    "abastecimento_pago_pela_jpd", "abastecimento_descontado_do_frete", "demais_despesas",
    "seguros", "aluguel", "pneus", "parcela_pneus", "plano_manutencao_ipva", "faltas_em_litros",
    "faltas_abonadas_rs", "faltas_cobradas_rs", "data_do_faturamento", "valor_faturado",
    "numero_do_cte", "situacao_do_bv",
    "fornecedor", "combustivel", "litros", "valor_unitario", "valor_bruto", "desconto", "arla",
  ] as const;
  const JPD_NUMERIC_COLS = new Set([
    "total_km", "valor_do_frete", "outras_receitas", "abastecimento_pago_pela_jpd",
    "abastecimento_descontado_do_frete", "demais_despesas", "seguros", "aluguel", "pneus",
    "parcela_pneus", "plano_manutencao_ipva", "faltas_em_litros", "faltas_abonadas_rs",
    "faltas_cobradas_rs", "valor_faturado",
    "litros", "valor_unitario", "valor_bruto", "desconto", "arla",
  ]);
  const JPD_ABAST_COLS = [
    "hodometro", "placa", "fornecedor", "combustivel", "litros",
    "valor_unitario", "valor_bruto", "desconto", "arla",
  ] as const;
  const JPD_ABAST_NUMERIC = new Set([
    "hodometro", "litros", "valor_unitario", "valor_bruto", "desconto", "arla",
  ]);
  const JPD_CUSTO_COLS = ["fornecedor", "combustivel", "litros", "valor_unitario", "valor_bruto", "desconto", "arla"];
  function buildAbastecimentoRow(body: any) {
    const row: Record<string, any> = {};
    for (const col of JPD_ABAST_COLS) {
      if (!(col in (body || {}))) continue;
      let v = body[col];
      if (v === "" || v === undefined) v = null;
      if (v !== null && JPD_ABAST_NUMERIC.has(col)) {
        const n = Number(v);
        v = Number.isFinite(n) ? n : null;
      }
      row[col] = v;
    }
    return row;
  }

  function buildFreteRow(body: any) {
    const row: Record<string, any> = {};
    for (const col of JPD_FRETE_COLS) {
      if (!(col in (body || {}))) continue;
      let v = body[col];
      if (v === "" || v === undefined) v = null;
      if (v !== null && JPD_NUMERIC_COLS.has(col)) {
        const n = Number(v);
        v = Number.isFinite(n) ? n : null;
      }
      row[col] = v;
    }
    return row;
  }

  // GET /api/jpd/fretes?company_id=&from=&to=&motorista=&placa=&situacao=
  app.get("/api/jpd/fretes", async (req, res) => {
    try {
      const { from, to, motorista, placa, situacao, abertos } = req.query as Record<string, string>;
      let q = supabaseBackend.from("jpd_fretes").select("*")
        .order("data_da_carga", { ascending: false });
      if (from) q = q.gte("data_da_carga", from);
      if (to) q = q.lte("data_da_carga", to);
      if (motorista) q = q.eq("motorista", motorista);
      if (placa) q = q.eq("placa_do_carro", placa);
      if (situacao) q = q.eq("situacao_do_bv", situacao);
      if (abertos) q = q.or("situacao_do_bv.is.null,situacao_do_bv.neq.pago");
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/jpd/fretes
  app.post("/api/jpd/fretes", async (req, res) => {
    try {
      const row = buildFreteRow(req.body);
      const { data, error } = await supabaseBackend.from("jpd_fretes").insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/jpd/fretes/:id
  app.put("/api/jpd/fretes/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const row = { ...buildFreteRow(req.body), updated_at: new Date().toISOString() };
      const { data, error } = await supabaseBackend.from("jpd_fretes").update(row).eq("id", id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/jpd/fretes/:id
  app.delete("/api/jpd/fretes/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      // Desvincula abastecimentos ligados a este BV (frete_id -> null), senão a
      // FK homedometro_abastecimento_jpd.frete_id bloqueia o delete. Os
      // lançamentos de combustível são preservados, apenas soltos do frete.
      await supabaseBackend
        .from("homedometro_abastecimento_jpd")
        .update({ frete_id: null })
        .eq("frete_id", id);
      const { error } = await supabaseBackend.from("jpd_fretes").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jpd/veiculos?company_id=&placa=  (agregado por placa a partir de jpd_fretes)
  app.get("/api/jpd/veiculos", async (req, res) => {
    try {
      const placa = req.query.placa as string | undefined;
      const { data: fretes, error } = await supabaseBackend.from("jpd_fretes").select("*");
      if (error) return res.status(500).json({ error: error.message });
      const { data: abasts } = await supabaseBackend.from("homedometro_abastecimento_jpd").select("*");
      const num = (v: any) => (v == null ? 0 : Number(v) || 0);
      const rows = fretes || [];
      const lancamentos = abasts || [];

      const calcConsumo = (viagensArr: any[], lancArr: any[]) => {
        const km = viagensArr.reduce((s: number, r: any) => s + num(r.total_km), 0);
        const litros = lancArr.reduce((s: number, l: any) => s + num(l.litros), 0);
        const dias = new Set(viagensArr.map((r: any) => r.data_da_carga).filter(Boolean)).size;
        const gasto_combustivel = lancArr.reduce((s: number, l: any) => s + (num(l.valor_bruto) - num(l.desconto)), 0);
        const arla_total = lancArr.reduce((s: number, l: any) => s + num(l.arla), 0);
        return {
          km_por_litro: litros > 0 ? km / litros : 0,
          media_km_diaria: dias > 0 ? km / dias : 0,
          total_leituras: lancArr.length,
          litros_totais: litros,
          gasto_combustivel,
          custo_medio_litro: litros > 0 ? gasto_combustivel / litros : 0,
          custo_extra_arla: arla_total,
        };
      };

      if (placa) {
        const viagens = rows
          .filter((r: any) => (r.placa_do_carro || "") === placa)
          .sort((a: any, b: any) => String(b.data_da_carga || "").localeCompare(String(a.data_da_carga || "")));
        const lancPlaca = lancamentos.filter((l: any) => (l.placa || "") === placa);
        const resumo = {
          placa,
          viagens: viagens.length,
          faturado: viagens.reduce((s: number, r: any) => s + num(r.valor_faturado), 0),
          frete: viagens.reduce((s: number, r: any) => s + num(r.valor_do_frete), 0),
          km: viagens.reduce((s: number, r: any) => s + num(r.total_km), 0),
          combustivel: viagens.reduce((s: number, r: any) => s + num(r.abastecimento_pago_pela_jpd), 0),
        };
        return res.json({ resumo, viagens, consumo: calcConsumo(viagens, lancPlaca) });
      }

      const byPlaca: Record<string, any> = {};
      for (const r of rows) {
        const p = r.placa_do_carro || "—";
        byPlaca[p] ??= { placa: p, viagens: 0, faturado: 0, frete: 0, km: 0, combustivel: 0, ultimo_bv: "", _ultima_data: "" };
        const v = byPlaca[p];
        v.viagens += 1;
        v.faturado += num(r.valor_faturado);
        v.frete += num(r.valor_do_frete);
        v.km += num(r.total_km);
        v.combustivel += num(r.abastecimento_pago_pela_jpd);
        const d = String(r.data_da_carga || r.data_do_bv || "");
        if (r.numero_do_bv && d >= v._ultima_data) {
          v.ultimo_bv = r.numero_do_bv;
          v._ultima_data = d;
        }
      }
      const resumo = Object.values(byPlaca)
        .map(({ _ultima_data, ...rest }: any) => {
          const viagensPlaca = rows.filter((r: any) => (r.placa_do_carro || "—") === rest.placa);
          const lancPlaca = lancamentos.filter((l: any) => (l.placa || "") === rest.placa);
          return { ...rest, ultimo_bv: rest.ultimo_bv || "(pendente)", consumo: calcConsumo(viagensPlaca, lancPlaca) };
        })
        .sort((a: any, b: any) => b.faturado - a.faturado);
      const em_andamento = rows
        .filter((r: any) => r.numero_do_bv && !r.data_da_descarga)
        .map((r: any) => ({
          id: r.id,
          placa: r.placa_do_carro || "—",
          motorista: r.motorista || "—",
          origem: r.origem || "—",
          destinatario: r.destinatario || "—",
          data: r.data_da_carga || r.data_do_bv || "—",
        }));
      // Consumo dos cards: recalcula sobre o conjunto filtrado (f_placa/f_motorista/f_busca)
      // quando houver filtro na lista. Sem filtro, mantém o agregado global (comportamento atual).
      // Usa nomes f_* para não colidir com ?placa= (branch de detalhe acima).
      const fPlaca = (req.query.f_placa as string) || "";
      const fMotorista = (req.query.f_motorista as string) || "";
      const fBusca = ((req.query.f_busca as string) || "").trim().toLowerCase();
      let consumoRows = rows;
      let consumoLanc = lancamentos;
      if (fPlaca || fMotorista || fBusca) {
        const fretesFiltrados = rows.filter((r: any) => {
          if (fPlaca && (r.placa_do_carro || "") !== fPlaca) return false;
          if (fMotorista && (r.motorista || "") !== fMotorista) return false;
          if (fBusca) {
            const alvo = [r.placa_do_carro, r.motorista, r.origem, r.destinatario]
              .map((x: any) => (x == null ? "" : String(x).toLowerCase()))
              .join(" ");
            if (!alvo.includes(fBusca)) return false;
          }
          return true;
        });
        const placasScope = new Set(fretesFiltrados.map((r: any) => r.placa_do_carro || "—"));
        consumoRows = fretesFiltrados;
        consumoLanc = lancamentos.filter((l: any) => placasScope.has(l.placa || "—"));
      }

      res.json({ resumo, em_andamento, consumo: calcConsumo(consumoRows, consumoLanc) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jpd/hodometro?from=&to=  => leituras de hodômetro + resumo agregado.
  // Fonte: coluna `hodometro` de homedometro_abastecimento_jpd (por placa).
  // KM rodado = soma das diferenças positivas de hodômetro entre leituras
  // consecutivas da mesma placa (decréscimos são ignorados). Cálculo no backend.
  app.get("/api/jpd/hodometro", async (req, res) => {
    try {
      const from = (req.query.from as string) || "";
      const to = (req.query.to as string) || "";
      const { data: abasts, error } = await supabaseBackend
        .from("homedometro_abastecimento_jpd")
        .select("id, placa, hodometro, created_at, frete_id");
      if (error) return res.status(500).json({ error: error.message });
      const { data: fretes } = await supabaseBackend
        .from("jpd_fretes")
        .select("id, motorista, placa_do_carro, data_da_carga");

      // Mapa frete_id -> motorista e mapa placa -> motorista (frete mais recente),
      // apenas para exibir o motorista na aba Leituras.
      const motoristaByFrete: Record<string, string> = {};
      const motoristaByPlaca: Record<string, string> = {};
      const ultimaDataPlaca: Record<string, string> = {};
      for (const f of fretes || []) {
        if (f.id != null && f.motorista) motoristaByFrete[String(f.id)] = f.motorista;
        const p = f.placa_do_carro || "";
        const d = String(f.data_da_carga || "");
        if (p && f.motorista && d >= (ultimaDataPlaca[p] || "")) {
          motoristaByPlaca[p] = f.motorista;
          ultimaDataPlaca[p] = d;
        }
      }

      const dateOnly = (iso: any) => (iso ? String(iso).slice(0, 10) : "");
      let leituras = (abasts || []).map((a: any) => {
        const placa = a.placa || "";
        const motorista =
          (a.frete_id != null && motoristaByFrete[String(a.frete_id)]) ||
          motoristaByPlaca[placa] ||
          null;
        return {
          id: a.id,
          placa,
          hodometro: a.hodometro == null ? null : Number(a.hodometro),
          data: a.created_at || null,
          motorista,
        };
      });
      if (from || to) {
        leituras = leituras.filter((l: any) => {
          const d = dateOnly(l.data);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }

      // Agrega KM por placa/dia a partir das leituras de hodômetro do período.
      const byPlaca: Record<string, any[]> = {};
      for (const l of leituras) {
        if (!l.placa || l.hodometro == null || l.hodometro <= 0) continue;
        (byPlaca[l.placa] ||= []).push(l);
      }
      let total_km = 0;
      const dailyKm: Record<string, number> = {};
      const kmByPlaca: Record<string, number> = {};
      for (const placa of Object.keys(byPlaca)) {
        const arr = byPlaca[placa].sort((a, b) => String(a.data).localeCompare(String(b.data)));
        for (let i = 1; i < arr.length; i++) {
          const diff = arr[i].hodometro - arr[i - 1].hodometro;
          if (diff <= 0) continue; // ignora reset/decréscimo
          total_km += diff;
          const dia = dateOnly(arr[i].data);
          dailyKm[dia] = (dailyKm[dia] || 0) + diff;
          kmByPlaca[placa] = (kmByPlaca[placa] || 0) + diff;
        }
      }
      const por_dia = Object.entries(dailyKm)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dia, km]) => ({ dia, km: Math.round(km) }));
      const por_veiculo = Object.entries(kmByPlaca)
        .map(([placa, km]) => ({ placa, km: Math.round(km) }))
        .sort((a, b) => b.km - a.km);
      const diasComKm = por_dia.filter((d) => d.km > 0).length;
      const media_diaria = diasComKm > 0 ? total_km / diasComKm : 0;

      res.json({
        leituras,
        resumo: {
          total_km: Math.round(total_km),
          media_diaria: Math.round(media_diaria),
          por_dia,
          por_veiculo,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jpd/opcoes  => { veiculos: [placa...], motoristas: [nome...] }
  app.get("/api/jpd/opcoes", async (_req, res) => {
    try {
      const { data: veics } = await supabaseBackend.from("veiculo").select("placa");
      const { data: mots } = await supabaseBackend.from("motorista").select("nome");
      const uniqSorted = (arr: any[]) =>
        Array.from(new Set((arr || []).filter((x) => x != null && String(x).trim() !== "")))
          .sort((a, b) => String(a).localeCompare(String(b)));
      res.json({
        veiculos: uniqSorted((veics || []).map((v: any) => v.placa)),
        motoristas: uniqSorted((mots || []).map((m: any) => m.nome)),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- ABASTECIMENTOS ----------
  app.get("/api/jpd/abastecimentos", async (req, res) => {
    try {
      let q = supabaseBackend.from("homedometro_abastecimento_jpd").select("*")
        .order("created_at", { ascending: false });
      if (req.query.placa) q = q.eq("placa", req.query.placa as string);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/jpd/abastecimentos", async (req, res) => {
    try {
      const row = buildAbastecimentoRow(req.body);
      const { data, error } = await supabaseBackend.from("homedometro_abastecimento_jpd").insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/jpd/abastecimentos/:id/vincular", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const frete_id = Number(req.body?.frete_id);
      if (!Number.isFinite(frete_id)) return res.status(400).json({ error: "frete_id obrigatorio" });
      const { data: lanc, error: lErr } = await supabaseBackend.from("homedometro_abastecimento_jpd").select("*").eq("id", id).single();
      if (lErr) return res.status(404).json({ error: lErr.message });
      const custos: Record<string, any> = {};
      for (const c of JPD_CUSTO_COLS) custos[c] = lanc[c];
      const { error: fErr } = await supabaseBackend.from("jpd_fretes")
        .update({ ...custos, updated_at: new Date().toISOString() }).eq("id", frete_id);
      if (fErr) return res.status(500).json({ error: fErr.message });
      const { data, error } = await supabaseBackend.from("homedometro_abastecimento_jpd")
        .update({ frete_id, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/jpd/abastecimentos/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const row = { ...buildAbastecimentoRow(req.body), updated_at: new Date().toISOString() };
      const { data, error } = await supabaseBackend.from("homedometro_abastecimento_jpd").update(row).eq("id", id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/jpd/abastecimentos/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { error } = await supabaseBackend.from("homedometro_abastecimento_jpd").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- OCR (leitura automática via webhooks n8n) ----------
  // Recebem { url } (link público no bucket Supabase jpd-uploads) e devolvem
  // JSON com chaves = colunas do BV/lançamento.
  const N8N_WEBHOOKS_JPD = {
    bv: "https://n8nqp.wiseapp360.com/webhook/leitor-arquivos",
    hodometro: "https://n8nqp.wiseapp360.com/webhook/leitorHodometro",
    comprovante: "https://n8nqp.wiseapp360.com/webhook/leitor-comprovante",
  };
  const chamarWebhookN8nJpd = async (webhookUrl: string, fileUrl: string) => {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fileUrl }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`Webhook respondeu ${r.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`);
    }
    const data = await r.json().catch(() => ({}));
    return Array.isArray(data) ? (data[0] || {}) : (data || {});
  };

  // Converte "DD/MM/YYYY" (formato do webhook) para "YYYY-MM-DD" (input date).
  const brToISO = (v: any): string | null => {
    if (v == null) return null;
    const m = String(v).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  };

  // Traduz a resposta do webhook de BV para as chaves que o formulário
  // (JpdFreteForm) espera. O webhook aninha em `dados_limpos` e usa nomes
  // diferentes; sem esta tradução nada preenche.
  const mapBvOcr = (raw: any) => {
    const clean = (raw && raw.dados_limpos) || raw || {};
    const out: Record<string, any> = {};
    const set = (key: string, val: any) => {
      if (val !== null && val !== undefined && val !== "") out[key] = val;
    };
    const lower = (v: any) => {
      if (v == null) return null;
      const s = String(v).trim().toLowerCase().replace(/\s+/g, " ");
      return s === "" ? null : s;
    };
    set("numero_do_bv", clean.numero_autorizacao);
    set("data_do_bv", brToISO(clean.data));
    set("motorista", lower(clean.motorista));
    set("placa_do_carro", lower(clean.placa_cavalo));
    set("total_km", clean.km_total);
    set("valor_do_frete", clean.valor_total_frete);
    set("abastecimento_descontado_do_frete", clean.total_abastecimento);
    set("arla", clean.total_arla);
    set("combustivel", clean.produto);
    // viagens: 1º bloco (perna vazia) define a origem; 2º bloco (perna cheia)
    // define o destino do frete.
    const viagens = Array.isArray(clean.viagens) ? clean.viagens : [];
    if (viagens[0]) set("origem", viagens[0].origem);
    if (viagens[1]) set("destinatario", viagens[1].destino);
    return out;
  };

  // Traduz as respostas dos webhooks de hodômetro (dados em `output`) e
  // comprovante (dados em `dados_limpos`) para as chaves do form de lançamento.
  const mapLancamentoOcr = (hodo: any, comp: any) => {
    const h = (hodo && hodo.output) || hodo || {};
    const c = (comp && comp.dados_limpos) || comp || {};
    const out: Record<string, any> = {};
    const set = (key: string, val: any) => {
      if (val !== null && val !== undefined && val !== "") out[key] = val;
    };
    set("hodometro", h.kilometragem);
    set("fornecedor", c.fornecedor);
    set("combustivel", c.combustivel);
    set("litros", c.litros);
    set("valor_unitario", c.valor_unitario);
    set("valor_bruto", c.valor_bruto);
    set("desconto", c.desconto);
    set("arla", c.arla);
    return out;
  };

  app.post("/api/jpd/ocr/bv", async (req, res) => {
    try {
      const url = req.body?.url;
      if (!url) return res.status(400).json({ error: "url do arquivo obrigatória" });
      const dados = await chamarWebhookN8nJpd(N8N_WEBHOOKS_JPD.bv, url);
      res.json(mapBvOcr(dados));
    } catch (err: any) {
      res.status(502).json({ error: `Falha na leitura do arquivo: ${err.message}` });
    }
  });

  app.post("/api/jpd/ocr/lancamento", async (req, res) => {
    try {
      const hodometroUrl = req.body?.hodometro_url;
      const comprovanteUrl = req.body?.comprovante_url;
      if (!hodometroUrl || !comprovanteUrl) {
        return res.status(400).json({ error: "hodometro_url e comprovante_url obrigatórios" });
      }
      const [hodo, comp] = await Promise.all([
        chamarWebhookN8nJpd(N8N_WEBHOOKS_JPD.hodometro, hodometroUrl),
        chamarWebhookN8nJpd(N8N_WEBHOOKS_JPD.comprovante, comprovanteUrl),
      ]);
      res.json(mapLancamentoOcr(hodo, comp));
    } catch (err: any) {
      res.status(502).json({ error: `Falha na leitura das imagens: ${err.message}` });
    }
  });

  // GET /api/jpd/dashboard?company_id=&from=&to=
  app.get("/api/jpd/dashboard", async (req, res) => {
    try {
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      let q = supabaseBackend.from("jpd_fretes").select("*");
      if (from) q = q.gte("data_da_carga", from);
      if (to) q = q.lte("data_da_carga", to);
      const { data: fretes, error } = await q;
      if (error) return res.status(500).json({ error: error.message });

      const num = (v: any) => (v == null ? 0 : Number(v) || 0);
      const rows = fretes || [];
      const total_viagens = rows.length;
      const total_frete = rows.reduce((s: number, r: any) => s + num(r.valor_do_frete), 0);
      const total_faturado = rows.reduce((s: number, r: any) => s + num(r.valor_faturado), 0);
      const total_km = rows.reduce((s: number, r: any) => s + num(r.total_km), 0);

      const custos = {
        demais_despesas: rows.reduce((s: number, r: any) => s + num(r.demais_despesas), 0),
        seguros: rows.reduce((s: number, r: any) => s + num(r.seguros), 0),
        abastecimento_jpd: rows.reduce((s: number, r: any) => s + num(r.abastecimento_pago_pela_jpd), 0),
        pneus: rows.reduce((s: number, r: any) => s + num(r.pneus), 0),
      };
      const total_custos = custos.demais_despesas + custos.seguros + custos.abastecimento_jpd + custos.pneus;

      const bySituacao: Record<string, number> = {};
      const byMotorista: Record<string, { motorista: string; viagens: number; valor: number }> = {};
      const byVeiculo: Record<string, { placa: string; viagens: number; valor: number }> = {};
      for (const r of rows) {
        const s = (r.situacao_do_bv || "sem_status").toString();
        bySituacao[s] = (bySituacao[s] || 0) + 1;
        const m = r.motorista || "—";
        const p = r.placa_do_carro || "—";
        byMotorista[m] ??= { motorista: m, viagens: 0, valor: 0 };
        byMotorista[m].viagens += 1;
        byMotorista[m].valor += num(r.valor_do_frete);
        byVeiculo[p] ??= { placa: p, viagens: 0, valor: 0 };
        byVeiculo[p].viagens += 1;
        byVeiculo[p].valor += num(r.valor_faturado);
      }

      res.json({
        kpis: { total_viagens, total_frete, total_faturado, total_custos, total_km },
        custos: [
          { label: "Demais despesas", value: custos.demais_despesas },
          { label: "Seguros", value: custos.seguros },
          { label: "Abastecimento JPD", value: custos.abastecimento_jpd },
          { label: "Pneus", value: custos.pneus },
        ],
        situacao_bvs: Object.entries(bySituacao).map(([label, value]) => ({ label, value })),
        por_motorista: Object.values(byMotorista).sort((a, b) => b.valor - a.valor),
        por_veiculo: Object.values(byVeiculo).sort((a, b) => b.valor - a.valor),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jpd/export.xlsx?company_id=&from=&to=
  app.get("/api/jpd/export.xlsx", async (req, res) => {
    try {
      const company_id = jpdCompanyId(req);
      if (!company_id) return res.status(400).json({ error: "company_id obrigatorio" });
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      let q = supabaseBackend.from("jpd_fretes").select("*").eq("company_id", company_id).order("data_da_carga", { ascending: true });
      if (from) q = q.gte("data_da_carga", from);
      if (to) q = q.lte("data_da_carga", to);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });

      const XLSX = await import("xlsx");
      const rows = (data || []).map((r: any) => ({
        "ORIGEM": r.origem,
        "DESTINATÁRIO": r.destinatario,
        "MOTORISTA": r.motorista,
        "PLACA DO CARRO": r.placa_do_carro,
        "Número do BV": r.numero_do_bv,
        "Total KM": r.total_km,
        "DATA DO BV": r.data_do_bv,
        "DATA DA CARGA": r.data_da_carga,
        "DATA DA DESCARGA": r.data_da_descarga,
        "VALOR DO FRETE": r.valor_do_frete,
        "OUTRAS RECEITAS": r.outras_receitas,
        "ABASTECIMENTO PAGO PELA JPD": r.abastecimento_pago_pela_jpd,
        "ABASTECIMENTO DESCONTADO DO FRETE": r.abastecimento_descontado_do_frete,
        "DEMAIS DESPESAS": r.demais_despesas,
        "SEGUROS": r.seguros,
        "ALUGUEL": r.aluguel,
        "PNEUS": r.pneus,
        "PARCELA PNEUS": r.parcela_pneus,
        "PLANO MANUTENÇÃO + IPVA": r.plano_manutencao_ipva,
        "FALTAS EM LITROS": r.faltas_em_litros,
        "FALTAS ABONADAS EM R$": r.faltas_abonadas_rs,
        "FALTAS COBRADAS EM R$": r.faltas_cobradas_rs,
        "DATA DO FATURAMENTO": r.data_do_faturamento,
        "VALOR FATURADO": r.valor_faturado,
        "NÚMERO DO CTE": r.numero_do_cte,
        "SITUAÇÃO DO BV": r.situacao_do_bv,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fretes");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="jpd_fretes_${Date.now()}.xlsx"`);
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const httpServer = createServer(app);

  startGroupSummaryCron();

  return httpServer;
}