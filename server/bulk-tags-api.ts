import { db } from "./db";
import { motorista_tags, tags } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

// API otimizada para buscar tags de múltiplos motoristas
export async function getBulkMotoristaTags(motorista_ids: number[], company_id: number) {
  try {
    const associations = await db
      .select({
        motorista_id: motorista_tags.motorista_id,
        tag_id: motorista_tags.tag_id,
        tag_nome: tags.nome,
        tag_cor: tags.cor,
        tag_company_id: tags.company_id,
        tag_id_from_tags: tags.id
      })
      .from(motorista_tags)
      .innerJoin(tags, eq(motorista_tags.tag_id, tags.id))
      .where(
        eq(tags.company_id, company_id)
      )
      .where(
        inArray(motorista_tags.motorista_id, motorista_ids)
      );

    // Organizar por motorista_id
    const result: { [key: number]: any[] } = {};
    
    motorista_ids.forEach((id: number) => {
      result[id] = [];
    });
    
    // Usar Set para evitar duplicatas
    const tagsAdded = new Set<string>();
    
    associations.forEach((association) => {
      if (association.tag_id_from_tags && result[association.motorista_id]) {
        const uniqueKey = `${association.motorista_id}-${association.tag_id_from_tags}`;
        
        if (!tagsAdded.has(uniqueKey)) {
          tagsAdded.add(uniqueKey);
          result[association.motorista_id].push({
            id: association.tag_id_from_tags,
            nome: association.tag_nome,
            cor: association.tag_cor,
            company_id: association.tag_company_id
          });
        }
      }
    });

    return result;
  } catch (error) {
    throw new Error('Erro ao buscar associações de tags: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}