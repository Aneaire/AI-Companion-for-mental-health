import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { impostorApi, threadsApi } from "../client";
import { useUserProfile } from "./user";

export const useThreads = () => {
  const { userId } = useAuth();
  const { data: userProfile } = useUserProfile(userId || null);
  return useQuery({
    queryKey: ["threads", userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) throw new Error("User not authenticated");
      return threadsApi.list(userProfile.id);
    },
    enabled: !!userProfile?.id,
  });
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
  });
};

export const useNormalThreads = (enabled = true) => {
  const { userId } = useAuth();
  const { data: userProfile } = useUserProfile(userId || null);
  return useQuery({
    queryKey: ["normalThreads", userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) throw new Error("User not authenticated");
      return threadsApi.list(userProfile.id);
    },
    enabled: !!userProfile?.id && enabled,
  });
};

export const useCreateThread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: threadsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      queryClient.invalidateQueries({ queryKey: ["personaThreads"] });
      queryClient.invalidateQueries({ queryKey: ["normalThreads"] });
    },
  });
};
