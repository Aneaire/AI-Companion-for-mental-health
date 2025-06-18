// components/ChatInterface.tsx
import type { Message } from "@/types/chat";
import type { JSX } from "react";
import MessageInput from "./MessageInput";
import { MessageList } from "./MessageList";

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
}: ChatInterfaceProps): JSX.Element {
  return (
    <>
      <MessageList messages={messages} />
      <div>
        <MessageInput disabled={isLoading} onSendMessage={onSendMessage} />
      </div>
    </>
  );
}
