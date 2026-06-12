import { supabase } from "../../../lib/supabase";
import type { BlixxDriver, BlixxMessage } from "./blixxTypes";

export const getDriversWithMessages = async (
  group_id: string,
  company_id: number | null,
  limit = 30,
): Promise<{ drivers: BlixxDriver[] }> => {
  const { data, error } = await supabase.functions.invoke("blixx-get-drivers", {
    body: { group_id, company_id, limit },
  });
  if (error) throw error;
  return data as { drivers: BlixxDriver[] };
};

// Fallback: consulta direta ao banco (RLS permite leitura para usuários autenticados).
// Usado quando a edge function blixx-get-drivers ainda não está deployada.
export const getDriversWithMessagesDirect = async (
  group_id: string,
  limit = 30,
): Promise<{ drivers: BlixxDriver[] }> => {
  const { data: drivers, error: dErr } = await supabase
    .from("blixx_drivers")
    .select("id, name, phone, group_id")
    .eq("group_id", group_id);
  if (dErr) throw dErr;
  if (!drivers || drivers.length === 0) return { drivers: [] };

  const driverIds = drivers.map((d: { id: string }) => d.id);
  const { data: messages, error: mErr } = await supabase
    .from("blixx_messages")
    .select("id, driver_id, type, body, has_media, sent_at")
    .in("driver_id", driverIds)
    .order("sent_at", { ascending: false })
    .limit(limit * driverIds.length);
  if (mErr) throw mErr;

  const byDriver = new Map<string, BlixxMessage[]>();
  for (const m of (messages ?? []) as BlixxMessage[]) {
    const arr = byDriver.get(m.driver_id) ?? [];
    if (arr.length < limit) arr.push(m);
    byDriver.set(m.driver_id, arr);
  }

  return {
    drivers: drivers.map((d: Omit<BlixxDriver, "messages">) => ({
      ...d,
      messages: (byDriver.get(d.id) ?? []).slice().reverse(),
    })),
  };
};

export const loadDriversSnapshot = async (
  group_id: string,
  company_id: number | null,
  limit = 30,
): Promise<{ drivers: BlixxDriver[] }> => {
  try {
    return await getDriversWithMessages(group_id, company_id, limit);
  } catch (e) {
    console.warn("blixx-get-drivers indisponível, usando consulta direta:", e);
    return getDriversWithMessagesDirect(group_id, limit);
  }
};

export const summarizeConversation = async (
  driver_id: string,
  since?: string,
): Promise<{ summary: string }> => {
  const { data, error } = await supabase.functions.invoke("blixx-summarize-conversation", {
    body: { driver_id, since },
  });
  if (error) throw error;
  return data as { summary: string };
};
