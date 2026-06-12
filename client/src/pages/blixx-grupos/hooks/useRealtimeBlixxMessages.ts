import { useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import type { BlixxMessage } from "../lib/blixxTypes";

export function useRealtimeBlixxMessages(
  driverIds: string[],
  onInsert: (m: BlixxMessage) => void,
) {
  useEffect(() => {
    if (driverIds.length === 0) return;
    const ids = new Set(driverIds);

    const channel = supabase
      .channel(`blixx-messages-${driverIds.join("-").slice(0, 60)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "blixx_messages" },
        (payload) => {
          const m = payload.new as BlixxMessage;
          console.info("[BlixxRealtime] INSERT recebido:", m.driver_id, ids.has(m.driver_id) ? "(no painel)" : "(fora do painel)");
          if (ids.has(m.driver_id)) onInsert(m);
        },
      )
      .subscribe((status, err) => {
        console.info(`[BlixxRealtime] canal status=${status}`, err ?? "");
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverIds.join("|"), onInsert]);
}
