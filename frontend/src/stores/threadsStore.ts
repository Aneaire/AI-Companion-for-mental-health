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
  personaThreads: PersonaThread[];
  setPersonaThreads: (threads: PersonaThread[]) => void;
  addPersonaThread: (thread: PersonaThread) => void;
  clearPersonaThreads: () => void;
  normalThreads: NormalThread[];
  setNormalThreads: (threads: NormalThread[]) => void;
  addNormalThread: (thread: NormalThread) => void;
  clearNormalThreads: () => void;
}

export const useThreadsStore = create<ThreadsState>((set) => ({
  personaThreads: [],
  setPersonaThreads: (threads) => set({ personaThreads: threads }),
  addPersonaThread: (thread) =>
    set((state) => ({ personaThreads: [thread, ...state.personaThreads] })),
  clearPersonaThreads: () => set({ personaThreads: [] }),
  normalThreads: [],
  setNormalThreads: (threads) => set({ normalThreads: threads }),
  addNormalThread: (thread) =>
    set((state) => ({ normalThreads: [thread, ...state.normalThreads] })),
  clearNormalThreads: () => set({ normalThreads: [] }),
}));
