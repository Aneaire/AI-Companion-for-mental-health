import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/types/chat";
import { Bot, Loader2 } from "lucide-react";
import type { JSX } from "react";
import MessageInput from "./MessageInput";
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
  onRetryMessage?: (message: Message) => void;
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
  onRetryMessage,
}: ChatInterfaceProps): JSX.Element {
  const getLoadingBadge = () => {
    if (loadingState === "idle") return null;

    const variants = {
      observer: { variant: "secondary" as const, text: "Observing", icon: Bot },
      generating: {
        variant: "default" as const,
        text: "Thinking",
        icon: Loader2,
      },
      // Remove streaming variant since the actual response is visible
    };

    const config = variants[loadingState as keyof typeof variants];
    
    // Don't show badge for streaming since the actual response is visible
    if (!config || loadingState === "streaming") {
      return null;
    }
    
    const Icon = config.icon;

    return (
      <div className="flex justify-center py-2">
        <Badge variant={config.variant} className="text-xs">
          <Icon
            size={12}
            className={`mr-1 ${loadingState !== "observer" ? "animate-spin" : ""}`}
          />
          {config.text}
        </Badge>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-gray-50/30 to-white/30">
      {/* Messages Area */}
      <ScrollArea className="flex-1 h-full min-h-0">
        <div className=" px-2 md:px-4 py-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-4">
                <Bot size={32} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {isImpersonateMode
                  ? "Ready for Roleplay"
                  : "Start Your Conversation"}
              </h3>
              <p className="text-sm text-gray-600 max-w-md">
                {isImpersonateMode
                  ? "The AI will roleplay as your patient. Use the controls below to begin the session."
                  : "Send a message to begin your conversation with the AI companion."}
              </p>
            </div>
          ) : (
            <MessageList 
              messages={messages} 
              isLoading={loadingState} 
              onRetryMessage={onRetryMessage}
            />
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      {inputVisible && (
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-200/50 p-4">
          <MessageInput
            disabled={loadingState !== "idle"}
            onSendMessage={onSendMessage}
          />
        </div>
      )}
    </div>
  );
}

