import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CounselorChat, CounselorMessage } from "@/types/counselor";
import { CounselorChatMessage } from "./CounselorChatMessage";
import { formatRelativeTime } from "@/lib/utils";

interface CounselorChatAreaProps {
  selectedChat: CounselorChat;
  messages: CounselorMessage[];
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onEndChat: (chatId: string) => void;
  isSending: boolean;
}

export function CounselorChatArea({
  selectedChat,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onEndChat,
  isSending,
}: CounselorChatAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad) {
        // Initial load - always scroll to bottom
        setTimeout(() => {
          scrollToBottomInitial();
          setIsInitialLoad(false);
        }, 100);
      } else {
        // Subsequent messages - only scroll if user was at bottom
        scrollToBottom();
      }
    }
  }, [messages]);

  // Handle scroll events to track if user is at bottom
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50;
    setIsScrolledToBottom(isAtBottom);
  };

  // Auto-scroll to bottom if user was already scrolled to bottom
  const scrollToBottom = () => {
    if (scrollAreaRef.current && isScrolledToBottom) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  // Initial scroll to bottom when messages are loaded
  const scrollToBottomInitial = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setIsScrolledToBottom(true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const getUserName = () => {
    const { user } = selectedChat;
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.firstName || user?.nickname || "Anonymous User";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] bg-gradient-to-br from-gray-50/50 via-white to-indigo-50/30 rounded-2xl shadow-lg border border-gray-200/60">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 rounded-t-2xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden ${
              selectedChat.user?.profileImageUrl
                ? ""
                : "bg-gradient-to-br from-blue-500 to-purple-600"
            }`}>
              {selectedChat.user?.profileImageUrl ? (
                <img
                  src={selectedChat.user.profileImageUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <MessageCircle className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{getUserName()}</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-gray-600">
                  started: {formatRelativeTime(selectedChat.startedAt)}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEndChat(selectedChat.$id)}
            className="hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors"
          >
            <X className="h-4 w-4 mr-2" />
            End Session
          </Button>
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea
          ref={scrollAreaRef}
          className="h-full"
          onScroll={handleScroll}
        >
          <div className="px-3 md:px-6 py-4 md:py-6 max-w-6xl mx-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
                  <MessageCircle size={40} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">
                  Start Your Counseling Session
                </h3>
                <p className="text-gray-600 max-w-lg">
                  Send a message to begin your counseling session with {getUserName()}.
                </p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {messages.map((message, index) => (
                  <CounselorChatMessage
                    key={message.$id}
                    message={message}
                    previousMessage={messages[index - 1]}
                    selectedChat={selectedChat}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Input Area */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-200/50 p-3 md:p-4 rounded-b-2xl">
        <div className="w-full max-w-4xl mx-auto bg-white/50 backdrop-blur-sm">
          <div className="relative">
            <div className="flex items-end gap-2 p-2 md:p-3 bg-white rounded-lg border border-gray-200 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-200">
              <Textarea
                value={newMessage}
                onChange={(e) => onNewMessageChange(e.target.value)}
                placeholder="Type your counseling message..."
                className="flex-1 min-h-[36px] md:min-h-[40px] max-h-28 md:max-h-32 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm md:text-base"
                disabled={isSending}
                onKeyDown={handleKeyDown}
              />
              <Button
                onClick={onSendMessage}
                disabled={!newMessage.trim() || isSending}
                size="sm"
                className="shrink-0 h-10 md:h-11 px-4 md:px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
              >
                <div className="flex items-center">
                  {isSending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Send size={16} className="mr-2" />
                  )}
                  <span className="text-sm md:text-base">{isSending ? "Sending..." : "Send"}</span>
                </div>
              </Button>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500 text-center px-2">
            Press Enter to send, Shift+Enter for a new line • Messages are encrypted and secure
          </div>
        </div>
      </div>
    </div>
  );
}