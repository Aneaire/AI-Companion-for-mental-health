import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types/chat";
import client from "../client";

// Hook to fetch messages for a session
export const useSessionMessages = (sessionId: number | null) => {
  return useQuery({
    queryKey: ["messages", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const response = await client.api.chat[":sessionId"].$get({
        param: { sessionId: String(sessionId) },
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      const messages = await response.json();
      return messages.map((msg: any) => ({
        id: String(msg.id),
        sender: msg.sender,
        text: msg.text,
        timestamp: new Date(msg.timestamp),
        sessionId: sessionId,
        status: "sent" as const,
      }));
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook to send a message with optimistic updates
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      message,
      sessionId,
      context = [],
      initialForm,
      systemInstruction,
      threadType = "main",
      userId,
    }: {
      message: string;
      sessionId: number;
      context?: any[];
      initialForm?: any;
      systemInstruction?: string;
      threadType?: string;
      userId: string;
    }) => {
      const response = await client.api.chat.$post({
        json: {
          message,
          context,
          sessionId,
          userId,
          initialForm,
          systemInstruction,
          threadType,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      return response;
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["messages", variables.sessionId],
      });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData([
        "messages",
        variables.sessionId,
      ]);

      // Create optimistic user message
      const optimisticUserMessage: Message = {
        tempId: Date.now(),
        sender: "user",
        text: variables.message,
        timestamp: new Date(),
        sessionId: variables.sessionId,
        status: "sending",
        contextId: "default",
      };

      // Optimistically update the cache
      queryClient.setQueryData(
        ["messages", variables.sessionId],
        (old: Message[] = []) => [...old, optimisticUserMessage]
      );

      return { previousMessages, optimisticUserMessage };
    },
    onSuccess: async (response, variables, context) => {
      // Handle streaming response
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        let buffer = "";

        // Create optimistic AI message
        const optimisticAiMessage: Message = {
          tempId: Date.now() + 1,
          sender: "ai",
          text: "",
          timestamp: new Date(),
          sessionId: variables.sessionId,
          status: "streaming",
          contextId: "default",
        };

        // Add AI message to cache and trigger loading state change
        queryClient.setQueryData(
          ["messages", variables.sessionId],
          (old: Message[] = []) => {
            // Update user message status and add AI message
            const updated = old.map((msg) =>
              msg.tempId === context?.optimisticUserMessage.tempId
                ? { ...msg, status: "sent" as const }
                : msg
            );
            return [...updated, optimisticAiMessage];
          }
        );

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value);
            let lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const content = line.substring("data: ".length);
                if (content.trim() === "" || /^\d+$/.test(content.trim())) continue;
                fullResponse += content + "\n";

                // Update the streaming message
                queryClient.setQueryData(
                  ["messages", variables.sessionId],
                  (old: Message[] = []) =>
                    old.map((msg) =>
                      msg.tempId === optimisticAiMessage.tempId
                        ? { ...msg, text: fullResponse }
                        : msg
                    )
                );
              }
            }
          }

          // Handle remaining buffer content
          if (buffer) {
            fullResponse += buffer;
          }

          // Ensure message ends with newline
          if (!fullResponse.endsWith("\n")) {
            fullResponse += "\n";
          }

          // Mark AI message as sent
          queryClient.setQueryData(
            ["messages", variables.sessionId],
            (old: Message[] = []) =>
              old.map((msg) =>
                msg.tempId === optimisticAiMessage.tempId
                  ? { ...msg, text: fullResponse, status: "sent" as const }
                  : msg
              )
          );
        } catch (streamError) {
          console.error("Stream processing error:", streamError);
          // Mark AI message as failed
          queryClient.setQueryData(
            ["messages", variables.sessionId],
            (old: Message[] = []) =>
              old.map((msg) =>
                msg.tempId === optimisticAiMessage.tempId
                  ? {
                      ...msg,
                      status: "failed" as const,
                      error: "Failed to process response stream",
                    }
                  : msg
              )
          );
        } finally {
          reader.releaseLock();
        }
      }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["messages", variables.sessionId],
          context.previousMessages
        );
      } else {
        // Mark user message as failed
        queryClient.setQueryData(
          ["messages", variables.sessionId],
          (old: Message[] = []) =>
            old.map((msg) =>
              msg.tempId === context?.optimisticUserMessage.tempId
                ? {
                    ...msg,
                    status: "failed" as const,
                    error: error.message,
                  }
                : msg
            )
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch to ensure consistency
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["messages", variables.sessionId],
        });
      }, 1000);
    },
  });
};

// Hook to retry a failed message
export const useRetryMessage = () => {
  const queryClient = useQueryClient();
  const sendMessage = useSendMessage();

  return useMutation({
    mutationFn: async ({
      message,
      sessionId,
      userId,
    }: {
      message: Message;
      sessionId: number;
      userId: string;
    }) => {
      return sendMessage.mutateAsync({
        message: message.text,
        sessionId,
        userId,
      });
    },
    onMutate: async (variables) => {
      // Update message status to sending
      queryClient.setQueryData(
        ["messages", variables.sessionId],
        (old: Message[] = []) =>
          old.map((msg) =>
            msg.tempId === variables.message.tempId
              ? {
                  ...msg,
                  status: "sending" as const,
                  retryCount: (msg.retryCount || 0) + 1,
                  error: undefined,
                }
              : msg
          )
      );
    },
  });
};
