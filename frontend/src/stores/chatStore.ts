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

interface ConversationContext {
  messages: Message[];
  summary?: string;
  lastUpdated: Date;
  sessionId?: number | null;
  initialForm?: FormData;
}

interface ChatState {
  currentContext: ConversationContext;
  contexts: Map<string, ConversationContext>;
  // Store initial forms per session ID
  sessionInitialForms: Map<number, FormData>;
  loadingState: "idle" | "observer" | "generating" | "streaming";
  conversationPreferences: ConversationPreferences;
  setCurrentContext: (contextId: string) => void;
  addMessage: (message: Message) => void;
  updateContextSummary: (summary: string) => void;
  clearCurrentContext: () => void;
  updateLastMessage: (newText: string) => void;
  setSessionId: (sessionId: number | null) => void;
  clearMessages: () => void;
  setInitialForm: (form: FormData, sessionId?: number) => void;
  getInitialForm: (sessionId: number) => FormData | undefined;
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
      },
      contexts: new Map(),
      sessionInitialForms: new Map(),
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
      setInitialForm: (form: FormData, sessionId?: number) => {
        const { currentContext, sessionInitialForms } = get();
        const targetSessionId = sessionId || currentContext.sessionId;

        if (targetSessionId) {
          // Store form per session
          const updatedForms = new Map(sessionInitialForms);
          updatedForms.set(targetSessionId, form);

          set({
            sessionInitialForms: updatedForms,
            // Also update current context if this is the current session
            currentContext:
              targetSessionId === currentContext.sessionId
                ? { ...currentContext, initialForm: form }
                : currentContext,
          });
        } else {
          // Fallback to current context (for backward compatibility)
          set({
            currentContext: { ...currentContext, initialForm: form },
          });
        }
      },
      getInitialForm: (sessionId: number) => {
        const { sessionInitialForms, currentContext } = get();
        return (
          sessionInitialForms.get(sessionId) ||
          (currentContext.sessionId === sessionId
            ? currentContext.initialForm
            : undefined)
        );
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
          if (parsed.state && parsed.state.sessionInitialForms) {
            parsed.state.sessionInitialForms = new Map(
              parsed.state.sessionInitialForms
            );
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
                initialForm: value.state.currentContext.initialForm,
              },
              sessionInitialForms: Array.from(
                value.state.sessionInitialForms.entries()
              ),
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
          initialForm: state.currentContext.initialForm,
        },
        sessionInitialForms: Array.from(state.sessionInitialForms.entries()),
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
            initialForm: persistedState.currentContext?.initialForm,
          },
          sessionInitialForms: new Map(
            persistedState.sessionInitialForms || []
          ),
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
