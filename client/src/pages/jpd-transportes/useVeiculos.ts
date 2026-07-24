import { useEffect, useState } from 'react';

// Carrega as placas cadastradas em jpd_veiculos via GET /api/jpd/opcoes.
// Mesma fonte usada pelo dropdown de placas em JpdFiltros.
export function useVeiculos(): string[] {
  const [placas, setPlacas] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/jpd/opcoes');
        if (res.ok) {
          const data = await res.json();
          setPlacas(data.veiculos ?? []);
        }
      } catch {
        /* opções vazias */
      }
    })();
  }, []);
  return placas;
}
