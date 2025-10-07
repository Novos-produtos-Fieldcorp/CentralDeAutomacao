// Helper para detectar qual endpoint usar para sincronização
export class EndpointDetector {
  private static cache: Map<string, boolean> = new Map();
  
  static async detectBestEndpoint(): Promise<'supabase' | 'backend'> {
    const cacheKey = 'best-endpoint';
    
    // Verificar cache primeiro
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ? 'supabase' : 'backend';
    }
    
    try {
      // Testar função Supabase primeiro
      const supabaseUrl = '/functions/v1/sync-motoristas-bulk';
      const testResponse = await fetch(supabaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ company_id: 1 }) // Teste com company_id 1
      });
      
      if (testResponse.ok || testResponse.status === 400) {
        // 400 é OK porque significa que a função existe mas precisa de parâmetros válidos
        console.log('✅ Função Supabase disponível');
        this.cache.set(cacheKey, true);
        return 'supabase';
      }
    } catch (error) {
      console.log('❌ Função Supabase não disponível:', error);
    }
    
    // Fallback para backend
    console.log('🔄 Usando backend como fallback');
    this.cache.set(cacheKey, false);
    return 'backend';
  }
  
  static clearCache() {
    this.cache.clear();
  }
}
