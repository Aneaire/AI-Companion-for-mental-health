import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { impostorApi, threadsApi } from "../client";
import { useUserProfile } from "./user";
import type { NormalThread, PersonaThread } from "../../stores/threadsStore";

export const useThreads = () => {
  const { userId } = useAuth();
  const { data: userProfile } = useUserProfile(userId || null);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["threads", userProfile?.id, limit, offset],
    queryFn: async () => {
      if (!userProfile?.id) throw new Error("User not authenticated");
      return threadsApi.list(userProfile.id, limit, offset);
    },
    enabled: !!userProfile?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  return { ...query, limit, setLimit, offset, setOffset };
};

export const usePersonaThreads = (enabled = true) => {
  const { userId } = useAuth();
  const { data: userProfile } = useUserProfile(userId || null);
  return useQuery({
    queryKey: ["personaThreads", userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) throw new Error("User not authenticated");
      return impostorApi.listThreads(userProfile.id);
    },
    enabled: !!userProfile?.id && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useNormalThreads = (enabled = true) => {
  const { userId } = useAuth();
  const { data: userProfile } = useUserProfile(userId || null);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["normalThreads", userProfile?.id, limit, offset],
    queryFn: async () => {
      if (!userProfile?.id) throw new Error("User not authenticated");
      return threadsApi.list(userProfile.id, limit, offset);
    },
    enabled: !!userProfile?.id && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  return { ...query, limit, setLimit, offset, setOffset };
};

export const useCreateThread = () => {
  const queryClient = useQueryClient();
  const { data: userProfile } = useUserProfile();

  return useMutation({
    mutationFn: threadsApi.create,
    onMutate: async (newThread) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["normalThreads"] });
      
      // Snapshot the previous value
      const previousThreads = queryClient.getQueryData(["normalThreads", userProfile?.id]);
      
      // Create optimistic thread with temporary id
      const optimisticThread = {
        ...newThread,
        id: -Date.now(), // Temporary negative ID to avoid conflicts
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Optimistically update
      queryClient.setQueryData(
        ["normalThreads", userProfile?.id, 20, 0],
        (old: any) => {
          if (!old) return { threads: [optimisticThread], total: 1 };
          return {
            ...old,
            threads: [optimisticThread, ...old.threads],
            total: old.total + 1,
          };
        }
      );
      
      return { previousThreads, optimisticThread };
    },
    onSuccess: (data, variables, context) => {
      // Replace the optimistic thread with the real one
      queryClient.setQueryData(
        ["normalThreads", userProfile?.id, 20, 0],
        (old: any) => {
          if (!old) return { threads: [data], total: 1 };
          return {
            ...old,
            threads: old.threads.map((thread: any) => 
              thread.id === context?.optimisticThread.id ? data : thread
            ),
          };
        }
      );
    },
    onError: (err, newThread, context) => {
      // Rollback on error
      if (context?.previousThreads) {
        queryClient.setQueryData(
          ["normalThreads", userProfile?.id, 20, 0],
          context.previousThreads
        );
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["normalThreads"] });
    },
  });
};

// New hook for updating thread order optimistically
export const useMoveThreadToTop = () => {
  const queryClient = useQueryClient();
  const { data: userProfile } = useUserProfile();

  return (threadId: number) => {
    queryClient.setQueryData(
      ["normalThreads", userProfile?.id, 20, 0],
      (old: any) => {
        if (!old?.threads) return old;
        
        const threads = [...old.threads];
        const threadIndex = threads.findIndex((t: NormalThread) => t.id === threadId);
        
        if (threadIndex === -1) return old;
        
        const [thread] = threads.splice(threadIndex, 1);
        const updatedThread = {
          ...thread,
          updatedAt: new Date().toISOString(),
        };
        
        return {
          ...old,
          threads: [updatedThread, ...threads],
        };
      }
    );
  };
};

// Hook for thread sessions
export const useThreadSessions = (threadId: number | null) => {
  return useQuery({
    queryKey: ["threadSessions", threadId],
    queryFn: async () => {
      if (!threadId) throw new Error("No thread ID provided");
      return threadsApi.getSessions(threadId);
    },
    enabled: !!threadId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for archived threads
export const useArchivedThreads = (enabled = true) => {
  const { userId } = useAuth();
  const { data: userProfile } = useUserProfile(userId || null);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  
  const query = useQuery({
    queryKey: ["archivedThreads", userProfile?.id, limit, offset],
    queryFn: async () => {
      if (!userProfile?.id) throw new Error("User not authenticated");
      const response = await fetch(`/api/threads/archived?userId=${userProfile.id}&limit=${limit}&offset=${offset}`);
      if (!response.ok) throw new Error("Failed to fetch archived threads");
      return response.json();
    },
    enabled: !!userProfile?.id && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  
  return { ...query, limit, setLimit, offset, setOffset };
};

