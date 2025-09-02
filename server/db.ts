import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import * as schema from "@shared/schema";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Create HTTP connection instead of WebSocket for better compatibility
const sql = neon(process.env.DATABASE_URL);

// Create drizzle instance
export const db = drizzle(sql, { schema });

// Also export the raw SQL function for direct queries if needed
export { sql };