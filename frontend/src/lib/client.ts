import { hc } from "hono/client";
import type { AppType } from "../../../server/app";

// Create a client with the app type
const client = hc<AppType>("http://localhost:4000");

// Export the client and its type
export type Client = typeof client;
export const hcWithType = (...args: Parameters<typeof hc>): Client =>
  hc<AppType>(...args);

export default client;

export const threadsApi = {
  async list(userId: number) {
    const res = await client.api.threads.$get({
      query: { userId: userId.toString() },
    });
    if (!res.ok) throw new Error("Failed to fetch threads");
    return res.json();
  },
  async create(data: {
    sessionName?: string;
    preferredName?: string;
    reasonForVisit?: string;
  }) {
    const res = await client.api.threads.$post({
      json: data,
    });
    if (!res.ok) throw new Error("Failed to create thread");
    return res.json();
  },
};
