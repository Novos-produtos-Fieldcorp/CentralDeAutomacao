import { useEffect, useRef, useState } from "react";
import { BlixxAvatar } from "./BlixxAvatar";
import { BlixxMessageBubble } from "./BlixxMessageBubble";
import type { BlixxDriver } from "./lib/blixxTypes";

export function BlixxDriverCard({
  driver,
  highlighted,
  onClick,
}: {
  driver: BlixxDriver;
  highlighted: boolean;
  onClick: () => void;
}) {
  const [flash, setFlash] = useState(false);
  const lastIdRef = useRef<string | null>(driver.messages.at(-1)?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lastId = driver.messages.at(-1)?.id ?? null;
    if (lastId && lastId !== lastIdRef.current) {
      lastIdRef.current = lastId;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1500);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      return () => clearTimeout(t);
    }
  }, [driver.messages]);

  const isHighlighted = flash || highlighted;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col w-full h-full text-left rounded-lg overflow-hidden border shadow-md transition-shadow
        bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700
        ${isHighlighted ? "ring-[3px] ring-green-400" : ""}`}
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
        <BlixxAvatar id={driver.id} name={driver.name} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate text-gray-800 dark:text-white">
            {driver.name}
          </div>
          <div className="text-xs truncate text-gray-500 dark:text-gray-400">
            {driver.phone}
          </div>
        </div>
      </header>
      <div ref={scrollRef} className="flex flex-col gap-2 p-3 overflow-y-auto flex-1">
        {driver.messages.length === 0 ? (
          <div className="text-xs text-center py-4 text-gray-500 dark:text-gray-400">
            Sem mensagens ainda
          </div>
        ) : (
          driver.messages.map((m) => <BlixxMessageBubble key={m.id} m={m} />)
        )}
      </div>
    </button>
  );
}
