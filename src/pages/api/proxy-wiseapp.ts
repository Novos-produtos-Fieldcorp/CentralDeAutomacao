import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { endpoint, ...query } = req.query;
  const method = req.method ?? 'GET';

  if (!endpoint || Array.isArray(endpoint)) {
    return res.status(400).json({ error: 'Parâmetro endpoint ausente ou inválido' });
  }

  const params = new URLSearchParams(query as Record<string, string>).toString();
  const url = `https://chat.wiseapp360.com/api/v1/accounts/1/${endpoint}${params ? `?${params}` : ''}`;

  const headers: Record<string, string> = {
    'api_access_token': process.env.NEXT_PUBLIC_API_KEY_WISEAPP || '',
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Erro no proxy WiseApp:', error);
    res.status(500).json({ error: 'Erro ao conectar com WiseApp API' });
  }
}