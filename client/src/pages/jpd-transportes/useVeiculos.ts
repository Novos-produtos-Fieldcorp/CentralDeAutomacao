import { useCallback, useEffect, useState } from 'react';

// Carrega as placas cadastradas em jpd_veiculos via GET /api/jpd/opcoes.
// Mesma fonte usada pelo dropdown de placas em JpdFiltros.
export function useVeiculos() {
  const [placas, setPlacas] = useState<string[]>([]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/jpd/opcoes');
      if (res.ok) {
        const data = await res.json();
        setPlacas(data.veiculos ?? []);
      }
    } catch {
      /* opções vazias */
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Atualiza localmente após renomear uma placa (PUT /api/jpd/veiculos/:placa),
  // sem precisar recarregar a lista inteira.
  const renomear = useCallback((antiga: string, nova: string) => {
    setPlacas((prev) => prev.map((p) => (p === antiga ? nova : p)));
  }, []);

  // Remove localmente após excluir uma placa (DELETE /api/jpd/veiculos/:placa).
  const remover = useCallback((placa: string) => {
    setPlacas((prev) => prev.filter((p) => p !== placa));
  }, []);

  return { placas, renomear, remover };
}
