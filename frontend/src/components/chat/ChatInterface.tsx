import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/types/chat";
import type { JSX } from "react";
import MessageInput from "./MessageInput";
import ImpersonateInput from "./ImpersonateInput";
import { MessageList } from "./MessageList";

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  loadingState: "idle" | "observer" | "generating" | "streaming";
  inputVisible: boolean;
  isImpersonateMode?: boolean;
  onStartImpersonation?: () => void;
  onStopImpersonation?: () => void;
  isImpersonating?: boolean;
}

export function ChatInterface({
  messages,
  onSendMessage,
  loadingState,
  inputVisible,
  isImpersonateMode = false,
  onStartImpersonation,
  onStopImpersonation,
  isImpersonating = false,
}: ChatInterfaceProps): JSX.Element {
  return (
    <div className="flex flex-col h-full min-h-0 ">
      <ScrollArea className="flex-1 h-full min-h-0 pt-14 md:pt-0">
        <MessageList messages={messages} isLoading={loadingState} />
      </ScrollArea>
      {inputVisible && (
        <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 z-10">
          {isImpersonateMode ? (
            <ImpersonateInput
              disabled={loadingState !== "idle"}
              onSendMessage={onSendMessage}
              onStartImpersonation={onStartImpersonation || (() => {})}
              onStopImpersonation={onStopImpersonation || (() => {})}
              isImpersonating={isImpersonating}
            />
          ) : (
            <MessageInput
              disabled={loadingState !== "idle"}
              onSendMessage={onSendMessage}
            />
          )}
        </div>
      )}
    </div>
  );
}
