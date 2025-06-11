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
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    },
  },
  db: {
    schema: 'public',
  },
});

// Enhanced error handling function
const handleSupabaseError = async (operation: () => Promise<any>, context: string = 'operation') => {
  let retries = 3;
  let lastError: any;
  
  while (retries > 0) {
    try {
      const result = await operation();
      if (result && result.error) {
        throw result.error;
      }
      return result;
    } catch (error) {
      lastError = error;
      console.error(`Supabase ${context} failed (${retries} retries left):`, error);
      
      // Check for network-related errors
      const isNetworkError = 
        error instanceof TypeError && 
        (error.message === 'Failed to fetch' || 
         error.message.includes('fetch') ||
         error.message.includes('network') ||
         error.message.includes('NetworkError'));
      
      const isTimeoutError = 
        error.name === 'AbortError' || 
        error.message.includes('timeout') ||
        error.message.includes('aborted');
      
      const isConnectionError = 
        error.message && (
          error.message.includes('ECONNREFUSED') || 
          error.message.includes('connection refused') ||
          error.message.includes('supabase.co') ||
          error.message.includes('ERR_NETWORK')
        );
      
      // If it's a retryable error and we have retries left, try again
      if ((isNetworkError || isTimeoutError || isConnectionError) && retries > 1) {
        retries--;
        const delay = (4 - retries) * 2000; // Progressive delay: 2s, 4s, 6s
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If we've exhausted retries or it's not a retryable error, throw appropriate error
      if (isNetworkError || isTimeoutError || isConnectionError) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.');
      }
      
      // For other errors, throw as-is
      throw error;
    }
  }
  
  // If we've exhausted all retries, throw the last error with a user-friendly message
  throw new Error('Não foi possível conectar ao servidor após várias tentativas. Verifique sua conexão com a internet e tente novamente.');
};

// Helper function to apply retry logic to query execution
const applyRetryLogic = (queryBuilder: any, table: string) => {
  const originalThen = queryBuilder.then;
  
  // Override the then method to apply retry logic
  queryBuilder.then = function(onFulfilled?: any, onRejected?: any) {
    return handleSupabaseError(
      () => originalThen.call(this, onFulfilled, onRejected),
      `${table} query`
    );
  };

  return queryBuilder;
};

// Add error handling and retry logic to queries
export const createFilteredQuery = (table: string, companyId: number) => {
  const needsCompanyFilter = ['motorista', 'cliente', 'checklist', 'hodometro', 'veiculo'].includes(table);
  
  const addCompanyFilter = (query: any) => {
    return needsCompanyFilter && companyId ? query.eq('company_id', companyId) : query;
  };

  return {
    select: (columns: string = '*') => {
      const query = supabase.from(table).select(columns);
      const filteredQuery = addCompanyFilter(query);
      return applyRetryLogic(filteredQuery, table);
    },
    
    insert: async (data: any) => {
      return handleSupabaseError(async () => {
        const insertData = needsCompanyFilter ? { ...data, company_id: companyId } : data;
        return supabase.from(table).insert(insertData);
      }, `${table} insert`);
    },
    
    update: (data: any) => {
      let query = supabase.from(table).update(data);
      const filteredQuery = addCompanyFilter(query);
      return applyRetryLogic(filteredQuery, table);
    },
    
    delete: () => {
      let query = supabase.from(table).delete();
      const filteredQuery = addCompanyFilter(query);
      return applyRetryLogic(filteredQuery, table);
    }
  };
};

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('motorista').select('count').limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
};