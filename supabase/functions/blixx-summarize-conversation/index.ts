import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { driver_id, since } = await req.json();
    if (!driver_id) {
      return new Response(JSON.stringify({ error: "driver_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("blixx_messages")
      .select("type, body, has_media, sent_at")
      .eq("driver_id", driver_id)
      .order("sent_at", { ascending: true })
      .limit(100);
    if (since) q = q.gte("sent_at", since);

    const { data: messages, error } = await q;
    if (error) throw error;

    const { data: driver } = await supabase
      .from("blixx_drivers").select("name").eq("id", driver_id).single();

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ summary: "Sem mensagens no período." }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const transcript = messages.map((m) => {
      const time = new Date(m.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const content = m.has_media ? `[${m.type}] ${m.body ?? ""}`.trim() : (m.body ?? "");
      return `[${time}] ${content}`;
    }).join("\n");

    const prompt = `Você é um assistente que resume conversas de motoristas em grupos de WhatsApp para gestão de frota.
Resuma a jornada do motorista ${driver?.name ?? ""} em 3-4 frases objetivas, em português, destacando entregas concluídas, intercorrências, paradas e previsões.

Mensagens:
${transcript}

Resumo:`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: `OpenAI: ${txt}` }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const json = await r.json();
    const summary = json.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
