import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test database connection without importing heavy dependencies
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = await import('postgres');
    
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'Database configuration missing',
        message: 'DATABASE_URL environment variable not set'
      });
    }
    
    // Create a simple connection test
    const sql = postgres.default(process.env.DATABASE_URL);
    const db = drizzle(sql);
    
    // Simple query test
    const result = await sql`SELECT 1 as test_connection`;
    
    await sql.end();
    
    res.status(200).json({
      status: 'Database connection successful',
      timestamp: new Date().toISOString(),
      result: result[0],
      environment: process.env.NODE_ENV || 'development'
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    
    res.status(500).json({
      error: 'Database connection failed',
      message: error instanceof Error ? error.message : 'Unknown database error',
      timestamp: new Date().toISOString()
    });
  }
}