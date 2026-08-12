import { useEffect, useState } from 'react';

// Carrega os motoristas cadastrados em motoristas_jpd via GET /api/jpd/opcoes.
// Mesma fonte usada pelo dropdown de motoristas em JpdFreteForm.
export function useMotoristas(): string[] {
  const [motoristas, setMotoristas] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/jpd/opcoes');
        if (res.ok) {
          const data = await res.json();
          setMotoristas(data.motoristas ?? []);
        }
      } catch {
        /* opções vazias */
      }
    })();
  }, []);
  return motoristas;
}
