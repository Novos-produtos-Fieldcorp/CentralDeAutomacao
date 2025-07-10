/// <reference types="vite/client" />

declare module '@/lib/supabase' {
  import { SupabaseClient } from '@supabase/supabase-js';
  import { Database } from '@/types/database';
  
  export const supabase: SupabaseClient<Database>;
  export function testSupabaseConnection(): Promise<boolean>;
  export function applyRetryLogic(queryBuilder: any, table: string): any;
  export function createFilteredQuery(table: string, companyId: number): any;
}
