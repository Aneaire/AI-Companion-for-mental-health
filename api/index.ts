import { VercelRequest, VercelResponse } from '@vercel/node';

// Simple API handler with no external imports that might cause issues
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🚀 API Request received:', req.method, req.url);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Parse the URL path
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname.replace('/api', '');
    
    console.log('📍 Processing path:', pathname);
    
    // Health check endpoint
    if (pathname === '/health') {
      const healthResponse = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        vercel: true
      };
      
      console.log('✅ Health check successful');
      return res.status(200).json(healthResponse);
    }
    
    // Test endpoint  
    if (pathname === '/test') {
      const testResponse = {
        message: "🎉 Mental Health AI API is working!",
        method: req.method,
        path: pathname,
        timestamp: new Date().toISOString(),
        environment: {
          NODE_ENV: process.env.NODE_ENV || 'not set',
          DATABASE_URL: process.env.DATABASE_URL ? '✅ configured' : '❌ missing',
          CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? '✅ configured' : '❌ missing',
          GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY ? '✅ configured' : '❌ missing',
          VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY ? '✅ configured' : '❌ missing'
        }
      };
      
      console.log('✅ Test endpoint successful');
      return res.status(200).json(testResponse);
    }
    
    // Database test endpoint
    if (pathname === '/db-test') {
      if (!process.env.DATABASE_URL) {
        console.log('❌ Database URL missing');
        return res.status(500).json({
          error: 'Database configuration missing',
          message: 'DATABASE_URL environment variable not set',
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        // Dynamic import to avoid loading issues
        const { default: postgres } = await import('postgres');
        
        const sql = postgres(process.env.DATABASE_URL);
        const result = await sql`SELECT 'Database connected!' as message, NOW() as timestamp`;
        
        await sql.end();
        
        console.log('✅ Database test successful');
        return res.status(200).json({
          status: 'Database connection successful',
          timestamp: new Date().toISOString(),
          result: result[0]
        });
        
      } catch (dbError) {
        console.log('❌ Database test failed:', dbError);
        return res.status(500).json({
          error: 'Database connection failed',
          message: dbError instanceof Error ? dbError.message : 'Unknown database error',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Default response for root or unknown paths
    const defaultResponse = {
      message: "🏥 Mental Health AI Chat API",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      path: pathname,
      method: req.method,
      endpoints: {
        health: "/api/health",
        test: "/api/test", 
        "database-test": "/api/db-test"
      },
      status: "API is running - Ready for beta testing! 🚀"
    };
    
    console.log('✅ Default response sent');
    return res.status(200).json(defaultResponse);
    
  } catch (error) {
    console.error('💥 API Error:', error);
    
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      requestUrl: req.url,
      method: req.method,
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}