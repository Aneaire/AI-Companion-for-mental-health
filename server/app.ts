import { Hono } from "hono";
import { cors } from "hono/cors";
import chat from "./routes/chat";
import expense from "./routes/expense";
import user from "./routes/user";

const app = new Hono();

// Middleware
app.use("*", cors());

// Routes
const routes = app
  .route("/api/chat", chat)
  .route("/api/user", user)
  .route("/api/expense", expense);

export default app;
export type AppType = typeof routes;
