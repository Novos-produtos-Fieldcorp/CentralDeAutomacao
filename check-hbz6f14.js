import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkPlate() {
  console.log('🔍 Consultando dados da placa HBZ6F14...\n');

  // Buscar veículos (podem haver duplicatas)
  const { data: veiculos, error: veiculoError } = await supabase
    .from('veiculo')
    .select('veiculo_id, placa, tipo')
    .ilike('placa', 'HBZ6F14');

  if (veiculoError) {
    console.error('Erro ao buscar veículo:', veiculoError);
    return;
  }

  console.log(`📦 ${veiculos.length} veículo(s) encontrado(s):`);
  veiculos.forEach(v => console.log(`   ID: ${v.veiculo_id}, Placa: ${v.placa}, Tipo: ${v.tipo}`));
  console.log('');

  // Processar cada veículo
  for (const veiculo of veiculos) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚗 Analisando veículo ID ${veiculo.veiculo_id} - ${veiculo.placa}`);
    console.log('='.repeat(80));

    // Buscar leituras de hodômetro
    const { data: hodometros, error: hodoError } = await supabase
      .from('hodometro')
      .select('id_hodometro, data, hora, hod_lido, trip_lida, km_rodado')
      .eq('veiculo_id', veiculo.veiculo_id)
      .order('data', { ascending: true })
      .order('hora', { ascending: true });

    if (hodoError) {
      console.error('Erro ao buscar hodômetros:', hodoError);
      continue;
    }

    console.log(`\n📊 Total de leituras: ${hodometros.length}\n`);
    
    if (hodometros.length === 0) {
      console.log('❌ Nenhuma leitura encontrada para este veículo');
      continue;
    }

    console.log('📋 Leituras (ordenadas por data):\n');
    console.log('ID\tData\t\tHora\tHod Lido\tTrip Lida\tKm Rodado');
    console.log('─'.repeat(80));

    hodometros.forEach(h => {
      const hodLido = h.hod_lido || 'null';
      const tripLida = h.trip_lida || 'null';
      const kmRodado = h.km_rodado || 'null';
      console.log(`${h.id_hodometro}\t${h.data}\t${h.hora}\t${hodLido}\t\t${tripLida}\t\t${kmRodado}`);
    });

    // Análise
    console.log('\n📈 Análise:');
    
    const validReadings = hodometros
      .filter(h => (veiculo.tipo === 'Ciclomotor' ? h.trip_lida : h.hod_lido) != null)
      .map(h => ({
        ...h,
        reading: parseFloat(veiculo.tipo === 'Ciclomotor' ? h.trip_lida : h.hod_lido)
      }))
      .filter(h => !isNaN(h.reading));

    if (validReadings.length === 0) {
      console.log('❌ Nenhuma leitura válida encontrada');
      continue;
    }

    const firstReading = validReadings[0];
    const lastReading = validReadings[validReadings.length - 1];

    console.log(`Tipo do veículo: ${veiculo.tipo}`);
    console.log(`Primeira leitura: ${firstReading.reading} km (${firstReading.data} ${firstReading.hora})`);
    console.log(`Última leitura: ${lastReading.reading} km (${lastReading.data} ${lastReading.hora})`);
    console.log(`KM Total esperado: ${lastReading.reading} - ${firstReading.reading} = ${lastReading.reading - firstReading.reading} km`);

    // Detectar resets
    console.log('\n🔄 Verificando resets (quedas > 100 km):');
    let resetDetected = false;
    for (let i = 1; i < validReadings.length; i++) {
      const diff = validReadings[i].reading - validReadings[i-1].reading;
      if (diff < -100) {
        console.log(`⚠️  Reset detectado: ${validReadings[i-1].data} (${validReadings[i-1].reading} km) → ${validReadings[i].data} (${validReadings[i].reading} km) | Queda: ${diff} km`);
        resetDetected = true;
      }
    }
    
    if (!resetDetected) {
      console.log('✅ Nenhum reset detectado (tolerância: 100 km)');
    }
  }
}

checkPlate().then(() => process.exit(0)).catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
