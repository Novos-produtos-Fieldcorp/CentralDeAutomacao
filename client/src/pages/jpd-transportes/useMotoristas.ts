import { useCallback, useEffect, useState } from 'react';

export type Motorista = { id: number; nome: string };

// Carrega os motoristas cadastrados em motoristas_jpd (com id) via
// GET /api/jpd/motoristas. Usado pelo campo motorista_id do lançamento de
// abastecimento (homedometro_abastecimento_jpd), que referencia o id, e não
// o nome (diferente de jpd_fretes.motorista, que é texto puro).
export function useMotoristas() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/jpd/motoristas');
      if (res.ok) setMotoristas(await res.json());
    } catch {
      /* opções vazias */
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Adiciona localmente um motorista recém-criado, sem precisar recarregar a lista inteira.
  const adicionar = useCallback((m: Motorista) => {
    setMotoristas((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
  }, []);

  // Atualiza localmente após renomear (PUT /api/jpd/motoristas/:id).
  const renomear = useCallback((id: number, novoNome: string) => {
    setMotoristas((prev) => prev.map((m) => (m.id === id ? { ...m, nome: novoNome } : m)));
  }, []);

  // Remove localmente após excluir (DELETE /api/jpd/motoristas/:id).
  const remover = useCallback((id: number) => {
    setMotoristas((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { motoristas, adicionar, renomear, remover };
}
