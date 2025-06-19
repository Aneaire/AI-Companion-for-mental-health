import { ChatDialog } from "@/components/chat/ChatDialog";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInterface } from "@/components/chat/ChatInterface";
import client from "@/lib/client";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types/chat";
import { Suspense, useEffect, useState, type JSX } from "react";

interface ErrorResponse {
  error: string;
}

interface FetchedMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

export interface ThreadProps {
  selectedThreadId: number | null;
}

export function Thread({ selectedThreadId }: ThreadProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const {
    currentContext,
    addMessage,
    updateLastMessage,
    setSessionId,
    clearMessages,
  } = useChatStore();
  const [showChat, setShowChat] = useState(currentContext.messages.length > 0);

  // Debug: Log messages from store
  useEffect(() => {
    console.log("Thread currentContext.messages:", currentContext.messages);
  }, [currentContext.messages]);

  useEffect(() => {
    if (selectedThreadId) {
      setSessionId(selectedThreadId);
      const fetchMessages = async () => {
        try {
          setIsLoading(true);
          const response = await client.api.chat[":sessionId"].$get({
            param: { sessionId: String(selectedThreadId) },
          });
          if (!response.ok)
            throw new Error("Failed to fetch previous messages");
          const fetchedMessages: FetchedMessage[] = await response.json();
          clearMessages();
          fetchedMessages.forEach((msg) =>
            addMessage({
              sender: msg.role === "model" ? "ai" : "user",
              text: msg.text,
              timestamp: new Date(msg.timestamp),
              contextId: "default",
            })
          );
          setShowChat(true);
        } catch (error) {
          console.error("Error fetching previous messages:", error);
          setSessionId(null);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMessages();
    }
  }, [
    selectedThreadId,
    addMessage,
    updateLastMessage,
    setSessionId,
    clearMessages,
  ]);

  const handleFormSubmit = async (sessionId: number) => {
    setSessionId(sessionId);
    setShowChat(true);
    const response = await client.api.chat[":sessionId"].$get({
      param: { sessionId: String(sessionId) },
    });
    if (response.ok) {
      const fetchedMessages: FetchedMessage[] = await response.json();
      clearMessages();
      fetchedMessages.forEach((msg) =>
        addMessage({
          sender: msg.role === "model" ? "ai" : "user",
          text: msg.text,
          timestamp: new Date(msg.timestamp),
          contextId: "default",
        })
      );
    }
  };

  const handleSendMessage = async (message: string): Promise<void> => {
    if (!message.trim() && !showChat) return;

    const userMessage: Message = {
      sender: "user",
      text: message,
      timestamp: new Date(),
      contextId: "default",
    };

    if (message.trim()) {
      addMessage(userMessage);
    }
    setIsLoading(true);

    try {
      const response = await client.api.chat.$post({
        json: {
          message: message,
          context: currentContext.messages.map((msg) => ({
            role: msg.sender === "ai" ? "model" : "user",
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
            ...(msg.contextId ? { contextId: msg.contextId } : {}),
          })),
          ...(currentContext.sessionId
            ? { sessionId: currentContext.sessionId }
            : {}),
          ...(message.trim() === "" && !currentContext.messages.length
            ? { initialForm: undefined }
            : {}),
        },
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        console.error("Frontend received error data:", errorData);
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      if (message.trim() || currentContext.messages.length) {
        const tempId = Date.now();
        const aiMessage: Message = {
          sender: "ai",
          text: "",
          timestamp: new Date(),
          tempId,
          contextId: "default",
        };
        addMessage(aiMessage);
      }

      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = ""; // To handle partial SSE messages

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);

        // Process complete SSE messages from the buffer
        let lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete last line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            // Re-add the newline character that was removed by split('\n')
            fullResponse += line.substring("data: ".length) + "\n";
          }
        }

        // Only update if there's actual new content to avoid unnecessary renders
        if (
          fullResponse !==
          currentContext.messages[currentContext.messages.length - 1]?.text
        ) {
          updateLastMessage(fullResponse);
        }
      }
      // After the loop, the last chunk might not have ended with a newline.
      // Append any remaining buffer content, assuming it's part of the final text.
      if (buffer) {
        fullResponse += buffer;
        updateLastMessage(fullResponse);
      }
      // Finally, ensure the message ends with a newline if it's markdown,
      // as ReactMarkdown sometimes needs it for proper rendering of lists/blocks
      // This is a "belt and suspenders" approach if `patchMarkdown` isn't fully reliable.
      if (!fullResponse.endsWith("\n")) {
        fullResponse += "\n";
        updateLastMessage(fullResponse);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        sender: "ai",
        text:
          error instanceof Error
            ? error.message
            : "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date(),
        contextId: "default",
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen h-full bg-white md:max-w-4xl md:mx-auto md:my-6 w-full max-w-full flex-1">
      <div className="hidden md:block">
        <ChatHeader />
      </div>
      <main className="flex-1 overflow-hidden md:pb-0 w-full flex h-full flex-col ">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              Loading...
            </div>
          }
        >
          <ChatDialog
            open={!showChat}
            onOpenChange={setShowChat}
            onSubmit={handleFormSubmit as (sessionId: number) => void}
          />
          <ChatInterface
            messages={currentContext.messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </Suspense>
      </main>
    </div>
  );
}

export default Thread;
