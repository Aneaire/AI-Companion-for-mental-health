import { ScrollArea } from "@/components/ui/scroll-area";
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
    <div className="flex flex-col h-full min-h-0 ">
      <ScrollArea className="flex-1 h-full min-h-0">
        <MessageList messages={messages} isLoading={isLoading} />
      </ScrollArea>
      <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 z-10">
        <MessageInput disabled={isLoading} onSendMessage={onSendMessage} />
      </div>
    </div>
  );
}
