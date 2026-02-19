import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkVammoTable() {
  try {
    console.log('Verificando dados da tabela operacao_vammo...');
    
    // Verificar dados na tabela diretamente
    const { data: vammoData, error: vammoError } = await supabase
      .from('operacao_vammo')
      .select('*');
    
    if (vammoError) {
      console.error('Erro ao buscar dados da tabela operacao_vammo:', vammoError);
      return;
    }
    
    console.log(`📊 Total de registros na operacao_vammo: ${vammoData.length}`);
    
    if (vammoData.length > 0) {
      console.log('📋 Registros encontrados:');
      vammoData.forEach((record, index) => {
        console.log(`\n--- Registro ${index + 1} ---`);
        console.log(`ID: ${record.id}`);
        console.log(`ID Viagem: ${record.id_viagem}`);
        console.log(`Origem: ${record.origem}`);
        console.log(`Qtd Motos: ${record.qtd_motos}`);
        console.log(`Destino: ${record.destino}`);
        console.log(`Nº CTE: ${record.nr_cte}`);
        console.log(`Created At: ${record.created_at}`);
      });
      
      // Verificar se há id_viagem correspondente em acompanhamento_viagem
      const viagemIds = vammoData.map(d => d.id_viagem).filter(Boolean);
      console.log(`\n🔍 IDs de viagem encontrados: ${viagemIds.join(', ')}`);
      
      if (viagemIds.length > 0) {
        const { data: viagens, error: viagensError } = await supabase
          .from('acompanhamento_viagem')
          .select('id, data_hora_inicial, motorista_id, company_id')
          .in('id', viagemIds);
        
        if (viagensError) {
          console.error('Erro ao buscar viagens correspondentes:', viagensError);
        } else {
          console.log(`\n✅ Viagens correspondentes encontradas: ${viagens.length}`);
          viagens.forEach((viagem, index) => {
            console.log(`\n--- Viagem ${index + 1} ---`);
            console.log(`ID: ${viagem.id}`);
            console.log(`Data/Hora: ${viagem.data_hora_inicial}`);
            console.log(`Motorista ID: ${viagem.motorista_id}`);
            console.log(`Company ID: ${viagem.company_id}`);
          });
        }
      }
    } else {
      console.log('❌ Nenhum registro encontrado na operacao_vammo');
    }
    
    // Verificar se há viagens sem operação Vammo que deveriam ter
    console.log('\n🔍 Verificando viagens recentes...');
    const { data: recentViagens, error: recentError } = await supabase
      .from('acompanhamento_viagem')
      .select('id, data_hora_inicial, motorista_id')
      .order('data_hora_inicial', { ascending: false })
      .limit(10);
    
    if (!recentError && recentViagens) {
      console.log(`📋 Últimas 10 viagens (IDs): ${recentViagens.map(v => v.id).join(', ')}`);
    }
    
  } catch (error) {
    console.error('Erro inesperado:', error);
  }
}

checkVammoTable();
