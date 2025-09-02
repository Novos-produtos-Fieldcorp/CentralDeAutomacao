import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import dotenv from "dotenv";
import * as schema from "@shared/schema";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Configure neon for edge runtime compatibility
neonConfig.fetchConnectionCache = true;

// Create connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create drizzle instance
export const db = drizzle(pool, { schema });

// Export pool for cleanup if needed
export { pool };