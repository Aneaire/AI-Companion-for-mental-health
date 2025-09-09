import { hc } from "hono/client";
import type { AppType } from "../../../server/app";
import { API_BASE_URL, apiFetch } from "./config";

// Create a client with the app type
// In development: /api (proxied to localhost:4000)
// In production: /api (handled by Vercel serverless functions)
const client = hc<AppType>(API_BASE_URL === '/api' ? '' : API_BASE_URL);

// Export the client and its type
export type Client = typeof client;
export const hcWithType = (...args: Parameters<typeof hc>): Client =>
  hc<AppType>(...args);

export default client;

export const threadsApi = {
  async list(
    userId: number,
    limit: number = 20,
    offset: number = 0,
    threadType: "chat" = "chat"
  ) {
    const res = await client.api.threads.$get({
      query: {
        userId: userId.toString(),
        limit: limit.toString(),
        offset: offset.toString(),
      },
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
  async get(threadId: number) {
    const res = await client.api.threads[":threadId"].$get({
      param: { threadId: threadId.toString() },
    });
    if (!res.ok) throw new Error("Failed to fetch thread");
    return res.json();
  },
  async getSessions(threadId: number) {
    const res = await client.api.threads[":threadId"].sessions.$get({
      param: { threadId: threadId.toString() },
    });
    if (!res.ok) throw new Error("Failed to fetch thread sessions");
    return res.json();
  },
  async createSession(threadId: number, data: { sessionName?: string }) {
    const res = await apiFetch(`threads/${threadId}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create session");
    return res.json();
  },
  async checkSession(threadId: number) {
    const res = await fetch(
      `threads/${threadId}/check-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) throw new Error("Failed to check session status");
    return res.json();
  },
  async saveSessionForm(sessionId: number, answers: Record<string, any>) {
    const res = await fetch(
      `threads/sessions/${sessionId}/form`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }
    );
    if (!res.ok) throw new Error("Failed to save session form");
    return res.json();
  },
  async getSessionForm(sessionId: number) {
    const res = await fetch(
      `threads/sessions/${sessionId}/form`
    );
    if (!res.ok) throw new Error("Failed to get session form");
    return res.json();
  },
  async createNextSession(threadId: number) {
    const res = await fetch(
      `threads/${threadId}/create-next-session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );
    if (!res.ok) throw new Error("Failed to create next session");
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

// Add observer API client (original - for backward compatibility)
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

// Add main observer API client (for main chat/therapy sessions)
export const mainObserverApi = {
  async getSuggestion({
    messages,
    initialForm,
    followupForm,
  }: {
    messages: { text: string; sender: "user" | "ai" }[];
    initialForm?: import("./client").FormData;
    followupForm?: Record<string, any>;
  }) {
    const res = await client.api["main-observer"].$post({
      json: { 
        messages, 
        ...(initialForm ? { initialForm } : {}),
        ...(followupForm ? { followupForm } : {})
      },
    });
    if (!res.ok) throw new Error("Failed to get main observer suggestion");
    return res.json();
  },
};

// Add impersonate observer API client (for impersonate/roleplay sessions)
export const impersonateObserverApi = {
  async getSuggestion({
    messages,
    initialForm,
  }: {
    messages: { text: string; sender: "user" | "ai" }[];
    initialForm?: import("./client").FormData;
  }) {
    const res = await client.api["impersonate-observer"].$post({
      json: { messages, ...(initialForm ? { initialForm } : {}) },
    });
    if (!res.ok) throw new Error("Failed to get impersonate observer suggestion");
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
  async listThreads(userId: number) {
    const res = await client.api.impostor.threads.$get({
      query: { userId: userId.toString() },
    });
    if (!res.ok) throw new Error("Failed to fetch impersonate threads");
    return res.json();
  },
  async createThread(data: {
    userId: number;
    personaId?: number;
    sessionName?: string;
    preferredName?: string;
    reasonForVisit: string;
  }) {
    const res = await client.api.impostor.threads.$post({
      json: data,
    });
    if (!res.ok) throw new Error("Failed to create impersonate thread");
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
  async getMessages(
    sessionId: number,
    threadType: "impersonate" = "impersonate"
  ) {
    const res = await fetch(
      `impostor/messages?sessionId=${sessionId}&threadType=${threadType}`
    );
    if (!res.ok) throw new Error("Failed to fetch impersonate messages");
    return res.json();
  },
  async postMessage(data: {
    sessionId: number;
    threadType: "impersonate";
    sender: "user" | "ai" | "therapist" | "impostor";
    text: string;
  }) {
    const res = await apiFetch(`impostor/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to post impersonate message");
    return res.json();
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
        context,
        sender,
        initialForm,
        ...rest,
      },
      ...(signal ? { fetch: { signal } } : {}),
    });
    if (!res.ok) throw new Error("Failed to send message");
    return res;
  },
};

// New chat API for impersonate threads
export const impersonateChatApi = {
  async sendMessage({
    message,
    threadId,
    userId,
    context,
    sender,
    initialForm,
    signal,
    ...rest
  }: {
    message: string;
    threadId: number;
    userId: string;
    context?: any[];
    sender?: "user" | "ai" | "therapist" | "impostor";
    initialForm?: any;
    signal?: AbortSignal;
    [key: string]: any;
  }) {
    const res = await client.api.chat.impersonate.$post({
      json: {
        message,
        threadId,
        userId,
        context,
        sender,
        initialForm,
        ...rest,
      },
      ...(signal ? { fetch: { signal } } : {}),
    });
    if (!res.ok) throw new Error("Failed to send impersonate message");
    return res;
  },
  async getMessages(threadId: number) {
    const res = await client.api.chat.impersonate[":threadId"].$get({
      param: { threadId: threadId.toString() },
    });
    if (!res.ok) throw new Error("Failed to fetch impersonate messages");
    return res.json();
  },
  async testConversationHistory({
    message,
    threadId,
    userId,
    context,
    ...rest
  }: {
    message: string;
    threadId: number;
    userId: string;
    context?: any[];
    [key: string]: any;
  }) {
    const res = await client.api.chat.impersonate.test.$post({
      json: {
        message,
        threadId,
        userId,
        context,
        ...rest,
      },
    });
    if (!res.ok) throw new Error("Failed to test conversation history");
    return res.json();
  },
};

export const generateFormApi = {
  async generate({
    initialForm,
    messages,
  }: {
    initialForm: any;
    messages: { sender: string; text: string }[];
  }) {
    const res = await client.api["generate-form"].$post({
      json: { initialForm, messages },
    });
    if (!res.ok) throw new Error("Failed to generate form");
    return res.json();
  },
};




