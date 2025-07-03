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

// Test Supabase connection function
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('company')
      .select('company_id')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    
    // Check for network-related errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return false;
    }
    
    // Check for other connection-related errors
    if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('connection refused') ||
        error.message.includes('network error') ||
        error.message.includes('supabase.co')
    )) {
      return false;
    }
    
    return false;
  }
};

// Helper function to apply retry logic to query execution
const applyRetryLogic = (queryBuilder: any, table: string) => {
  const originalThen = queryBuilder.then;
  const originalSingle = queryBuilder.single;
  const originalLimit = queryBuilder.limit;
  const originalOrder = queryBuilder.order;
  const originalEq = queryBuilder.eq;
  const originalNeq = queryBuilder.neq;
  const originalGt = queryBuilder.gt;
  const originalGte = queryBuilder.gte;
  const originalLt = queryBuilder.lt;
  const originalLte = queryBuilder.lte;
  const originalLike = queryBuilder.like;
  const originalIlike = queryBuilder.ilike;
  const originalIn = queryBuilder.in;
  const originalIs = queryBuilder.is;
  const originalFilter = queryBuilder.filter;
  const originalMatch = queryBuilder.match;
  const originalRange = queryBuilder.range;
  const originalGroup = queryBuilder.group;

  const handleSupabaseError = async (operation: () => Promise<any>) => {
    let retries = 3;
    let lastError: any;
    
    while (retries > 0) {
      try {
        const result = await operation();
        if (result && result.error) throw result.error;
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
          throw new Error(`Erro de conexão com o banco de dados. Verifique se o Supabase está configurado corretamente e se as configurações de CORS estão atualizadas. Para resolver: 1) Vá para o painel do Supabase > Configurações do Projeto > API > CORS 2) Adicione '*.webcontainer-api.io' às URLs permitidas.`);
        }
        
        // If it's a connection refused error, throw a user-friendly error
        if (error.message && (
            error.message.includes('ECONNREFUSED') || 
            error.message.includes('connection refused') ||
            error.message.includes('network error') ||
            error.message.includes('supabase.co')
        )) {
          throw new Error('Erro de conexão com o banco de dados. Verifique se o Supabase está configurado corretamente e se as configurações de CORS estão atualizadas.');
        }
        
        throw error;
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError;
  };

  // Override the then method to apply retry logic
  queryBuilder.then = function(onFulfilled?: any, onRejected?: any) {
    return handleSupabaseError(() => originalThen.call(this, onFulfilled, onRejected));
  };

  // Override other terminal methods that execute the query
  if (originalSingle) {
    queryBuilder.single = function() {
      const result = originalSingle.call(this);
      return applyRetryLogic(result, table);
    };
  }

  // Override chaining methods to maintain chainability with retry logic
  if (originalLimit) {
    queryBuilder.limit = function(count: number, options?: any) {
      const result = originalLimit.call(this, count, options);
      return applyRetryLogic(result, table);
    };
  }

  if (originalOrder) {
    queryBuilder.order = function(column: string, options?: any) {
      const result = originalOrder.call(this, column, options);
      return applyRetryLogic(result, table);
    };
  }

  if (originalEq) {
    queryBuilder.eq = function(column: string, value: any) {
      const result = originalEq.call(this, column, value);
      return applyRetryLogic(result, table);
    };
  }

  if (originalNeq) {
    queryBuilder.neq = function(column: string, value: any) {
      const result = originalNeq.call(this, column, value);
      return applyRetryLogic(result, table);
    };
  }

  if (originalGt) {
    queryBuilder.gt = function(column: string, value: any) {
      const result = originalGt.call(this, column, value);
      return applyRetryLogic(result, table);
    };
  }

  if (originalGte) {
    queryBuilder.gte = function(column: string, value: any) {
      const result = originalGte.call(this, column, value);
      return applyRetryLogic(result, table);
    };
  }

  if (originalLt) {
    queryBuilder.lt = function(column: string, value: any) {
      const result = originalLt.call(this, column, value);
      return applyRetryLogic(result, table);
    };
  }

  if (originalLte) {
    queryBuilder.lte = function(column: string, value: any) {
      const result = originalLte.call(this, column, value);
      return applyRetryLogic(result, table);
    };
  }

  if (originalLike) {
    queryBuilder.like = function(column: string, pattern: string) {
      const result = originalLike.call(this, column, pattern);
      return applyRetryLogic(result, table);
    };
  }

  if (originalIlike) {
    queryBuilder.ilike = function(column: string, pattern: string) {
      const result = originalIlike.call(this, column, pattern);
      return applyRetryLogic(result, table);
    };
  }

  if (originalIn) {
    queryBuilder.in = function(column: string, values: any[]) {
      const result = originalIn.call(this, column, values);
      return applyRetryLogic(result, table);
    };
  }

  if (originalIs) {
    queryBuilder.is = function(column: string, value: any) {
      const result = originalIs.call(this, column, value);
      return applyRetryLogic(result, table);
    };
  }

  if (originalFilter) {
    queryBuilder.filter = function(column: string, operator: string, value: any) {
      const result = originalFilter.call(this, column, operator, value);
      return applyRetryLogic(result, table);
    };
  }

  if (originalMatch) {
    queryBuilder.match = function(query: Record<string, any>) {
      const result = originalMatch.call(this, query);
      return applyRetryLogic(result, table);
    };
  }

  if (originalRange) {
    queryBuilder.range = function(from: number, to: number) {
      const result = originalRange.call(this, from, to);
      return applyRetryLogic(result, table);
    };
  }

  if (originalGroup) {
    queryBuilder.group = function(column: string) {
      const result = originalGroup.call(this, column);
      return applyRetryLogic(result, table);
    };
  }

  return queryBuilder;
};

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
        if (result && result.error) throw result.error;
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
          throw new Error(`Erro de conexão com o banco de dados. Verifique se o Supabase está configurado corretamente e se as configurações de CORS estão atualizadas. Para resolver: 1) Vá para o painel do Supabase > Configurações do Projeto > API > CORS 2) Adicione '*.webcontainer-api.io' às URLs permitidas.`);
        }
        
        // If it's a connection refused error, throw a user-friendly error
        if (error.message && (
            error.message.includes('ECONNREFUSED') || 
            error.message.includes('connection refused') ||
            error.message.includes('network error') ||
            error.message.includes('supabase.co')
        )) {
          throw new Error('Erro de conexão com o banco de dados. Verifique se o Supabase está configurado corretamente e se as configurações de CORS estão atualizadas.');
        }
        
        throw error;
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError;
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
      });
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