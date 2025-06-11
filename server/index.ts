import app from "./app";

Bun.serve({
  fetch: app.fetch,
  port: 4000,
});

console.log("Server is running on port 4000");
