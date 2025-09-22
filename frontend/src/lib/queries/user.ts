import { useQuery } from "@tanstack/react-query";
import client, { impostorApi } from "../client";

export const useUserProfile = (clerkId: string | null) => {
  return useQuery({
    queryKey: ["userProfile", clerkId],
    queryFn: async () => {
      if (!clerkId) return null;
      const response = await client.api.user.profile[":clerkId"].$get({
        param: { clerkId },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }
      return response.json();
    },
    enabled: !!clerkId,
  });
};

export function useImpostorProfile(userId: number | null) {
  return useQuery({
    queryKey: ["impostorProfile", userId],
    queryFn: async () => {
      if (!userId) return null;
      return impostorApi.getProfile(userId);
    },
    enabled: !!userId,
  });
}

export function usePersona(personaId: number | null) {
  return useQuery({
    queryKey: ["persona", personaId],
    queryFn: async () => {
      if (!personaId) return null;
      const response = await fetch(`/api/persona-library/${personaId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch persona");
      }
      return response.json();
    },
    enabled: !!personaId,
  });
}

