const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Função principal para lidar com requests da API
exports.handler = async (event, context) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Lidar com preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/api', '');
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : null;

    // Roteamento simples
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      };
    }

    // Exemplo de rota para buscar dados
    if (path === '/motoristas' && method === 'GET') {
      const query = `
        SELECT 
          m.*,
          e.logradouro,
          e.nr_cep,
          b.nome_bairro,
          c.nome_cidade,
          est.sigla_estado
        FROM motorista m
        LEFT JOIN end_motorista em ON m.motorista_id = em.motorista_id
        LEFT JOIN endereco e ON em.id_endereco = e.id_endereco
        LEFT JOIN bairro b ON e.id_bairro = b.id_bairro
        LEFT JOIN cidade c ON b.id_cidade = c.id_cidade
        LEFT JOIN estado est ON c.id_estado = est.id_estado
        WHERE m.company_id = $1
        ORDER BY m.data_cadastro DESC
      `;
      
      const result = await pool.query(query, [1]); // Assumindo company_id = 1
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    // Rota não encontrada
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error('Error in API function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};