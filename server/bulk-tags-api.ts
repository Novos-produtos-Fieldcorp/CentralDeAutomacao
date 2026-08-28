import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://jnwocajxsgkgiixwyxkl.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ";

const supabase = createClient(supabaseUrl, supabaseKey);

// API otimizada para buscar tags de múltiplos motoristas
export async function getBulkMotoristaTags(motorista_ids: number[], company_id: number) {
  const { data: associations, error } = await supabase
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
    .in('motorista_id', motorista_ids)
    .eq('tag.company_id', company_id);

  if (error) {
    throw new Error('Erro ao buscar associações de tags: ' + error.message);
  }

  // Organizar por motorista_id
  const result: { [key: number]: any[] } = {};
  
  motorista_ids.forEach((id: number) => {
    result[id] = [];
  });
  
  // Usar Set para evitar duplicatas
  const tagsAdded = new Set<string>();
  
  associations?.forEach((association: any) => {
    if (association.tag && result[association.motorista_id]) {
      const uniqueKey = `${association.motorista_id}-${association.tag.id}`;
      
      if (!tagsAdded.has(uniqueKey)) {
        tagsAdded.add(uniqueKey);
        result[association.motorista_id].push({
          id: association.tag.id,
          nome: association.tag.nome,
          cor: association.tag.cor,
          company_id: association.tag.company_id
        });
      }
    }
  });

  return result;
}