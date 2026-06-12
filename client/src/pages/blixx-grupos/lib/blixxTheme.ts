// Cores decorativas dos avatares (determinísticas por id) — o restante da
// identidade visual segue o tema da central via classes Tailwind.
export const AVATAR_COLORS = [
  "#1B3A5E", "#2D5F8A", "#5B9B2D", "#D97722", "#7C5CBF",
  "#1A8A72", "#C0392B", "#2980B9", "#E6A817", "#1ABC9C",
  "#CF6A32", "#5F7D8A", "#27AE60", "#D64545", "#3B7DD8",
];

export function avatarFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??";
}
