import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Use DATABASE_URL if available, otherwise construct from Supabase credentials
let databaseUrl: string;

if (process.env.DATABASE_URL) {
  databaseUrl = process.env.DATABASE_URL;
} else if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // Extract database URL from Supabase URL
  const supabaseUrl = process.env.SUPABASE_URL;
  const projectRef = supabaseUrl.split('//')[1].split('.')[0];
  databaseUrl = `postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`;
} else {
  throw new Error(
    "DATABASE_URL must be set, or provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  );
}

const connection = postgres(databaseUrl, { 
  prepare: false,
  max: 10,
});

export const db = drizzle(connection, { schema });

// Also export Supabase client for edge functions
export const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);
