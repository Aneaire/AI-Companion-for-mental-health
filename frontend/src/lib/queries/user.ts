import { useQuery } from "@tanstack/react-query";
import client from "../client";

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
