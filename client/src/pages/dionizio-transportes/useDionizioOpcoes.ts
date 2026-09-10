import { useEffect, useState } from 'react';
import { dionizioApi, DionizioOpcoes } from './api';

const EMPTY: DionizioOpcoes = { veiculos: [], motoristas: [], clientes: [] };

// Carrega placas, motoristas e clientes ativos para popular os selects dos modais.
export function useDionizioOpcoes() {
  const [opcoes, setOpcoes] = useState<DionizioOpcoes>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const data = await dionizioApi.get('/opcoes');
        if (ativo) setOpcoes(data);
      } catch {
        if (ativo) setOpcoes(EMPTY);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  return { opcoes, loading };
}
