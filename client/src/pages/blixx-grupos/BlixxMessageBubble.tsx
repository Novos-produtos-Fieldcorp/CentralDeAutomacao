import type { BlixxMessage } from "./lib/blixxTypes";

const ICON: Record<string, string> = {
  image: "🖼️",
  audio: "🎤",
  document: "📄",
  video: "🎬",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function BlixxMessageBubble({ m }: { m: BlixxMessage }) {
  const icon = ICON[m.type];
  return (
    <div className="self-end max-w-[85%] rounded-lg px-3 py-2 text-sm bg-green-100 dark:bg-green-900/30 text-gray-800 dark:text-gray-100">
      {icon ? (
        <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">
          <span>{icon}</span>
          <span className="truncate">{m.body || m.type}</span>
        </div>
      ) : (
        <div className="whitespace-pre-wrap break-words">{m.body}</div>
      )}
      <div className="text-right text-[11px] mt-1 text-gray-500 dark:text-gray-400">
        {fmtTime(m.sent_at)}
      </div>
    </div>
  );
}
