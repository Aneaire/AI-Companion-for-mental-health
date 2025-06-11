import { hc } from "hono/client";
import type { AppType } from "../../../server/app";

// Create a client with the app type
const client = hc<AppType>("http://localhost:4000");

// Export the client and its type
export type Client = typeof client;
export const hcWithType = (...args: Parameters<typeof hc>): Client =>
  hc<AppType>(...args);

export default client;
