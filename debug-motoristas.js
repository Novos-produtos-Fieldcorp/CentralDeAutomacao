import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugMotoristas() {
  try {
    console.log('🔍 Debugando motoristas...');
    
    // Buscar todos os motoristas
    const { data: allMotoristas, error: motoristasError } = await supabase
      .from('motorista')
      .select('motorista_id, nome')
      .order('nome');
    
    if (motoristasError) {
      console.error('Erro ao buscar motoristas:', motoristasError);
      return;
    }
    
    console.log(`📊 Total de motoristas no banco: ${allMotoristas.length}`);
    allMotoristas.forEach(m => console.log(`  - ${m.nome} (ID: ${m.motorista_id})`));
    
    // Buscar viagens (sem filtros)
    const { data: viagens, error: viagensError } = await supabase
      .from('acompanhamento_viagem')
      .select('id, motorista_id, data_hora_inicial, company_id')
      .not('motorista_id', 'is', null)
      .order('data_hora_inicial', { ascending: false })
      .limit(20);
    
    if (viagensError) {
      console.error('Erro ao buscar viagens:', viagensError);
      return;
    }
    
    console.log(`\n📊 Total de viagens: ${viagens.length}`);
    
    // Simular motoristasComViagem (baseado em viagensEnriquecidas)
    const motoristaIdsPresentes = [...new Set(viagens.map(v => v.motorista_id).filter(Boolean))];
    console.log(`\n🔍 IDs de motoristas presentes em viagens: ${motoristaIdsPresentes.join(', ')}`);
    
    const motoristasComViagem = allMotoristas.filter(m => motoristaIdsPresentes.includes(m.motorista_id));
    console.log(`\n📋 Motoristas que deveriam aparecer no dropdown: ${motoristasComViagem.length}`);
    motoristasComViagem.forEach(m => console.log(`  - ${m.nome} (ID: ${m.motorista_id})`));
    
    // Verificar se há motorista específico
    const motoristaKAREN = allMotoristas.find(m => m.nome.includes('KAREN'));
    if (motoristaKAREN) {
      console.log(`\n✅ Motorista KAREN encontrado: ID ${motoristaKAREN.motorista_id}`);
      console.log(`🔍 Está na lista de motoristasComViagem? ${motoristasComViagem.some(m => m.motorista_id === motoristaKAREN.motorista_id)}`);
      console.log(`🔍 ID 7046 (das viagens) existe em allMotoristas? ${allMotoristas.some(m => m.motorista_id === 7046)}`);
      
      // Buscar motorista com ID 7046
      const motorista7046 = allMotoristas.find(m => m.motorista_id === 7046);
      if (motorista7046) {
        console.log(`✅ Motorista ID 7046 encontrado: ${motorista7046.nome}`);
      } else {
        console.log(`❌ Motorista ID 7046 NÃO encontrado no banco de motoristas!`);
      }
    }
    
  } catch (error) {
    console.error('Erro inesperado:', error);
  }
}

debugMotoristas();
