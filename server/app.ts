import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import impersonateChat from "./routes/impersonate-chat";
import generateFormRoute from "./routes/generate-form";
import impostorRoute from "./routes/impostor";
import impersonateObserver from "./routes/impersonateObserver";
import personaCards from "./routes/persona-cards";
import patientRoute from "./routes/patient";
import progressRoute from "./routes/progress";
import quality from "./routes/quality";
import enhanceBackground from "./routes/enhance-background";
import threadsRoute from "./routes/threads";
import user from "./routes/user";
import { adminRoute, observerRoute, superadminRoute } from "./routes/admin";
import counselorRoute from "./routes/counselor";
import testRoute from "./routes/test";
import personaTemplatesRoute from "./routes/persona-templates";
import personaLibraryRoute from "./routes/persona-library";
import personasRoute from "./routes/personas";
import roleManagementRoute from "./routes/role-management";


const app = new Hono();

// Middleware
app.use("*", cors({
  origin: (origin) => {
    // Allow localhost for development
    if (origin?.includes('localhost')) return origin;
    // Allow Render domains
    if (origin?.includes('onrender.com')) return origin;
    // Allow any origin in production (you can be more restrictive)
    return origin || '*';
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-admin-token"],
  exposeHeaders: ["Content-Length", "X-Total-Count"],
  maxAge: 86400,
}));

// API Routes
const routes = app
  .route("/api/impersonate-chat", impersonateChat)
  .route("/api/user", user)
  .route("/api/threads", threadsRoute)
  .route("/api/patient", patientRoute)
  .route("/api/progress", progressRoute)
  .route("/api/impersonate-observer", impersonateObserver) // New impersonate observer
  .route("/api/persona-cards", personaCards) // New persona-based chat API
  .route("/api/quality", quality)
  .route("/api/enhance-background", enhanceBackground)
  .route("/api/impostor", impostorRoute)
  .route("/api/persona-templates", personaTemplatesRoute)
  .route("/api/persona-library", personaLibraryRoute)
  .route("/api/generate-form", generateFormRoute)
  .route("/api/admin", adminRoute)
  .route("/api/observer", observerRoute)
  .route("/api/superadmin", superadminRoute)
  .route("/api/admin/personas", personasRoute)
  .route("/api/role-management", roleManagementRoute)
  .route("/api/counselor", counselorRoute)
  .route("/api/test", testRoute)


// Serve static files from frontend build
app.use('/assets/*', serveStatic({ root: './frontend/dist' }));
app.use('/images/*', serveStatic({ root: './frontend/dist' }));
app.use('/favicon.ico', serveStatic({ path: './frontend/dist/favicon.ico' }));
app.use('/logo2.png', serveStatic({ path: './frontend/dist/logo2.png' }));
app.use('/manifest.json', serveStatic({ path: './frontend/dist/manifest.json' }));
app.use('/robots.txt', serveStatic({ path: './frontend/dist/robots.txt' }));



// Health check endpoint with comprehensive checks
app.get('/api/health', async (c) => {
  const startTime = Date.now();
  const checks = {
    database: false,
    environment: false,
    memory: false,
    apis: false,
  };

  const errors: string[] = [];

  try {
    // 1. Database connectivity check
    try {
      const { db } = await import('./db/config');
      await db.execute('SELECT 1');
      checks.database = true;
    } catch (error: any) {
      errors.push(`Database check failed: ${error?.message || 'Unknown error'}`);
    }

    // 2. Environment variables check
    const requiredEnvVars = [
      'DATABASE_URL',
      'GEMINI_API_KEY',
      'ANTHROPIC_KEY',
      'CLERK_SECRET_KEY'
    ];

    const optionalEnvVars = [
      'ELEVENLABS_API_KEY',
      'VITE_CLERK_PUBLISHABLE_KEY'
    ];

    const missingRequired = requiredEnvVars.filter(key => !process.env[key]);
    const missingOptional = optionalEnvVars.filter(key => !process.env[key]);

    if (missingRequired.length > 0) {
      errors.push(`Missing required environment variables: ${missingRequired.join(', ')}`);
    } else {
      checks.environment = true;
    }

    if (missingOptional.length > 0) {
      errors.push(`Missing optional environment variables: ${missingOptional.join(', ')}`);
    }

    // 3. Memory usage check
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };

    // Check if memory usage is reasonable (< 500MB heap used)
    if (memUsageMB.heapUsed < 500) {
      checks.memory = true;
    } else {
      errors.push(`High memory usage: ${memUsageMB.heapUsed}MB heap used`);
    }

    // 4. External API connectivity check (basic ping)
    const apiChecks = [];

    // Check Gemini API (if key is available)
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] }),
          signal: AbortSignal.timeout(5000)
        });
        if (geminiResponse.ok || geminiResponse.status === 400) { // 400 is expected for invalid request
          apiChecks.push('gemini');
        }
      } catch (error: any) {
        errors.push(`Gemini API check failed: ${error?.message || 'Unknown error'}`);
      }
    }



    // Check ElevenLabs API (if key is available)
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const elevenlabsResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY
          },
          signal: AbortSignal.timeout(5000)
        });
        if (elevenlabsResponse.ok) {
          apiChecks.push('elevenlabs');
        }
      } catch (error: any) {
        errors.push(`ElevenLabs API check failed: ${error?.message || 'Unknown error'}`);
      }
    }

    checks.apis = apiChecks.length > 0;

    const responseTime = Date.now() - startTime;
    const overallStatus = errors.length === 0 ? 'healthy' : 'degraded';

    return c.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'mental-health-ai-chat',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      checks,
      memory: memUsageMB,
      apis: {
        available: apiChecks,
        total: apiChecks.length
      },
      ...(errors.length > 0 && { errors })
    });

  } catch (error: any) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'mental-health-ai-chat',
      error: error?.message || 'Unknown error',
      responseTime: `${Date.now() - startTime}ms`
    }, 503);
  }
});

// Serve index.html for all non-API routes (SPA routing)
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));

export default app;
export type AppType = typeof routes;