import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugDropdown() {
  try {
    console.log('🔍 Debugando comportamento do dropdown...');
    
    // Simular o que acontece no frontend
    const companyId = 16; // Company ID da sessão atual
    
    // 1. Buscar todos os motoristas
    const { data: allMotoristas, error: motoristasError } = await supabase
      .from('motorista')
      .select('motorista_id, nome')
      .order('nome');
    
    if (motoristasError) {
      console.error('Erro ao buscar motoristas:', motoristasError);
      return;
    }
    
    console.log(`📊 Total de motoristas: ${allMotoristas.length}`);
    
    // 2. Buscar viagens sem filtros (simulando viagensEnriquecidas)
    const { data: viagens, error: viagensError } = await supabase
      .from('acompanhamento_viagem')
      .select('id, motorista_id, data_hora_inicial, company_id')
      .eq('company_id', companyId)
      .not('motorista_id', 'is', null)
      .order('data_hora_inicial', { ascending: false });
    
    if (viagensError) {
      console.error('Erro ao buscar viagens:', viagensError);
      return;
    }
    
    console.log(`📊 Total de viagens: ${viagens.length}`);
    
    // 3. Simular motoristasComViagem
    const motoristaIdsPresentes = [...new Set(viagens.map(v => v.motorista_id).filter(Boolean))];
    console.log(`🔍 IDs de motoristas presentes: ${motoristaIdsPresentes.join(', ')}`);
    
    const motoristasComViagem = allMotoristas.filter(m => motoristaIdsPresentes.includes(m.motorista_id));
    console.log(`📋 Motoristas que devem aparecer no dropdown: ${motoristasComViagem.length}`);
    motoristasComViagem.forEach(m => console.log(`  - ${m.nome} (ID: ${m.motorista_id})`));
    
    // 4. Simular seleção de motorista
    const selectedMotorista = '3083'; // KAREN MARTIN SIMAO
    console.log(`\n🎯 Motorista selecionado: ${selectedMotorista}`);
    
    // 5. Verificar se motorista selecionado está na lista
    const isSelectedInList = motoristasComViagem.some(m => m.motorista_id.toString() === selectedMotorista);
    console.log(`🔍 Motorista selecionado está na lista? ${isSelectedInList}`);
    
    // 6. Simular filtro por motorista selecionado
    const filteredViagens = viagens.filter(v => 
      selectedMotorista === 'all' || v.motorista_id.toString() === selectedMotorista
    );
    console.log(`📊 Viagens após filtro: ${filteredViagens.length}`);
    
    // 7. Recalcular motoristasComViagem com filteredViagens (erro anterior)
    const motoristaIdsFiltrados = [...new Set(filteredViagens.map(v => v.motorista_id).filter(Boolean))];
    const motoristasFiltrados = allMotoristas.filter(m => motoristaIdsFiltrados.includes(m.motorista_id));
    console.log(`❌ Se usar filteredViagens: ${motoristasFiltrados.length} motoristas`);
    motoristasFiltrados.forEach(m => console.log(`  - ${m.nome} (ID: ${m.motorista_id})`));
    
  } catch (error) {
    console.error('Erro inesperado:', error);
  }
}

debugDropdown();
