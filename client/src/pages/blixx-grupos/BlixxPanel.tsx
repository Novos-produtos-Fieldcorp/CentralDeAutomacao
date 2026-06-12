import { useCallback, useEffect, useMemo, useState } from "react";
import { BlixxHeader } from "./BlixxHeader";
import { BlixxDriverCard } from "./BlixxDriverCard";
import { BlixxSidebar } from "./BlixxSidebar";
import { useRealtimeBlixxMessages } from "./hooks/useRealtimeBlixxMessages";
import { loadDriversSnapshot } from "./lib/blixxEdge";
import type { BlixxDriver, BlixxGroup, BlixxMessage } from "./lib/blixxTypes";

export function BlixxPanel({
  groups,
  companyId,
}: {
  groups: BlixxGroup[];
  companyId: number | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null);
  const [drivers, setDrivers] = useState<BlixxDriver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [openDriverId, setOpenDriverId] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const driverIds = useMemo(() => drivers.map((d) => d.id), [drivers]);

  const handleInsert = useCallback((m: BlixxMessage) => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === m.driver_id
          ? { ...d, messages: [...d.messages.slice(-49), m] }
          : d,
      ),
    );
    setHighlighted(m.driver_id);
    setTimeout(() => setHighlighted((cur) => (cur === m.driver_id ? null : cur)), 1500);
  }, []);

  useRealtimeBlixxMessages(driverIds, handleInsert);

  const loadGroup = useCallback(
    async (id: string) => {
      setLoadingDrivers(true);
      try {
        const { drivers } = await loadDriversSnapshot(id, companyId);
        setDrivers(drivers);
      } catch (e) {
        console.error("Erro ao carregar motoristas do grupo:", e);
        setDrivers([]);
      } finally {
        setLoadingDrivers(false);
      }
    },
    [companyId],
  );

  // Carrega o snapshot inicial do primeiro grupo
  useEffect(() => {
    const first = groups[0]?.id ?? null;
    setActiveId(first);
    setOpenDriverId(null);
    if (first) loadGroup(first);
    else setDrivers([]);
  }, [groups, loadGroup]);

  function switchGroup(id: string) {
    setActiveId(id);
    setUnread((u) => ({ ...u, [id]: 0 }));
    setOpenDriverId(null);
    loadGroup(id);
  }

  const openDriver = drivers.find((d) => d.id === openDriverId) ?? null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <BlixxHeader groups={groups} activeId={activeId} onChange={switchGroup} unread={unread} />
      <div
        className="grid gap-4 p-5 mx-auto bg-gray-50 dark:bg-gray-900 rounded-b-lg"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          maxWidth: 1800,
        }}
      >
        {loadingDrivers ? (
          <div className="col-span-full flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <>
            {drivers.map((d) => (
              <div key={d.id} style={{ height: 400 }}>
                <BlixxDriverCard
                  driver={d}
                  highlighted={highlighted === d.id}
                  onClick={() => setOpenDriverId(d.id)}
                />
              </div>
            ))}
            {drivers.length === 0 && (
              <div className="col-span-full text-center py-20 text-gray-500 dark:text-gray-400">
                Nenhum motorista encontrado neste grupo.
              </div>
            )}
          </>
        )}
      </div>
      <BlixxSidebar driver={openDriver} onClose={() => setOpenDriverId(null)} />
    </div>
  );
}
