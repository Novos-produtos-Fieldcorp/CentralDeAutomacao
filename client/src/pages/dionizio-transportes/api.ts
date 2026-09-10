// Cliente HTTP simples para /api/dionizio/*.

const BASE = '/api/dionizio';

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

export const dionizioApi = {
  get: (path: string) => request(path),
  post: (path: string, body: any) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: any) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => request(path, { method: 'DELETE' }),
};

export type Opcao = { id: number; nome?: string; placa?: string };

export type DionizioOpcoes = {
  veiculos: { id: number; placa: string }[];
  motoristas: { id: number; nome: string }[];
  clientes: { id: number; nome: string }[];
};
