import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "../shared/schema.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get the DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

// Create Neon connection pool
const pool = new Pool({ connectionString });

// Create Drizzle client
export const db = drizzle(pool, { schema });

// Export schema for convenient access
export * from "../shared/schema.js";