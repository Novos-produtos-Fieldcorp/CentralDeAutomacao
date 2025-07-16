import { Pool } from 'pg';
import { neon } from '@neondatabase/serverless';

// Configuração do banco de dados
const getDatabaseConnection = () => {
  if (process.env.DATABASE_URL) {
    // Usa Neon serverless se disponível
    return neon(process.env.DATABASE_URL);
  } else {
    // Fallback para Pool tradicional
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
};

// Função principal para lidar com requests da API
export const handler = async (event, context) => {
  // Configurar CORS e headers para iframe
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
    'Content-Security-Policy': 'frame-ancestors *;'
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
    const queryParams = event.queryStringParameters || {};

    // Roteamento para health check
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      };
    }

    // Inicializar conexão com banco
    const db = getDatabaseConnection();

    // Rota para buscar motoristas
    if (path === '/motoristas' && method === 'GET') {
      const companyId = queryParams.company_id || 1;
      
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
      
      const result = await db.query ? db.query(query, [companyId]) : await db(query, [companyId]);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows || result)
      };
    }

    // Rota para buscar agregados
    if (path === '/agregados' && method === 'GET') {
      const companyId = queryParams.company_id || 1;
      
      const query = `
        SELECT 
          m.*,
          e.logradouro,
          e.nr_cep,
          b.nome_bairro,
          c.nome_cidade,
          est.sigla_estado,
          v.placa,
          v.tipologia,
          v.marca as marca_veiculo
        FROM motorista m
        LEFT JOIN end_motorista em ON m.motorista_id = em.motorista_id
        LEFT JOIN endereco e ON em.id_endereco = e.id_endereco
        LEFT JOIN bairro b ON e.id_bairro = b.id_bairro
        LEFT JOIN cidade c ON b.id_cidade = c.id_cidade
        LEFT JOIN estado est ON c.id_estado = est.id_estado
        LEFT JOIN veiculo v ON m.motorista_id = v.motorista_id
        WHERE m.company_id = $1 AND m.funcao = 'Agregado'
        ORDER BY m.data_cadastro DESC
      `;
      
      const result = await db.query ? db.query(query, [companyId]) : await db(query, [companyId]);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows || result)
      };
    }

    // Rota para buscar clientes
    if (path === '/clientes' && method === 'GET') {
      const companyId = queryParams.company_id || 1;
      
      const query = `
        SELECT cliente_id, nome, cor
        FROM cliente
        WHERE company_id = $1
        ORDER BY nome
      `;
      
      const result = await db.query ? db.query(query, [companyId]) : await db(query, [companyId]);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows || result)
      };
    }

    // Rota para atualizar status
    if (path === '/motoristas/status' && method === 'PUT') {
      const { motorista_id, status } = body;
      const companyId = queryParams.company_id || 1;
      
      const query = `
        UPDATE motorista 
        SET st_cadastro = $1
        WHERE motorista_id = $2 AND company_id = $3
        RETURNING *
      `;
      
      const result = await db.query ? db.query(query, [status, motorista_id, companyId]) : await db(query, [status, motorista_id, companyId]);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows?.[0] || result[0])
      };
    }

    // Rota não encontrada
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found', path, method })
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