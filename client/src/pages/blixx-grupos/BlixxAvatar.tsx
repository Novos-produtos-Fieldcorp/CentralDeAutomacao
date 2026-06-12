import { avatarFor, initialsOf } from "./lib/blixxTheme";

export function BlixxAvatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  const color = avatarFor(id);
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
    >
      {initialsOf(name)}
    </div>
  );
}
