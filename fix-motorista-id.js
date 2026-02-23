import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixMotoristaId() {
  try {
    console.log('🔧 Corrigindo ID do motorista KAREN...');
    
    // Buscar viagens com motorista_id 7046
    const { data: viagens7046, error: viagensError } = await supabase
      .from('acompanhamento_viagem')
      .select('id, motorista_id')
      .eq('motorista_id', 7046);
    
    if (viagensError) {
      console.error('Erro ao buscar viagens:', viagensError);
      return;
    }
    
    console.log(`📊 Encontradas ${viagens7046.length} viagens com motorista_id 7046`);
    
    // Atualizar para o ID correto (3083)
    for (const viagem of viagens7046) {
      console.log(`🔄 Atualizando viagem ${viagem.id}: motorista_id 7046 → 3083`);
      
      const { error: updateError } = await supabase
        .from('acompanhamento_viagem')
        .update({ motorista_id: 3083 })
        .eq('id', viagem.id);
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar viagem ${viagem.id}:`, updateError);
      } else {
        console.log(`✅ Viagem ${viagem.id} atualizada com sucesso`);
      }
    }
    
    console.log('\n🎉 Correção concluída! Agora KAREN SPERLONGO LONGHI deve aparecer corretamente no dropdown.');
    
  } catch (error) {
    console.error('Erro inesperado:', error);
  }
}

fixMotoristaId();
