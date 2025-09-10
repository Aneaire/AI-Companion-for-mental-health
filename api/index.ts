import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('API Request:', req.method, req.url);
    
    // Handle different routes
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    console.log('Pathname:', pathname);
    
    // Health check endpoint
    if (pathname === '/api/health') {
      const response = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || "unknown",
        environment: process.env.NODE_ENV || "development"
      };
      
      return res.status(200).json(response);
    }
    
    // Test endpoint
    if (pathname === '/api/test') {
      const response = {
        message: "API is working",
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString(),
        environment: {
          NODE_ENV: process.env.NODE_ENV || 'not set',
          DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'missing',
          CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'configured' : 'missing',
          GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY ? 'configured' : 'missing'
        }
      };
      
      return res.status(200).json(response);
    }
    
    // Default response for other routes
    res.status(200).json({
      message: "Mental Health AI API",
      timestamp: new Date().toISOString(),
      path: pathname,
      method: req.method,
      note: "Full API functionality coming soon"
    });
    
  } catch (error) {
    console.error('API Error:', error);
    
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      requestUrl: req.url,
      method: req.method
    });
  }
}