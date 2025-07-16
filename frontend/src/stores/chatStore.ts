import type { FormData } from "@/lib/client";
import type { Message } from "@/types/chat";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConversationPreferences {
  briefAndConcise: boolean;
  empatheticAndSupportive: boolean;
  solutionFocused: boolean;
  casualAndFriendly: boolean;
  professionalAndFormal: boolean;
}

export interface Session {
  id: number;
  threadId: number;
  sessionNumber: number;
  sessionName: string | null;
  summary?: string | null;
  status?: "active" | "finished" | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ConversationContext {
  messages: Message[];
  summary?: string;
  lastUpdated: Date;
  sessionId?: number | null;
  threadId?: number | null;
  initialForm?: FormData;
}

interface ChatState {
  currentContext: ConversationContext;
  contexts: Map<string, ConversationContext>;
  // Store sessions per thread
  threadSessions: Map<number, Session[]>;
  loadingState: "idle" | "observer" | "generating" | "streaming";
  conversationPreferences: ConversationPreferences;
  setCurrentContext: (contextId: string) => void;
  addMessage: (message: Message) => void;
  updateContextSummary: (summary: string) => void;
  clearCurrentContext: () => void;
  updateLastMessage: (newText: string) => void;
  setSessionId: (sessionId: number | null) => void;
  setThreadId: (threadId: number | null) => void;
  clearMessages: () => void;
  setInitialForm: (form: FormData) => void;
  getInitialForm: (sessionId: number) => FormData | undefined;
  setThreadSessions: (threadId: number, sessions: Session[]) => void;
  getThreadSessions: (threadId: number) => Session[] | undefined;
  setLoadingState: (
    state: "idle" | "observer" | "generating" | "streaming"
  ) => void;
  setMessages: (messages: Message[]) => void;
  impersonateMaxExchanges: number;
  setImpersonateMaxExchanges: (val: number) => void;
  setConversationPreferences: (preferences: ConversationPreferences) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set: (state: Partial<ChatState>) => void, get: () => ChatState) => ({
      currentContext: {
        messages: [],
        lastUpdated: new Date(),
        sessionId: null,
        threadId: null,
      },
      contexts: new Map(),
      threadSessions: new Map(),
      loadingState: "idle",
      conversationPreferences: {
        briefAndConcise: false,
        empatheticAndSupportive: false,
        solutionFocused: false,
        casualAndFriendly: false,
        professionalAndFormal: false,
      },
      setCurrentContext: (contextId: string) => {
        const { contexts } = get();
        const context = contexts.get(contextId) || {
          messages: [],
          lastUpdated: new Date(),
        };
        set({ currentContext: context });
      },
      addMessage: (message: Message) => {
        const { currentContext } = get();
        const updatedMessages = [...currentContext.messages, message];

        const updatedContext = {
          ...currentContext,
          messages: updatedMessages,
          lastUpdated: new Date(),
        };

        set({
          currentContext: updatedContext,
          contexts: new Map(get().contexts).set(
            message.contextId || "default",
            updatedContext
          ),
        });
      },
      updateContextSummary: (summary: string) => {
        const { currentContext } = get();
        const updatedContext = {
          ...currentContext,
          summary,
          lastUpdated: new Date(),
        };
        set({ currentContext: updatedContext });
      },
      updateLastMessage: (newText: string) => {
        const { currentContext } = get();
        const messages = [...currentContext.messages];
        if (messages.length > 0) {
          const lastMessageIndex = messages.length - 1;
          const cleanedText = newText.replace(/\s+'/g, "'");
          messages[lastMessageIndex] = {
            ...messages[lastMessageIndex],
            text: cleanedText,
          };
        }
        set({
          currentContext: { ...currentContext, messages },
        });
      },
      clearCurrentContext: () => {
        set({
          currentContext: {
            messages: [],
            lastUpdated: new Date(),
            sessionId: null,
            threadId: null,
          },
        });
      },
      setSessionId: (sessionId: number | null) => {
        const { currentContext } = get();
        set({
          currentContext: { ...currentContext, sessionId },
        });
      },
      setThreadId: (threadId: number | null) => {
        const { currentContext } = get();
        set({
          currentContext: { ...currentContext, threadId },
        });
      },
      clearMessages: () => {
        const { currentContext } = get();
        set({
          currentContext: { ...currentContext, messages: [] },
        });
      },
      setInitialForm: (form: FormData) => {
        const { currentContext } = get();
        // Debug log for setting initial form
        console.log("[DEBUG] setInitialForm called", { form });
        set({
          currentContext: { ...currentContext, initialForm: form },
        });
      },
      getInitialForm: (_sessionId: number) => {
        const { currentContext } = get();
        // Debug log for getting initial form
        console.log("[DEBUG] getInitialForm called", {
          sessionId: _sessionId,
          result: currentContext.initialForm,
        });
        return currentContext.initialForm;
      },
      setThreadSessions: (threadId: number, sessions: Session[]) => {
        const { threadSessions } = get();
        const updatedSessions = new Map(threadSessions);
        updatedSessions.set(threadId, sessions);
        set({ threadSessions: updatedSessions });
      },
      getThreadSessions: (threadId: number) => {
        const { threadSessions } = get();
        return threadSessions.get(threadId);
      },
      setLoadingState: (
        state: "idle" | "observer" | "generating" | "streaming"
      ) => {
        set({ loadingState: state });
      },
      setMessages: (messages: Message[]) => {
        const { currentContext } = get();
        set({
          currentContext: { ...currentContext, messages },
        });
      },
      impersonateMaxExchanges: 10,
      setImpersonateMaxExchanges: (val: number) =>
        set({ impersonateMaxExchanges: val }),
      setConversationPreferences: (preferences: ConversationPreferences) =>
        set({ conversationPreferences: preferences }),
    }),
    {
      name: "chat-storage",
      storage: {
        getItem: async (name) => {
          const item = localStorage.getItem(name);
          if (!item) return null;
          const parsed = JSON.parse(item);
          // Manually deserialize Map and Date objects
          if (parsed.state && parsed.state.contexts) {
            parsed.state.contexts = new Map(parsed.state.contexts);
          }
          if (parsed.state && parsed.state.threadSessions) {
            parsed.state.threadSessions = new Map(parsed.state.threadSessions);
          }
          if (
            parsed.state &&
            parsed.state.currentContext &&
            parsed.state.currentContext.messages
          ) {
            parsed.state.currentContext.messages =
              parsed.state.currentContext.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
              }));
          }
          return parsed;
        },
        setItem: (name, value) => {
          // Manually serialize Map to array for storage
          const serializedValue = JSON.stringify({
            ...value,
            state: {
              ...value.state,
              currentContext: {
                sessionId: value.state.currentContext.sessionId,
                threadId: value.state.currentContext.threadId,
                initialForm: value.state.currentContext.initialForm,
              },
              threadSessions: Array.from(value.state.threadSessions.entries()),
            },
          });
          localStorage.setItem(name, serializedValue);
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state: ChatState) => ({
        // Only persist minimal data, not messages or contexts
        currentContext: {
          sessionId: state.currentContext.sessionId,
          threadId: state.currentContext.threadId,
          initialForm: state.currentContext.initialForm,
        },
        threadSessions: Array.from(state.threadSessions.entries()),
        impersonateMaxExchanges: state.impersonateMaxExchanges,
        conversationPreferences: state.conversationPreferences,
      }),
      merge: (persistedState: any, currentState: ChatState) => {
        // Only merge the minimal persisted state
        return {
          ...currentState,
          currentContext: {
            ...currentState.currentContext,
            sessionId: persistedState.currentContext?.sessionId ?? null,
            threadId: persistedState.currentContext?.threadId ?? null,
            initialForm: persistedState.currentContext?.initialForm,
          },
          threadSessions: new Map(persistedState.threadSessions || []),
          impersonateMaxExchanges: persistedState.impersonateMaxExchanges ?? 10,
          conversationPreferences: persistedState.conversationPreferences ?? {
            briefAndConcise: false,
            empatheticAndSupportive: false,
            solutionFocused: false,
            casualAndFriendly: false,
            professionalAndFormal: false,
          },
        };
      },
    }
  )
);
