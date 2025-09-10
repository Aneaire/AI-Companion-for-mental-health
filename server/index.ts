import app from "./app";

const port = process.env.PORT || 3001;

Bun.serve({
  fetch: app.fetch,
  port: port,
});

console.log(`Server is running on port ${port}`);
