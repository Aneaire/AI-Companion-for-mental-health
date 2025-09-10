import { Hono } from "hono";

const test = new Hono();

test.get("/", (c) => {
  return c.text("testing api route");
});

export default test;