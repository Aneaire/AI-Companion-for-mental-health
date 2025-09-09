import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.anihhhqfauctpckwcbfg:WVZedWvtL5eOlwIV@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

console.log('Database connection string:', connectionString ? 'Set' : 'Not set');

const client = postgres(connectionString, {
  max: 1, // Limit connection pool for serverless
});
export const db = drizzle(client, { schema });