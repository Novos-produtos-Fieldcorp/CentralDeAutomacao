import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configure Supabase directly with the project URL
const supabaseUrl = "https://sngzctgbomqmpdcwjltt.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZ3pjdGdib21xbXBkY3dqbHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1Mjk2NDQsImV4cCI6MjA1MDEwNTY0NH0.xLzxQEGMvJH3FhfR-I0uOOxNI5ktEOINHRQUoDbVLMg";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

console.log("Supabase configured with URL:", supabaseUrl);

// For legacy compatibility (will be removed)
export const db = null;
export const pool = null;