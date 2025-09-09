import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.anihhhqfauctpckwcbfg:WVZedWvtL5eOlwIV@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });