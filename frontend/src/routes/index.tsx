import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type JSX } from "react";

import { ChatInterface } from "@/components/chat/ChatInterface";
import { Header } from "@/components/chat/Header";
import { MentalHealthDialog } from "@/components/MentalHealthDialog";
import client from "@/lib/client";
import {
  mentalHealthConcerns,
  type MentalHealthConcern,
  type Message,
} from "@/types/chat";
import { useSpeechSynthesis } from "react-speech-kit";

export const Route = createFileRoute("/")({
  component: App,
});

function App(): JSX.Element {
  const [showDialog, setShowDialog] = useState<boolean>(true);
  const [selectedConcern, setSelectedConcern] =
    useState<MentalHealthConcern | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contextSummary, setContextSummary] = useState<string>("");
  const { speak } = useSpeechSynthesis();

  useEffect(() => {
    setShowDialog(true);
  }, []);

  const handleDialogOpenChange = (open: boolean) => {
    setShowDialog(open);

    if (!open && !selectedConcern) {
      // Auto-select last concern if none selected
      const lastConcern = mentalHealthConcerns[mentalHealthConcerns.length - 1];
      if (lastConcern) {
        handleSelectConcern(lastConcern);
      }
    }
  };

  const handleSelectConcern = (concern: MentalHealthConcern): void => {
    setSelectedConcern(concern);
    setShowDialog(false);

    const welcomeMessage: Message = {
      sender: "ai",
      text: `Hello! I understand you're dealing with ${concern.label.toLowerCase()} today. How can I support you?`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const handleResetDialog = (): void => {
    setShowDialog(true);
    setMessages([]);
    setSelectedConcern(null);
  };

  const handleSendMessage = async (message: string): Promise<void> => {
    if (!message.trim()) return;

    const userMessage: Message = {
      sender: "user",
      text: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const lastAiMessage = [...messages]
      .reverse()
      .find((m) => m.sender === "ai");

    try {
      const response = await client.api.chat.$post({
        json: {
          message: message,
          concern: selectedConcern,
          contextSummary,
          previousAiMessage: lastAiMessage?.text || null,
        },
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error: string };
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      // Create the AI message placeholder immediately
      const tempId = Date.now();
      const aiMessage: Message = {
        sender: "ai",
        text: "",
        timestamp: new Date(),
        tempId,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false); // Stop loading indicator since streaming starts

      const decoder = new TextDecoder();
      let fullResponse = "";

      // Process the stream in real-time
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;

        // Update the message with the new content immediately
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const aiIndex = updatedMessages.findIndex(
            (msg) => msg.tempId === tempId
          );

          if (aiIndex !== -1) {
            updatedMessages[aiIndex] = {
              ...updatedMessages[aiIndex],
              text: fullResponse,
            };
          }

          return updatedMessages;
        });
      }

      // Update context summary after streaming is complete
      setContextSummary(
        (prev) =>
          `${prev ? prev + "\n" : ""}User: ${message}\nAI: ${fullResponse}`
      );

      // Trigger speech synthesis after streaming is complete
      setTimeout(() => {
        speak({ text: fullResponse });
      }, 1000);
    } catch (error) {
      console.error("Error calling chat API:", error);

      // Add error message
      const errorMessage: Message = {
        sender: "ai",
        text:
          error instanceof Error
            ? error.message
            : "Sorry, something went wrong. Please try again later.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:h-[80vh] h-[90vh] md:mt-14 mt-10 max-w-5xl mx-auto bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg overflow-hidden">
      <Header
        selectedConcern={selectedConcern}
        onResetDialog={handleResetDialog}
      />

      <main className="flex-1 overflow-hidden flex flex-col p-3">
        <MentalHealthDialog
          open={showDialog}
          onOpenChange={handleDialogOpenChange}
          onSelectConcern={handleSelectConcern}
        />

        {!showDialog && (
          <ChatInterface
            messages={messages}
            selectedConcern={selectedConcern}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        )}
      </main>
    </div>
  );
}

export default App;
