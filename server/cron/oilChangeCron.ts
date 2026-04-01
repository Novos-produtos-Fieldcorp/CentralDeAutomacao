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
        // Try hodometro first, then acompanhamento_viagem as fallback
        let kmAtual: number | null = null;

        const { data: hodData } = await supabase
          .from('hodometro')
          .select('hod_informado')
          .eq('veiculo_id', record.veiculo_id)
          .order('hod_informado', { ascending: false })
          .limit(1)
          .single();

        if (hodData?.hod_informado != null) {
          const km = parseFloat(hodData.hod_informado);
          if (!isNaN(km)) kmAtual = km;
        }

        const { data: viagemData } = await supabase
          .from('acompanhamento_viagem')
          .select('km_final')
          .eq('veiculo_id', record.veiculo_id)
          .not('km_final', 'is', null)
          .order('km_final', { ascending: false })
          .limit(1)
          .single();

        if (viagemData?.km_final != null) {
          const km = parseFloat(viagemData.km_final);
          if (!isNaN(km) && (kmAtual === null || km > kmAtual)) {
            kmAtual = km;
          }
        }

        if (kmAtual === null) {
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

        // Fetch vehicle plate
        const { data: veiculoData } = await supabase
          .from('veiculo')
          .select('placa')
          .eq('veiculo_id', record.veiculo_id)
          .single();

        const placa = (veiculoData?.placa || '').toUpperCase() || null;
        const status = kmRestante <= 0 ? 'Vencido' : 'Atenção';

        // Idempotency: skip if an unread alert for this vehicle was created in the last 24 hours
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentAlert } = await supabase
          .from('oil_change_alert_log')
          .select('id')
          .eq('company_id', record.company_id)
          .eq('veiculo_id', record.veiculo_id)
          .eq('lido', false)
          .gte('created_at', cutoff)
          .limit(1)
          .single();

        if (recentAlert) {
          result.skipped++;
          continue;
        }

        // Insert in-app alert log instead of sending WhatsApp
        const { error: insertErr } = await supabase
          .from('oil_change_alert_log')
          .insert({
            company_id: record.company_id,
            veiculo_id: record.veiculo_id,
            placa,
            km_atual: kmAtual,
            km_proxima_troca: kmProximaTroca,
            km_restante: kmRestante,
            status,
          });

        if (insertErr) {
          result.errors.push(`Veículo ${placa || record.veiculo_id}: falha ao gravar alerta — ${insertErr.message}`);
          continue;
        }

        // Update ultimo_aviso_km to avoid duplicate alerts within 100 km
        await supabase
          .from('aviso_troca_oleo')
          .update({ ultimo_aviso_km: String(kmAtual) })
          .eq('id', record.id);

        result.sent++;
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
      console.log(`[OIL_CRON] Concluído — alertas gerados: ${result.sent}, ignorados: ${result.skipped}, erros: ${result.errors.length}`);
      if (result.errors.length > 0) {
        console.error('[OIL_CRON] Erros:', result.errors);
      }
    } catch (err) {
      console.error('[OIL_CRON] Erro inesperado:', err);
    }
  });

  console.log('[OIL_CRON] Cron de troca de óleo iniciado (diário às 08:00 Brasília / 11:00 UTC)');
}
