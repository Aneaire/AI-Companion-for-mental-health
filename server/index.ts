import app from "./app";
import { logger } from "./lib/logger";

const port = process.env.PORT || 4000;

Bun.serve({
  fetch: app.fetch,
  port: port,
});

logger.log(`Server is running on port ${port}`);
