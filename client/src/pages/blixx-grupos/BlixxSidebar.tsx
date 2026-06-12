import { useState } from "react";
import { BlixxAvatar } from "./BlixxAvatar";
import { summarizeConversation } from "./lib/blixxEdge";
import type { BlixxDriver } from "./lib/blixxTypes";

export function BlixxSidebar({ driver, onClose }: { driver: BlixxDriver | null; onClose: () => void }) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!driver) return null;

  async function gen() {
    if (!driver) return;
    setLoading(true); setErr(null); setSummary("");
    try {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const r = await summarizeConversation(driver.id, since.toISOString());
      setSummary(r.summary);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  const mediaMsgs = driver.messages.filter((m) => m.has_media);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-[400px] max-w-full z-50 shadow-2xl flex flex-col bg-white dark:bg-gray-800">
        <header className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
          <BlixxAvatar id={driver.id} name={driver.name} size={48} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate text-gray-800 dark:text-white">{driver.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{driver.phone}</div>
          </div>
          <button
            onClick={onClose}
            className="text-2xl px-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-gray-800 dark:text-white">Resumo IA (hoje)</h3>
            <button
              onClick={gen}
              disabled={loading}
              className="text-xs px-3 py-1 rounded-full text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Gerando..." : "Gerar"}
            </button>
          </div>
          {err && <div className="text-xs text-red-600 dark:text-red-400">{err}</div>}
          {summary && <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{summary}</p>}
          {!summary && !err && !loading && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Clique em &quot;Gerar&quot; para resumir as mensagens do dia.
            </p>
          )}
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="font-semibold text-sm mb-2 text-gray-800 dark:text-white">
            Arquivos / Mídias ({mediaMsgs.length})
          </h3>
          {mediaMsgs.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">Nenhum arquivo.</div>
          ) : (
            <ul className="space-y-2">
              {mediaMsgs.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 text-sm border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-700 dark:text-gray-200"
                >
                  <span>📎</span>
                  <span className="flex-1 truncate">{m.body || m.type}</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {new Date(m.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
