// Helpers de formatação compartilhados pelo módulo Dionizio Transportes.

export const fmtBRL = (n: any) =>
  n == null || n === ''
    ? '—'
    : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtNum = (n: any) =>
  (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const fmtDate = (v: any) => {
  if (!v) return '—';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  if (!y || !m || !d) return String(v);
  return `${d}/${m}/${y}`;
};

// Placas são guardadas em minúsculas internamente; exibição sempre em CAIXA ALTA.
export const upperPlaca = (v: any) => (v == null || v === '' ? '' : String(v).toUpperCase());

// Data de hoje no formato YYYY-MM-DD (fuso local), para enviar ao backend.
export const hojeISO = () => {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const STATUS_VIAGEM: Record<string, { label: string; className: string }> = {
  planejada: { label: 'Planejada', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  concluida: { label: 'Concluída', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export const STATUS_OCORRENCIA: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  resolvido: { label: 'Resolvido', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

export const GRAVIDADE_OCORRENCIA: Record<string, { label: string; className: string }> = {
  baixa: { label: 'Baixa', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  media: { label: 'Média', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  alta: { label: 'Alta', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};
