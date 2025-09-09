import { Hono } from "hono";
import { cors } from "hono/cors";
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

// Routes
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
  .route("/api/admin", adminRoute);

export default app;
export type AppType = typeof routes;