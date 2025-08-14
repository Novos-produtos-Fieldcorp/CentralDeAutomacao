import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  cliente,
  unidade,
  operacao,
  st_vaga,
  company,
  vaga,
  motorista,
} from "@shared/schema";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with bypass RLS for backend operations
const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://ohmoxsvwjvohmqqgxjhb.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ";
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: "public" },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
    },
  },
});

// Helper function to get company_id from account_id
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

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Rota para buscar empresa por account_id
  app.get("/api/company/by-account/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log("Fetching company for account_id:", accountId);

      const { data: companies, error } = await supabase
        .from("company")
        .select("*")
        .eq("id_conta_wiseapp", accountId)
        .limit(1);

      if (error) {
        console.error("Error fetching company:", error);
        return res.status(500).json({ error: "Erro ao buscar empresa" });
      }

      if (!companies || companies.length === 0) {
        console.log("No company found for account_id:", accountId);
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
  // Rota simplificada para inboxes - retorna 404 para ativar fallback
  app.get("/api/chatwoot/inboxes/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { account_id } = req.query;
      
      console.log(`Inboxes request for company_id: ${companyId}, account_id: ${account_id} - using fallback mode`);
      
      // Sempre retorna 404 para ativar o sistema de fallback no frontend
      res.status(404).json({
        error: "API indisponível - usando chat com dados de fallback",
        company_id: parseInt(companyId),
        account_id: account_id
      });
    } catch (error) {
      console.error("Error in fallback inbox route:", error);
      res.status(404).json({
        error: "API indisponível - usando chat com dados de fallback"
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

  // Tags API routes
  app.get("/api/tags", async (req, res) => {
    try {
      const companyId = req.query.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "company_id é obrigatório" });
      }

      const tags = await storage.getTags(Number(companyId));
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
        Number(tag_id),
        company_id ? Number(company_id) : undefined,
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
      
      const accountId = req.header('account_id') || '1';
      const companyId = await getCompanyIdFromAccount(accountId);
      
      if (!companyId) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Buscar diretamente usando Supabase
      const { data: result, error } = await supabase
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
        const { data: allMotoristas } = await supabase
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

      const { data, error } = await supabase
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
      const companyId = req.headers['company-id'] || '1';
      
      // Buscar dados do motorista
      const { data: motorista, error: motoristaError } = await supabase
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
          const { error: updateError } = await supabase
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
      const companyId = req.headers['company-id'] || '1';
      
      // Buscar todos os motoristas ativos com telefone
      const { data: motoristas, error: motoristasError } = await supabase
        .from('motorista')
        .select('motorista_id, nome, telefone, foto_whatsapp')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .not('telefone', 'is', null);
      
      if (motoristasError) {
        return res.status(500).json({ error: 'Erro ao buscar motoristas' });
      }
      
      const results = {
        totalProcessed: motoristas?.length || 0,
        successful: 0,
        failed: 0,
        errors: [] as Array<{ motorista_id: number; nome: string; error: string }>
      };
      
      if (!motoristas || motoristas.length === 0) {
        return res.json({ success: true, data: results });
      }
      
      // Processar cada motorista
      for (const motorista of motoristas) {
        try {
          const phone = `55${motorista.telefone}`;
          const searchUrl = `https://chat.wiseapp360.com/api/v1/accounts/${companyId}/contacts/search?q=${phone}`;
          
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': process.env.WISEAPP_API_TOKEN || '',
              'Content-Type': 'application/json'
            }
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            
            if (searchData.payload?.length > 0) {
              const contact = searchData.payload[0];
              
              // Se tem foto e é diferente da atual, atualizar
              if (contact.thumbnail && contact.thumbnail !== motorista.foto_whatsapp) {
                const { error: updateError } = await supabase
                  .from('motorista')
                  .update({ foto_whatsapp: contact.thumbnail })
                  .eq('motorista_id', motorista.motorista_id);
                
                if (!updateError) {
                  results.successful++;
                } else {
                  results.failed++;
                  results.errors.push({
                    motorista_id: motorista.motorista_id,
                    nome: motorista.nome || 'N/A',
                    error: 'Erro ao atualizar foto no banco'
                  });
                }
              } else {
                results.successful++;
              }
            } else {
              results.failed++;
              results.errors.push({
                motorista_id: motorista.motorista_id,
                nome: motorista.nome || 'N/A',
                error: 'Contato não encontrado no WiseApp'
              });
            }
          } else {
            results.failed++;
            results.errors.push({
              motorista_id: motorista.motorista_id,
              nome: motorista.nome || 'N/A',
              error: 'Erro na busca do WiseApp'
            });
          }
          
          // Pequena pausa para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome || 'N/A',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }
      
      res.json({ success: true, data: results });
      
    } catch (error) {
      console.error('Erro na sincronização em lote:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  app.post("/api/wiseapp/validate-config", async (req, res) => {
    try {
      const companyId = req.headers['company-id'] || '1';
      
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

  const httpServer = createServer(app);

  return httpServer;
}