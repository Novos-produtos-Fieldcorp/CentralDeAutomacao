// Script para testar se a função Supabase está deployada
const https = require('https');

const SUPABASE_URL = 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/sync-all-motoristas`;

console.log('🔍 Testando se a função sync-all-motoristas está deployada...');
console.log('📍 URL:', FUNCTION_URL);

const testData = {
  companyId: '1'
};

const postData = JSON.stringify(testData);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📤 Enviando requisição de teste...');

const req = https.request(FUNCTION_URL, options, (res) => {
  console.log('📊 Status:', res.statusCode);
  console.log('📋 Headers:', res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Resposta:', data);
    
    if (res.statusCode === 200) {
      console.log('✅ Função está deployada e funcionando!');
    } else if (res.statusCode === 404) {
      console.log('❌ Função não encontrada - precisa ser deployada');
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('🔐 Função encontrada mas precisa de autenticação');
    } else {
      console.log('⚠️  Função retornou status inesperado');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro na requisição:', error.message);
  
  if (error.code === 'ENOTFOUND') {
    console.log('🌐 Erro de DNS - verifique a URL');
  } else if (error.code === 'ECONNREFUSED') {
    console.log('🚫 Conexão recusada - função pode não estar deployada');
  }
});

req.write(postData);
req.end();
