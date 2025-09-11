import type { Express, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client for backend operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ohmoxsvwjvohmqqgxjhb.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ";

const supabaseBackend = createClient(supabaseUrl, supabaseKey, {
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

// Interface para resultado da sincronização
interface BulkSyncResult {
  success: boolean;
  summary: {
    totalContacts: number;
    processedContacts: number;
    totalLabels: number;
    successfulTags: number;
    failedTags: number;
    newTagsCreated: number;
  };
  errors?: string[];
  syncedTags?: string[];
}

// Função para obter token WiseApp (simplificada)
async function getWiseAppToken(companyId: number): Promise<string | null> {
  try {
    const { data, error } = await supabaseBackend
      .from('wiseapp_acesso')
      .select('access_token_wiseapp')
      .eq('company_id', companyId)
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0].access_token_wiseapp;
  } catch (error) {
    console.error('Error getting WiseApp token:', error);
    return null;
  }
}

// Função principal de sincronização bulk de tags de contatos
export async function bulkSyncContactTags(req: Request, res: Response): Promise<void> {
  try {
    const { companyId } = req.params;
    const { accountId } = req.body;
    
    console.log(`Starting bulk contact tags sync for company_id: ${companyId}, account_id: ${accountId}`);

    // Buscar token WiseApp para esta empresa
    const token = await getWiseAppToken(parseInt(companyId));
    
    if (!token) {
      res.status(404).json({ 
        error: "Token WiseApp não configurado para esta empresa" 
      });
      return;
    }

    // Validar que a empresa existe e corresponde ao account_id
    const { data: companies, error: companyError } = await supabaseBackend
      .from("company")
      .select("id_conta_wiseapp")
      .eq("company_id", parseInt(companyId))
      .eq("id_conta_wiseapp", accountId)
      .limit(1);

    if (companyError || !companies || companies.length === 0) {
      res.status(403).json({ 
        error: "Account ID não corresponde à empresa especificada" 
      });
      return;
    }

    const wiseappApiUrl = process.env.VITE_CHAT_API_URL || "https://chat.wiseapp360.com";
    let processedContacts = 0;
    let successfulTags = 0;
    let failedTags = 0;
    const errors: string[] = [];
    const syncedTags: string[] = [];

    try {
      // 1. Buscar todos os contatos do WiseApp
      console.log("Fetching all contacts from WiseApp...");
      const contactsResponse = await fetch(`${wiseappApiUrl}/api/v1/accounts/${accountId}/contacts`, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!contactsResponse.ok) {
        throw new Error(`Erro ao buscar contatos: ${contactsResponse.status}`);
      }

      const contactsData = await contactsResponse.json();
      const contacts = contactsData.payload || contactsData || [];

      console.log(`Found ${contacts.length} contacts in WiseApp`);

      // 2. Buscar todas as labels do WiseApp
      console.log("Fetching all labels from WiseApp...");
      const labelsResponse = await fetch(`${wiseappApiUrl}/api/v1/accounts/${accountId}/labels`, {
        method: 'GET',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!labelsResponse.ok) {
        throw new Error(`Erro ao buscar labels: ${labelsResponse.status}`);
      }

      const labelsData = await labelsResponse.json();
      const allLabels = labelsData.payload || labelsData || [];

      console.log(`Found ${allLabels.length} labels in WiseApp`);

      // 3. Buscar todos os motoristas da empresa
      console.log("Fetching all motoristas from database...");
      const { data: motoristas, error: motoristasError } = await supabaseBackend
        .from("view_motorista_completo")
        .select("motorista_id, nome_motorista, telefone")
        .eq("company_id", parseInt(companyId));

      if (motoristasError) {
        throw new Error(`Erro ao buscar motoristas: ${motoristasError.message}`);
      }

      console.log(`Found ${motoristas?.length || 0} motoristas in database`);

      // 4. Criar mapa de telefone para motorista_id
      const phoneToMotoristaMap = new Map<string, number>();
      motoristas?.forEach(motorista => {
        if (motorista.telefone) {
          const phoneStr = String(motorista.telefone).replace(/^\+55/, '').replace(/\D/g, '');
          phoneToMotoristaMap.set(phoneStr, motorista.motorista_id);
          
          // Também adicionar com o formato +55 para cobertura total
          const formattedWithCountryCode = `55${phoneStr}`;
          phoneToMotoristaMap.set(formattedWithCountryCode, motorista.motorista_id);
        }
      });

      // 5. Criar todas as tags localmente (se não existirem)
      const existingTagsQuery = await supabaseBackend
        .from('tag')
        .select('nome, id')
        .eq('company_id', parseInt(companyId));

      const existingTags = existingTagsQuery.data || [];
      const existingTagNames = new Set(existingTags.map(tag => tag.nome.toLowerCase()));
      const tagNameToIdMap = new Map<string, number>();
      existingTags.forEach(tag => tagNameToIdMap.set(tag.nome.toLowerCase(), tag.id));

      // Criar tags que não existem
      const tagsToCreate = allLabels
        .filter((label: any) => !existingTagNames.has((label.title || label.name || '').toLowerCase()))
        .map((label: any) => ({
          nome: label.title || label.name || 'Tag',
          cor: label.color || '#3B82F6',
          company_id: parseInt(companyId),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

      if (tagsToCreate.length > 0) {
        console.log(`Creating ${tagsToCreate.length} new tags locally...`);
        const { data: newTags, error: createTagsError } = await supabaseBackend
          .from('tag')
          .insert(tagsToCreate)
          .select('id, nome');

        if (createTagsError) {
          console.error('Error creating tags:', createTagsError);
        } else {
          newTags?.forEach(tag => tagNameToIdMap.set(tag.nome.toLowerCase(), tag.id));
        }
      }

      // 6. Processar cada contato e suas tags
      for (const contact of contacts) {
        try {
          processedContacts++;
          
          // Verificar se o contato tem telefone
          if (!contact.phone_number) {
            continue;
          }

          // Normalizar telefone do contato (tentar múltiplos formatos)
          const rawPhone = String(contact.phone_number);
          const normalizedPhones = [
            rawPhone.replace(/^\+55/, '').replace(/\D/g, ''),  // Remove +55 e caracteres não numéricos
            rawPhone.replace(/^\+/, '').replace(/\D/g, ''),    // Remove + e caracteres não numéricos
            rawPhone.replace(/\D/g, ''),                       // Remove apenas caracteres não numéricos
            `55${rawPhone.replace(/^\+55/, '').replace(/\D/g, '')}` // Força formato 55XXXXXXXXXX
          ];

          let motoristaId: number | undefined;
          for (const phone of normalizedPhones) {
            motoristaId = phoneToMotoristaMap.get(phone);
            if (motoristaId) break;
          }

          if (!motoristaId) {
            continue; // Contato não corresponde a nenhum motorista
          }

          // Buscar as tags específicas deste contato
          const contactLabelsResponse = await fetch(`${wiseappApiUrl}/api/v1/accounts/${accountId}/contacts/${contact.id}/labels`, {
            method: 'GET',
            headers: {
              'api_access_token': token,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          if (contactLabelsResponse.ok) {
            const contactLabelsData = await contactLabelsResponse.json();
            const contactLabels = contactLabelsData.payload || contactLabelsData || [];

            // Associar cada tag ao motorista
            for (const label of contactLabels) {
              try {
                const tagName = (label.title || label.name || '').toLowerCase();
                const localTagId = tagNameToIdMap.get(tagName);

                if (localTagId) {
                  // Verificar se a associação já existe
                  const { data: existingAssociation } = await supabaseBackend
                    .from('associacao_tags')
                    .select('id')
                    .eq('motorista_id', motoristaId)
                    .eq('tag_id', localTagId)
                    .limit(1);

                  if (!existingAssociation || existingAssociation.length === 0) {
                    // Criar nova associação
                    const { error: associationError } = await supabaseBackend
                      .from('associacao_tags')
                      .insert({
                        motorista_id: motoristaId,
                        tag_id: localTagId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      });

                    if (associationError) {
                      failedTags++;
                      errors.push(`Erro ao associar tag "${label.title || label.name}" ao motorista ${motoristaId}: ${associationError.message}`);
                    } else {
                      successfulTags++;
                      syncedTags.push(`${label.title || label.name} -> Motorista ${motoristaId}`);
                    }
                  } else {
                    successfulTags++; // Tag já associada, conta como sucesso
                  }
                }

                // Delay para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
              } catch (tagError) {
                failedTags++;
                errors.push(`Erro ao processar tag "${label.title || label.name}": ${tagError instanceof Error ? tagError.message : 'Erro desconhecido'}`);
              }
            }
          }

          // Delay entre contatos para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Enviar progresso a cada 10 contatos processados
          if (processedContacts % 10 === 0) {
            console.log(`Progress: ${processedContacts}/${contacts.length} contacts processed`);
          }

        } catch (contactError) {
          console.error(`Error processing contact ${contact.id}:`, contactError);
          errors.push(`Erro ao processar contato ${contact.id}: ${contactError instanceof Error ? contactError.message : 'Erro desconhecido'}`);
        }
      }

      const result: BulkSyncResult = {
        success: true,
        summary: {
          totalContacts: contacts.length,
          processedContacts,
          totalLabels: allLabels.length,
          successfulTags,
          failedTags,
          newTagsCreated: tagsToCreate.length
        },
        errors: errors.length > 0 ? errors.slice(0, 10) : [], // Limitar erros retornados
        syncedTags: syncedTags.length > 0 ? syncedTags.slice(0, 20) : [] // Limitar tags sincronizadas retornadas
      };

      console.log("Bulk sync completed:", result.summary);
      res.json(result);

    } catch (error) {
      console.error("Error during bulk sync:", error);
      const errorResult: BulkSyncResult = {
        success: false,
        summary: {
          totalContacts: 0,
          processedContacts,
          totalLabels: 0,
          successfulTags,
          failedTags,
          newTagsCreated: 0
        },
        errors: [`Erro durante sincronização em lote: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
      };
      res.status(500).json(errorResult);
    }

  } catch (error) {
    console.error("Error in bulk contact tags sync:", error);
    const errorResult: BulkSyncResult = {
      success: false,
      summary: {
        totalContacts: 0,
        processedContacts: 0,
        totalLabels: 0,
        successfulTags: 0,
        failedTags: 0,
        newTagsCreated: 0
      },
      errors: ["Erro interno do servidor durante sincronização em lote"]
    };
    res.status(500).json(errorResult);
  }
}

// Registrar a rota
export function registerBulkContactTagsRoute(app: Express): void {
  app.post("/api/wiseapp/bulk-sync-contact-tags/:companyId", bulkSyncContactTags);
}