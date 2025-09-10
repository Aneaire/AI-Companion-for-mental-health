import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('Test endpoint hit:', req.method, req.url);
    
    // Test basic functionality
    const response = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'unknown',
        DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set',
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'set' : 'not set',
        GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY ? 'set' : 'not set'
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ 
      error: 'Test endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}