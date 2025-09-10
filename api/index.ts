import { VercelRequest, VercelResponse } from '@vercel/node';

// Import Hono app directly and handle routing
import { Hono } from "hono";
import { cors } from "hono/cors";
import chat from '../server/routes/chat';
import generateFormRoute from '../server/routes/generate-form';
import impostorRoute from '../server/routes/impostor';
import observer from '../server/routes/observer';
import mainObserver from '../server/routes/mainObserver';
import impersonateObserver from '../server/routes/impersonateObserver';
import patientRoute from '../server/routes/patient';
import progressRoute from '../server/routes/progress';
import quality from '../server/routes/quality';
import threadsRoute from '../server/routes/threads';
import user from '../server/routes/user';
import adminRoute from '../server/routes/admin';
import testRoute from '../server/routes/test';

// Create app instance for Vercel
const app = new Hono();

// Middleware
app.use("*", cors({
  origin: (origin) => {
    // Allow localhost for development
    if (origin?.includes('localhost')) return origin;
    // Allow Vercel domains
    if (origin?.includes('vercel.app')) return origin;
    // Allow any origin in production (you can be more restrictive)
    return origin || '*';
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-admin-token"],
  exposeHeaders: ["Content-Length", "X-Total-Count"],
  maxAge: 86400,
}));

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || "unknown"
  });
});

// Routes - Keep /api prefix to match the original server app
const routes = app
  .route("/api/chat", chat)
  .route("/api/user", user)
  .route("/api/threads", threadsRoute)
  .route("/api/patient", patientRoute)
  .route("/api/progress", progressRoute)
  .route("/api/observer", observer)
  .route("/api/main-observer", mainObserver)
  .route("/api/impersonate-observer", impersonateObserver)
  .route("/api/quality", quality)
  .route("/api/impostor", impostorRoute)
  .route("/api/generate-form", generateFormRoute)
  .route("/api/admin", adminRoute)
  .route("/api/test", testRoute);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('API Handler - Method:', req.method);
    console.log('API Handler - URL:', req.url);
    
    // Create a proper URL for the request
    const url = `https://${req.headers.host || 'localhost'}${req.url || '/'}`;
    
    // Create headers object
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    // Handle request body
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }

    // Create the request
    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    console.log('API Handler - Processing with Hono app');
    // Process with Hono app
    const response = await app.fetch(request);
    
    console.log('API Handler - Response status:', response.status);
    
    // Handle the response
    const responseBody = await response.text();
    
    // Set response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status).send(responseBody);
    
  } catch (error) {
    console.error('API handler error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      url: req.url,
      method: req.method
    });
  }
}