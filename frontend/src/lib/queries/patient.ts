import { patientApi } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";

export function usePatientMessage() {
  return useMutation({
    mutationFn: async ({
      message,
      context,
    }: {
      message: string;
      context?: any[];
    }) => {
      return patientApi.sendMessage({ message, context });
    },
  });
}
