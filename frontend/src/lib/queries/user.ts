import { useQuery } from "@tanstack/react-query";
import client, { impostorApi } from "../client";

const typedClient = client as any;

export const useUserProfile = (clerkId: string | null) => {
  return useQuery({
    queryKey: ["userProfile", clerkId],
    queryFn: async () => {
      if (!clerkId) return null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await typedClient.api.user.profile[":clerkId"].$get({
          param: { clerkId },
          fetch: { signal: controller.signal },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            // User doesn't exist, this is expected for new users
            return null;
          }
          throw new Error(`Failed to fetch user profile: ${response.status}`);
        }
        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error("Request timed out");
        }
        throw error;
      }
    },
    enabled: !!clerkId,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (user not found) or timeout
      if (error?.message?.includes('404') || error?.message?.includes('timed out')) {
        return false;
      }
      return failureCount < 2;
    },
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

