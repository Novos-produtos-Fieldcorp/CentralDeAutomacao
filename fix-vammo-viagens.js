import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixVammoViagens() {
  try {
    // Buscar viagens recentes sem operação
    const { data: viagens, error: viagensError } = await supabase
      .from('acompanhamento_viagem')
      .select('id, data_hora_inicial')
      .order('data_hora_inicial', { ascending: false })
      .limit(5);

    if (viagensError) {
      console.error('Erro:', viagensError);
      return;
    }

    console.log('Viagens disponíveis:', viagens.map(v => `ID: ${v.id}, Data: ${v.data_hora_inicial}`));

    // Atualizar primeiro registro Vammo para viagem mais recente
    const { error: updateError } = await supabase
      .from('operacao_vammo')
      .update({ id_viagem: viagens[0].id })
      .eq('id', 1);

    if (updateError) {
      console.error('Erro ao atualizar:', updateError);
    } else {
      console.log(`✅ Registro Vammo ID 1 vinculado à viagem ${viagens[0].id}`);
    }

    // Atualizar segundo registro Vammo para segunda viagem mais recente
    const { error: updateError2 } = await supabase
      .from('operacao_vammo')
      .update({ id_viagem: viagens[1].id })
      .eq('id', 2);

    if (updateError2) {
      console.error('Erro ao atualizar:', updateError2);
    } else {
      console.log(`✅ Registro Vammo ID 2 vinculado à viagem ${viagens[1].id}`);
    }

  } catch (error) {
    console.error('Erro:', error);
  }
}

fixVammoViagens();
