import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { Authorization: `Bearer ${supabaseKey}` } },
});

export interface OilCheckResult {
  sent: number;
  skipped: number;
  errors: string[];
}

export async function checkAndSendOilChangeAlerts(filterCompanyId?: number): Promise<OilCheckResult> {
  const result: OilCheckResult = { sent: 0, skipped: 0, errors: [] };

  try {
    let query = supabase
      .from('aviso_troca_oleo')
      .select(`
        id,
        veiculo_id,
        company_id,
        intervalo_km,
        km_ultima_troca,
        km_aviso_antecipado,
        ativo,
        ultimo_aviso_km
      `)
      .eq('ativo', true);

    if (filterCompanyId !== undefined) {
      query = query.eq('company_id', filterCompanyId);
    }

    const { data: records, error: recordsError } = await query;

    if (recordsError) {
      result.errors.push(`Erro ao buscar registros: ${recordsError.message}`);
      return result;
    }

    if (!records || records.length === 0) {
      return result;
    }

    for (const record of records) {
      try {
        const { data: hodData, error: hodError } = await supabase
          .from('hodometro')
          .select('hod_informado')
          .eq('veiculo_id', record.veiculo_id)
          .order('hod_informado', { ascending: false })
          .limit(1)
          .single();

        if (hodError || !hodData) {
          result.skipped++;
          continue;
        }

        const kmAtual = parseFloat(hodData.hod_informado);
        if (isNaN(kmAtual)) {
          result.skipped++;
          continue;
        }

        const kmUltimaTroca = parseFloat(record.km_ultima_troca);
        const intervaloKm = record.intervalo_km;
        const kmAviso = record.km_aviso_antecipado;
        const kmProximaTroca = kmUltimaTroca + intervaloKm;
        const kmRestante = kmProximaTroca - kmAtual;

        const shouldAlert = kmAtual >= (kmProximaTroca - kmAviso);
        if (!shouldAlert) {
          result.skipped++;
          continue;
        }

        const ultimoAvisoKm = record.ultimo_aviso_km ? parseFloat(record.ultimo_aviso_km) : null;
        if (ultimoAvisoKm !== null && kmAtual < ultimoAvisoKm + 100) {
          result.skipped++;
          continue;
        }

        const { data: veiculoData, error: veiculoError } = await supabase
          .from('veiculo')
          .select('placa, motorista_id')
          .eq('veiculo_id', record.veiculo_id)
          .single();

        if (veiculoError || !veiculoData) {
          result.skipped++;
          continue;
        }

        if (!veiculoData.motorista_id) {
          result.skipped++;
          continue;
        }

        const { data: motoristaData, error: motoristaError } = await supabase
          .from('motorista')
          .select('telefone, nome')
          .eq('motorista_id', veiculoData.motorista_id)
          .single();

        if (motoristaError || !motoristaData || !motoristaData.telefone) {
          result.skipped++;
          continue;
        }

        const placa = (veiculoData.placa || '').toUpperCase();
        const kmRestanteDisplay = Math.round(kmRestante);
        const message = `⚠️ *Aviso de Troca de Óleo* — Veículo ${placa}: a troca de óleo está prevista para ${Math.round(kmProximaTroca).toLocaleString('pt-BR')} km. KM atual: ${Math.round(kmAtual).toLocaleString('pt-BR')}. Restam ${Math.abs(kmRestanteDisplay).toLocaleString('pt-BR')} km${kmRestanteDisplay < 0 ? ' (vencido)' : ''}. Por favor, agende a manutenção.`;

        const baseUrl = process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : `http://localhost:${process.env.PORT || 5000}`;

        const sendResponse = await fetch(`${baseUrl}/api/send-bulk-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numbers: [String(motoristaData.telefone)],
            message,
          }),
        });

        if (sendResponse.ok) {
          await supabase
            .from('aviso_troca_oleo')
            .update({ ultimo_aviso_km: String(kmAtual), updated_at: new Date().toISOString() })
            .eq('id', record.id);
          result.sent++;
        } else {
          const errText = await sendResponse.text();
          result.errors.push(`Veículo ${placa}: falha ao enviar mensagem — ${errText}`);
        }
      } catch (err: any) {
        result.errors.push(`Erro ao processar registro ${record.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Erro geral: ${err.message}`);
  }

  return result;
}

export function startOilChangeCron() {
  // 0 11 * * * = 11:00 UTC = 08:00 Brasília
  cron.schedule('0 11 * * *', async () => {
    console.log('[OIL_CRON] Iniciando verificação diária de troca de óleo...');
    try {
      const result = await checkAndSendOilChangeAlerts();
      console.log(`[OIL_CRON] Concluído — enviados: ${result.sent}, ignorados: ${result.skipped}, erros: ${result.errors.length}`);
      if (result.errors.length > 0) {
        console.error('[OIL_CRON] Erros:', result.errors);
      }
    } catch (err) {
      console.error('[OIL_CRON] Erro inesperado:', err);
    }
  });

  console.log('[OIL_CRON] Cron de troca de óleo iniciado (diário às 08:00 Brasília / 11:00 UTC)');
}
