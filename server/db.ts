import { createClient } from '@supabase/supabase-js';
import * as schema from "@shared/schema";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase configuration from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in environment variables",
  );
}

// Create Supabase client 
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  }
});

// For backward compatibility with Drizzle code, we'll use Supabase directly
export const db = supabase;
