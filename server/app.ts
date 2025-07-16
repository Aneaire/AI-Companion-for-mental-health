import { Hono } from "hono";
import { cors } from "hono/cors";
import chat from "./routes/chat";
import generateFormRoute from "./routes/generate-form";
import impostorRoute from "./routes/impostor";
import observer from "./routes/observer";
import patientRoute from "./routes/patient";
import progressRoute from "./routes/progress";
import quality from "./routes/quality";
import threadsRoute from "./routes/threads";
import user from "./routes/user";

const app = new Hono();

// Middleware
app.use("*", cors());

// Routes
const routes = app
  .route("/api/chat", chat)
  .route("/api/user", user)
  .route("/api/threads", threadsRoute)
  .route("/api/patient", patientRoute)
  .route("/api/progress", progressRoute)
  .route("/api/observer", observer)
  .route("/api/quality", quality)
  .route("/api/impostor", impostorRoute)
  .route("/api/generate-form", generateFormRoute);

export default app;
export type AppType = typeof routes;
