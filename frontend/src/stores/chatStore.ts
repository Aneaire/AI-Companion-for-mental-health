import type { ConversationContext, Message } from "@/types/chat";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatState {
  currentContext: ConversationContext;
  contexts: Map<string, ConversationContext>;
  setCurrentContext: (contextId: string) => void;
  addMessage: (message: Message) => void;
  updateContextSummary: (summary: string) => void;
  clearCurrentContext: () => void;
  updateLastMessage: (newText: string) => void;
  setSessionId: (sessionId: number | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set: (state: Partial<ChatState>) => void, get: () => ChatState) => ({
      currentContext: {
        messages: [],
        lastUpdated: new Date(),
        sessionId: null,
      },
      contexts: new Map(),
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
          messages[lastMessageIndex] = {
            ...messages[lastMessageIndex],
            text: newText,
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
          },
        });
      },
      setSessionId: (sessionId: number | null) => {
        const { currentContext } = get();
        set({
          currentContext: { ...currentContext, sessionId },
        });
      },
      clearMessages: () => {
        const { currentContext } = get();
        set({
          currentContext: { ...currentContext, messages: [] },
        });
      },
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
              contexts: Array.from(value.state.contexts.entries()),
              currentContext: {
                ...value.state.currentContext,
                messages: value.state.currentContext.messages.map(
                  (msg: any) => ({
                    ...msg,
                    timestamp:
                      msg.timestamp instanceof Date
                        ? msg.timestamp.getTime()
                        : msg.timestamp,
                  })
                ),
              },
            },
          });
          localStorage.setItem(name, serializedValue);
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state: ChatState) => ({
        contexts: Array.from(state.contexts.entries()),
        currentContext: {
          ...state.currentContext,
          messages: state.currentContext.messages.map((msg) => ({
            ...msg,
            timestamp:
              msg.timestamp instanceof Date
                ? msg.timestamp.getTime()
                : msg.timestamp,
          })),
        },
      }),
      merge: (persistedState: any, currentState: ChatState) => {
        const newContexts = new Map(persistedState.contexts);
        return {
          ...currentState,
          contexts: newContexts as Map<string, ConversationContext>,
          currentContext: {
            ...persistedState.currentContext,
            messages: persistedState.currentContext.messages.map(
              (msg: any) => ({ ...msg, timestamp: new Date(msg.timestamp) })
            ),
          },
        };
      },
    }
  )
);
