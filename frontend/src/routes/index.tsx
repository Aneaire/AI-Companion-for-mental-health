import { ChatDialog } from "@/components/chat/ChatDialog";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Header } from "@/components/chat/Header";
import client from "@/lib/client";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types/chat";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type JSX } from "react";

interface ErrorResponse {
  error: string;
}

interface FetchedMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

function App(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const {
    currentContext,
    addMessage,
    updateLastMessage,
    setSessionId,
    clearMessages,
  } = useChatStore();
  const [showChat, setShowChat] = useState(currentContext.messages.length > 0);

  // Load messages from local storage on mount
  useEffect(() => {
    const storedSessionId = localStorage.getItem("sessionId");
    if (storedSessionId) {
      const parsedSessionId = parseInt(storedSessionId, 10);
      setSessionId(parsedSessionId); // Update the store with the retrieved sessionId

      const fetchMessages = async () => {
        try {
          const response = await client.api.chat[":sessionId"].$get({
            param: { sessionId: String(parsedSessionId) },
          });
          if (!response.ok) {
            throw new Error("Failed to fetch previous messages");
          }
          const fetchedMessages: FetchedMessage[] = await response.json();
          // Clear existing messages before adding fetched ones if needed
          clearMessages();
          fetchedMessages.forEach((msg) =>
            addMessage({
              sender: msg.role === "model" ? "ai" : "user",
              text: msg.text,
              timestamp: new Date(msg.timestamp),
              contextId: "default", // Assuming default context for fetched messages
            })
          );
          setShowChat(true);
        } catch (error) {
          console.error("Error fetching previous messages:", error);
          // Optionally clear session ID if fetching fails
          localStorage.removeItem("sessionId");
          setSessionId(null);
        }
      };
      fetchMessages();
    }
  }, [addMessage, updateLastMessage, setSessionId, clearMessages]);

  const handleFormSubmit = async (sessionId: number) => {
    setSessionId(sessionId);
    localStorage.setItem("sessionId", String(sessionId));
    setShowChat(true);
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

      setIsLoading(false);

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
            fullResponse += line.substring("data: ".length);
          }
        }

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
    <div className="flex flex-col md:h-[80vh] h-[90vh] md:mt-14 mt-10 max-w-5xl mx-auto bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg overflow-hidden">
      <Header />

      <main className="flex-1 overflow-hidden flex flex-col p-3">
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
      </main>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: App,
});

export default App;
