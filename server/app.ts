import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import chat from "./routes/chat";
import generateFormRoute from "./routes/generate-form";
import impostorRoute from "./routes/impostor";
import observer from "./routes/observer";
import mainObserver from "./routes/mainObserver";
import impersonateObserver from "./routes/impersonateObserver";
import patientRoute from "./routes/patient";
import progressRoute from "./routes/progress";
import quality from "./routes/quality";
import threadsRoute from "./routes/threads";
import user from "./routes/user";
import adminRoute from "./routes/admin";
import testRoute from "./routes/test";

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
  .route("/api/chat", chat)
  .route("/api/user", user)
  .route("/api/threads", threadsRoute)
  .route("/api/patient", patientRoute)
  .route("/api/progress", progressRoute)
  .route("/api/observer", observer) // Keep original for backward compatibility
  .route("/api/main-observer", mainObserver) // New main chat observer
  .route("/api/impersonate-observer", impersonateObserver) // New impersonate observer
  .route("/api/quality", quality)
  .route("/api/impostor", impostorRoute)
  .route("/api/generate-form", generateFormRoute)
  .route("/api/admin", adminRoute)
  .route("/api/test", testRoute);

// Serve static files from frontend build
app.use('/*', serveStatic({ 
  root: './frontend/dist',
  onNotFound: (path, c) => {
    // If static file not found, continue to next middleware (for SPA routing)
    return undefined;
  }
}));

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'mental-health-ai-chat'
  });
});

// Serve index.html for all non-API routes (SPA routing)
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));

export default app;
export type AppType = typeof routes;