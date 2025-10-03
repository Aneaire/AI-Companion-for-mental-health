import type { FormData } from "@/lib/client";
import type { Message } from "@/types/chat";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConversationPreferences {
  briefAndConcise: number; // 0-100 slider value
  empatheticAndSupportive: boolean;
  solutionFocused: boolean;
  casualAndFriendly: boolean;
  professionalAndFormal: boolean;
  // Main page TTS settings
  mainTTSVoiceId: string;
  mainTTSModel: string;
  mainEnableTTS: boolean;
  mainTTSSpeed: number;
  mainTTSAutoPlay: boolean;
  mainTTSAdaptivePacing: boolean;
  // Impersonate TTS settings
  therapistVoiceId: string;
  therapistModel: string;
  impostorVoiceId: string;
  impostorModel: string;
  enableTTS: boolean;
  ttsSpeed: number;
  ttsAutoPlay: boolean;
  ttsAdaptivePacing: boolean;
  // Podcast mode settings
  podcastMode: boolean;
  podcastMusicTrack: string;
  podcastMusicVolume: number;
  podcastMusicAutoPlay: boolean;
  podcastTextSize: "small" | "medium" | "large";
  podcastHighlightStyle: "underline" | "background" | "bold";
  podcastAutoScroll: boolean;
  // Auto-play music settings for different pages
  autoPlayMusicOnMain: boolean;
  autoPlayMusicOnImpersonate: boolean;
  autoPlayMusicOnPodcast: boolean;
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
  // Current session data (ephemeral - not persisted)
  currentContext: ConversationContext;
  contexts: Map<string, ConversationContext>;
  loadingState: "idle" | "observer" | "generating" | "streaming";

  // Crisis detection state
  crisisDetected: boolean;

  // User preferences (persisted)
  conversationPreferences: ConversationPreferences;
  impersonateMaxExchanges: number;

  // Initial forms cache (persisted)
  initialForms: Map<number, FormData>;

  // Actions
  setCurrentContext: (contextId: string) => void;
  addMessage: (message: Message) => void;
  updateContextSummary: (summary: string) => void;
  clearCurrentContext: () => void;
  updateLastMessage: (newText: string) => void;
  updateMessageStatus: (tempId: number, status: Message["status"], error?: string) => void;
  removeMessage: (tempId: number) => void;
  setSessionId: (sessionId: number | null) => void;
  setThreadId: (threadId: number | null) => void;
  clearMessages: () => void;
  setInitialForm: (form: FormData, threadOrSessionId?: number) => void;
  getInitialForm: (threadOrSessionId: number) => FormData | undefined;
  setLoadingState: (
    state: "idle" | "observer" | "generating" | "streaming"
  ) => void;
  setMessages: (messages: Message[]) => void;
  setImpersonateMaxExchanges: (val: number) => void;
  setConversationPreferences: (preferences: ConversationPreferences) => void;
  setCrisisDetected: (detected: boolean) => void;
  checkCrisisStatus: (sessionId: number) => Promise<void>;
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
      loadingState: "idle",
      crisisDetected: false,
        conversationPreferences: {
          briefAndConcise: 50, // Default to middle value
          empatheticAndSupportive: false,
          solutionFocused: false,
          casualAndFriendly: false,
          professionalAndFormal: false,
          // Main page TTS settings
          mainTTSVoiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
          mainTTSModel: "eleven_flash_v2_5",
          mainEnableTTS: false,
          mainTTSSpeed: 1.0,
          mainTTSAutoPlay: false,
          mainTTSAdaptivePacing: false,
           // Impersonate TTS settings
           therapistVoiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
           therapistModel: "eleven_flash_v2_5",
           impostorVoiceId: "AZnzlk1XvdvUeBnXmlld", // Domi
           impostorModel: "eleven_flash_v2_5",
           enableTTS: false,
           ttsSpeed: 1.0,
           ttsAutoPlay: false,
           ttsAdaptivePacing: false,
            // Podcast mode settings
            podcastMode: false,
            podcastMusicTrack: "ambient-piano",
            podcastMusicVolume: 0.3,
            podcastMusicAutoPlay: true,
            podcastTextSize: "medium" as const,
            podcastHighlightStyle: "background" as const,
            podcastAutoScroll: true,
            // Auto-play music settings for different pages
            autoPlayMusicOnMain: false,
            autoPlayMusicOnImpersonate: true,
            autoPlayMusicOnPodcast: true,
         },
      initialForms: new Map<number, FormData>(),
      impersonateMaxExchanges: 10,
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
      updateMessageStatus: (tempId: number, status: Message["status"], error?: string) => {
        const { currentContext } = get();
        const messages = [...currentContext.messages];
        const messageIndex = messages.findIndex(msg => msg.tempId === tempId);
        if (messageIndex !== -1) {
          messages[messageIndex] = {
            ...messages[messageIndex],
            status,
            error,
          };
          set({
            currentContext: { ...currentContext, messages },
          });
        }
      },
      removeMessage: (tempId: number) => {
        const { currentContext } = get();
        const messages = currentContext.messages.filter(msg => msg.tempId !== tempId);
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
      setInitialForm: (form: FormData, threadOrSessionId?: number) => {
        const { currentContext, initialForms } = get();
        if (typeof threadOrSessionId === "number") {
          const updatedForms = new Map(initialForms);
          updatedForms.set(threadOrSessionId, form);
          set({ initialForms: updatedForms });
        } else {
          set({ currentContext: { ...currentContext, initialForm: form } });
        }
      },
      getInitialForm: (threadOrSessionId: number) => {
        const { initialForms, currentContext } = get();
        if (initialForms && initialForms.has(threadOrSessionId)) {
          return initialForms.get(threadOrSessionId);
        }
        return currentContext.initialForm;
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
      setImpersonateMaxExchanges: (val: number) =>
        set({ impersonateMaxExchanges: val }),
      setConversationPreferences: (preferences: ConversationPreferences) =>
        set({ conversationPreferences: preferences }),
      setCrisisDetected: (detected: boolean) => set({ crisisDetected: detected }),
      checkCrisisStatus: async (sessionId: number) => {
        try {
          const response = await fetch(`/api/chat/crisis/${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            set({ crisisDetected: data.crisisDetected });
          }
        } catch (error) {
          console.error("Error checking crisis status:", error);
        }
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
          // Store the partialized state as-is; currentContext is not persisted
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state: ChatState) => ({
        // Only persist user preferences and settings
        impersonateMaxExchanges: state.impersonateMaxExchanges,
        conversationPreferences: state.conversationPreferences,
        initialForms: Array.from(state.initialForms.entries()),
      }),
      merge: (persistedState: any, currentState: ChatState) => {
        return {
          ...currentState,
          impersonateMaxExchanges: persistedState.impersonateMaxExchanges ?? 10,
          conversationPreferences: persistedState.conversationPreferences ?? {
            briefAndConcise: 50,
            empatheticAndSupportive: false,
            solutionFocused: false,
            casualAndFriendly: false,
            professionalAndFormal: false,
            // Main page TTS settings
            mainTTSVoiceId: "21m00Tcm4TlvDq8ikWAM",
            mainTTSModel: "eleven_flash_v2_5",
            mainEnableTTS: false,
            mainTTSSpeed: 1.0,
            mainTTSAutoPlay: false,
            mainTTSAdaptivePacing: false,
            // Impersonate TTS settings
            therapistVoiceId: "21m00Tcm4TlvDq8ikWAM",
            therapistModel: "eleven_flash_v2_5",
            impostorVoiceId: "AZnzlk1XvdvUeBnXmlld",
            impostorModel: "eleven_flash_v2_5",
            enableTTS: false,
            ttsSpeed: 1.0,
            ttsAutoPlay: false,
            ttsAdaptivePacing: false,
            // Podcast mode settings
            podcastMode: false,
            podcastMusicTrack: "ambient-piano",
            podcastMusicVolume: 0.3,
            podcastMusicAutoPlay: true,
            podcastTextSize: "medium",
            podcastHighlightStyle: "background",
            podcastAutoScroll: true,
            // Auto-play music settings for different pages
            autoPlayMusicOnMain: false,
            autoPlayMusicOnImpersonate: true,
            autoPlayMusicOnPodcast: true,
          },
          initialForms: new Map(persistedState.initialForms || []),
          crisisDetected: false, // Always start with false, will be checked from server
        };
      },
    }
  )
);

