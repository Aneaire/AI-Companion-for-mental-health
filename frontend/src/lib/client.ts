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
  async list(userId: number, threadType: "chat" = "chat") {
    const res = await client.api.threads.$get({
      query: { userId: userId.toString(), threadType },
    });
    if (!res.ok) throw new Error("Failed to fetch threads");
    return res.json();
  },
  async create(data: {
    userId: number;
    personaId: number;
    preferredName?: string;
    currentEmotions?: string[];
    reasonForVisit: string;
    supportType?: string[];
    supportTypeOther?: string;
    additionalContext?: string;
    responseTone?: string;
    imageResponse?: string;
    threadType?: "chat";
  }) {
    const res = await client.api.threads.$post({
      json: data,
    });
    if (!res.ok) throw new Error("Failed to create thread");
    return res.json();
  },
};

export const patientApi = {
  async sendMessage({
    message,
    context,
  }: {
    message: string;
    context?: any[];
  }) {
    const res = await client.api.patient.$post({
      json: { message, context },
    });
    if (!res.ok) throw new Error("Failed to get patient AI response");
    return res.json();
  },
};

// Add observer API client
export const observerApi = {
  async getSuggestion({
    messages,
    initialForm,
  }: {
    messages: { text: string; sender: "user" | "ai" }[];
    initialForm?: import("./client").FormData;
  }) {
    const res = await client.api.observer.$post({
      json: { messages, ...(initialForm ? { initialForm } : {}) },
    });
    if (!res.ok) throw new Error("Failed to get observer suggestion");
    return res.json();
  },
};

// Add quality API client
export const qualityApi = {
  async analyzeQuality({
    messages,
    initialForm,
  }: {
    messages: { text: string; sender: "user" | "ai"; timestamp: number }[];
    initialForm?: import("./client").FormData;
  }) {
    const res = await client.api.quality.$post({
      json: { messages, ...(initialForm ? { initialForm } : {}) },
    });
    if (!res.ok) throw new Error("Failed to analyze message quality");
    return res.json();
  },
};

export const impostorApi = {
  async getProfile(userId: number) {
    const res = await client.api.impostor.profile.$get({
      query: { userId: userId.toString() },
    });
    if (!res.ok) {
      const errorData = await res.json();
      console.error("Impostor profile upsert error:", errorData);
      throw new Error("Failed to upsert impostor profile");
    }
    return res.json();
  },
  async upsertProfile(data: {
    userId: number;
    fullName: string;
    age: string;
    problemDescription: string;
    background?: string;
    personality?: string;
  }) {
    console.log("[impostorApi.upsertProfile] Sending data:", data);
    const res = await client.api.impostor.profile.$post({
      json: data,
    });
    if (!res.ok) {
      const errorData = await res.json();
      console.error("Impostor profile upsert error:", errorData);
      throw new Error("Failed to upsert impostor profile");
    }
    return res.json();
  },
  async sendMessage({
    sessionId,
    message,
    userProfile,
    signal,
  }: {
    sessionId: number;
    message: string;
    userProfile: any;
    signal?: AbortSignal;
  }) {
    const res = await client.api.impostor.chat.$post({
      json: { sessionId, message, userProfile },
      ...(signal ? { fetch: { signal } } : {}),
    });
    if (!res.ok) throw new Error("Failed to send impostor message");
    return res; // Return the Response object for streaming
  },
};

export type FormData = {
  preferredName?: string;
  currentEmotions?: string[];
  reasonForVisit: string;
  supportType?: (
    | "listen"
    | "copingTips"
    | "encouragement"
    | "resources"
    | "other"
  )[];
  supportTypeOther?: string;
  additionalContext?: string;
  responseTone?: "empathetic" | "practical" | "encouraging" | "concise";
  imageResponse?: string;
  responseCharacter?: string;
  responseDescription?: string;
};

// Add chat API client with sender support
export const chatApi = {
  async sendMessage({
    message,
    sessionId,
    userId,
    context,
    sender,
    initialForm,
    signal,
    ...rest
  }: {
    message: string;
    sessionId: number;
    userId: string;
    context?: any[];
    sender?: "user" | "ai" | "therapist" | "impostor";
    initialForm?: any;
    signal?: AbortSignal;
    [key: string]: any;
  }) {
    const res = await client.api.chat.$post({
      json: {
        message,
        sessionId,
        userId,
        ...(context ? { context } : {}),
        ...(sender ? { sender } : {}),
        ...(initialForm ? { initialForm } : {}),
        ...rest,
      },
      ...(signal ? { fetch: { signal } } : {}),
    });
    if (!res.ok) throw new Error("Failed to send chat message");
    return res;
  },
};
