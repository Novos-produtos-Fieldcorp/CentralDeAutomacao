// Script para limpar cache WiseApp e forçar nova configuração
console.log('Limpando cache WiseApp...');

// Limpar todos os caches relacionados ao WiseApp
const cacheKeys = [
  'wiseapp_token_cache',
  'wiseapp_company_cache', 
  'wiseapp_attendant_cache',
  'account_id'
];

cacheKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removido: ${key}`);
});

console.log('Cache WiseApp limpo. Recarregue a página para configurar um novo token.');
