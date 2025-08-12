import { create } from "zustand";

export type PersonaThread = {
  id: number;
  userId: number;
  sessionName?: string | null;
  preferredName?: string | null;
  currentEmotions?: string[] | null;
  reasonForVisit?: string;
  supportType?: string[] | null;
  supportTypeOther?: string | null;
  additionalContext?: string | null;
  responseTone?: string | null;
  imageResponse?: string | null;
  summaryContext?: string | null;
  threadType?: string;
  createdAt?: string | null | undefined;
  updatedAt?: string | null | undefined;
  personaId?: number | null;
};

export type NormalThread = PersonaThread; // For now, same shape

interface ThreadsState {
  // Keep only UI state that can't be derived from queries
  selectedThreadId: number | null;
  selectedSessionId: number | null;
  setSelectedThread: (threadId: number | null) => void;
  setSelectedSession: (sessionId: number | null) => void;
}

export const useThreadsStore = create<ThreadsState>((set) => ({
  selectedThreadId: null,
  selectedSessionId: null,
  setSelectedThread: (threadId) => set({ selectedThreadId: threadId }),
  setSelectedSession: (sessionId) => set({ selectedSessionId: sessionId }),
}));
