// Helpers de formatação compartilhados pelo módulo JPD Transportes.

export const fmtBRL = (n: any) =>
  n == null || n === ''
    ? '—'
    : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtNum = (n: any) =>
  (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// Capitaliza cada palavra para exibição (o backend guarda em minúsculas).
// Ex.: "jose carlos da silva" -> "Jose Carlos Da Silva".
export const capitalizeNome = (v: any) => {
  if (v == null || v === '') return '';
  return String(v)
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
};

// Placas são guardadas em minúsculas internamente; exibição sempre em CAIXA ALTA.
export const upperPlaca = (v: any) => (v == null || v === '' ? '' : String(v).toUpperCase());

// Converte data ISO (YYYY-MM-DD, com ou sem horário) para exibição em DD/MM/AAAA.
export const fmtDataBR = (v: any) => {
  if (v == null || v === '') return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(v);
  const [, ano, mes, dia] = m;
  return `${dia}/${mes}/${ano}`;
};

// Converte timestamp ISO (com hora) para exibição em DD/MM/AAAA HH:MM.
export const fmtDataHoraBR = (v: any) => {
  if (v == null || v === '') return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Data de hoje no formato YYYY-MM-DD (fuso local), para enviar ao backend.
export const hojeISO = () => {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
