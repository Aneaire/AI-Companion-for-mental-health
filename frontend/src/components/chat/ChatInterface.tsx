// components/ChatInterface.tsx
import type { MentalHealthConcern, Message } from "@/types/chat";
import type { JSX } from "react";
import MessageInput from "./MessageInput";
import { MessageList } from "./MessageList";

interface ChatInterfaceProps {
  messages: Message[];
  selectedConcern: MentalHealthConcern | null;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export function ChatInterface({
  messages,
  selectedConcern,
  onSendMessage,
  isLoading,
}: ChatInterfaceProps): JSX.Element {
  return (
    <>
      <MessageList messages={messages} selectedConcern={selectedConcern} />

      <div>
        {/* Pass onSendMessage here */}
        <MessageInput disabled={isLoading} onSendMessage={onSendMessage} />
      </div>
    </>
  );
}
