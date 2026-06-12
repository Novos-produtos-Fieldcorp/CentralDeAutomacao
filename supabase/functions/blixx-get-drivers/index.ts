import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { group_id, company_id, limit = 30 } = await req.json();
    if (!group_id) {
      return new Response(JSON.stringify({ error: "group_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Multi-tenant: valida que o grupo pertence à company informada
    let groupQuery = supabase
      .from("blixx_groups")
      .select("id")
      .eq("id", group_id);
    if (company_id != null) groupQuery = groupQuery.eq("company_id", company_id);

    const { data: group, error: gErr } = await groupQuery.maybeSingle();
    if (gErr) throw gErr;
    if (!group) {
      return new Response(JSON.stringify({ drivers: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: drivers, error: dErr } = await supabase
      .from("blixx_drivers")
      .select("id, name, phone, group_id")
      .eq("group_id", group_id);
    if (dErr) throw dErr;

    if (!drivers || drivers.length === 0) {
      return new Response(JSON.stringify({ drivers: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const driverIds = drivers.map((d) => d.id);
    const { data: messages, error: mErr } = await supabase
      .from("blixx_messages")
      .select("id, driver_id, type, body, has_media, sent_at")
      .in("driver_id", driverIds)
      .order("sent_at", { ascending: false })
      .limit(limit * driverIds.length);
    if (mErr) throw mErr;

    const byDriver = new Map<string, typeof messages>();
    for (const m of messages ?? []) {
      const arr = byDriver.get(m.driver_id) ?? [];
      if (arr.length < limit) arr.push(m);
      byDriver.set(m.driver_id, arr);
    }

    const result = drivers.map((d) => ({
      ...d,
      messages: (byDriver.get(d.id) ?? []).reverse(),
    }));

    return new Response(JSON.stringify({ drivers: result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
