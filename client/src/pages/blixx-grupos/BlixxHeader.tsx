import type { BlixxGroup } from "./lib/blixxTypes";

export function BlixxHeader({
  groups,
  activeId,
  onChange,
  unread,
}: {
  groups: BlixxGroup[];
  activeId: string | null;
  onChange: (id: string) => void;
  unread: Record<string, number>;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg">
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-2">
          {groups.map((g) => {
            const active = g.id === activeId;
            const u = unread[g.id] || 0;
            return (
              <button
                key={g.id}
                onClick={() => onChange(g.id)}
                className={`relative px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {g.name}
                {u > 0 && !active && (
                  <span className="absolute -top-1 -right-1 text-[10px] rounded-full px-1.5 py-0.5 font-bold bg-green-400 text-gray-900">
                    {u}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
