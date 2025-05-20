import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  },
  db: {
    schema: 'public',
  },
  httpOptions: {
    timeout: 60000, // 60 seconds
    retries: 3,
  },
});

// Add error handling and retry logic to queries
export const createFilteredQuery = (table: string, companyId: number) => {
  const needsCompanyFilter = ['motorista', 'cliente', 'checklist', 'hodometro', 'veiculo'].includes(table);
  
  const addCompanyFilter = (query: any) => {
    return needsCompanyFilter && companyId ? query.eq('company_id', companyId) : query;
  };

  const handleSupabaseError = async (operation: () => Promise<any>) => {
    let retries = 3;
    let lastError: any;
    
    while (retries > 0) {
      try {
        const result = await operation();
        if (result.error) throw result.error;
        return result;
      } catch (error) {
        lastError = error;
        console.error(`Supabase ${table} operation failed (${retries} retries left):`, error);
        
        // If it's a network error and we have retries left, try again
        if (error instanceof TypeError && error.message === 'Failed to fetch' && retries > 1) {
          retries--;
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
          continue;
        }
        
        // If it's a network error with no retries left, throw a user-friendly error
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw new Error(`A conexão com o banco de dados foi recusada. Verifique sua conexão com a internet ou se o serviço está disponível.`);
        }
        
        // If it's a connection refused error, throw a user-friendly error
        if (error.message && (
            error.message.includes('ECONNREFUSED') || 
            error.message.includes('connection refused') ||
            error.message.includes('network error') ||
            error.message.includes('supabase.co')
        )) {
          throw new Error('A conexão com o banco de dados foi recusada. Verifique sua conexão com a internet ou se o serviço está disponível.');
        }
        
        throw error;
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError;
  };

  return {
    select: async (columns: string = '*') => {
      return handleSupabaseError(async () => {
        const query = supabase.from(table).select(columns);
        return addCompanyFilter(query);
      });
    },
    
    insert: async (data: any) => {
      return handleSupabaseError(async () => {
        const insertData = needsCompanyFilter ? { ...data, company_id: companyId } : data;
        return supabase.from(table).insert(insertData);
      });
    },
    
    update: async (data: any) => {
      return handleSupabaseError(async () => {
        let query = supabase.from(table).update(data);
        return addCompanyFilter(query);
      });
    },
    
    delete: async () => {
      return handleSupabaseError(async () => {
        let query = supabase.from(table).delete();
        return addCompanyFilter(query);
      });
    }
  };
};