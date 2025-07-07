import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Message } from "@/types/chat";
import { BrainCircuit, MessageCircle, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean | "idle" | "observer" | "generating" | "streaming";
}

// Enhanced patchMarkdown to handle more streaming edge cases
export function patchMarkdown(text: string): string {
  let patched = text;

  // Handle incomplete code blocks
  const codeBlockMatches = (patched.match(/```/g) || []).length;
  if (codeBlockMatches % 2 !== 0) {
    patched += "\n```";
  }

  // Handle incomplete lists
  const lines = patched.split("\n");
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (lastLine.match(/^\s*[-+*]\s+\S+.*$/) && !lastLine.endsWith("\n")) {
      patched += "\n";
    }
  }

  // Remove 4-space indents for non-code content
  let inCodeBlock = false;
  const processedLines: string[] = [];
  for (const line of patched.split("\n")) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
    } else if (!inCodeBlock && line.startsWith("    ")) {
      processedLines.push(line.substring(4));
    } else {
      processedLines.push(line);
    }
  }
  patched = processedLines.join("\n");

  return patched;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef<number>(messages.length);
  const lastMessageTextRef = useRef<string>("");
  const [stabilizedMessages, setStabilizedMessages] = useState<Message[]>([]);

  // Mock user data for demo
  const user = {
    imageUrl: "",
    fullName: "User",
  };

  // Stabilize messages for rendering during streaming
  useEffect(() => {
    const timer = setTimeout(() => {
      setStabilizedMessages(
        messages.map((msg) => ({
          ...msg,
          text: patchMarkdown(msg.text || ""),
        }))
      );
    }, 50);

    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Scroll to bottom on messages change
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [stabilizedMessages.length]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const isAtBottom =
      scrollContainerRef.current.scrollHeight -
        scrollContainerRef.current.scrollTop <=
      scrollContainerRef.current.clientHeight + 50;

    const lastMessage = stabilizedMessages[stabilizedMessages.length - 1];
    const isStreamingUpdate =
      isLoading &&
      lastMessage?.sender === "ai" &&
      lastMessage.text !== lastMessageTextRef.current;

    if (
      (isAtBottom &&
        (stabilizedMessages.length > lastMessageCountRef.current ||
          isStreamingUpdate)) ||
      isLoading
    ) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    lastMessageCountRef.current = stabilizedMessages.length;
    lastMessageTextRef.current = lastMessage?.text || "";
  }, [stabilizedMessages, isLoading]);

  const getMessageKey = (message: Message, index: number) => {
    return (
      message.tempId ||
      `${message.sender}-${message.timestamp?.getTime() || index}`
    );
  };

  const formatTime = (timestamp?: Date) => {
    if (!timestamp) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);
  };

  const LoadingIndicator = ({ text }: { text: string }) => (
    <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6 animate-in fade-in duration-300">
      <div className="relative">
        <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white shadow-sm">
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            <BrainCircuit size={12} className="sm:w-4 sm:h-4" />
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-pulse border-2 border-white" />
      </div>
      <div className="">
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-medium text-gray-700">
              {text}
            </span>
            <div className="flex gap-1">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce" />
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce delay-100" />
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce delay-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="space-y-3 sm:space-y-6 px-3 sm:px-6 md:px-3 sm:pb-24 md:pt-44 pt-52"
      role="log"
      aria-live="polite"
      ref={scrollContainerRef}
    >
      {stabilizedMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-3 sm:mb-4">
            <MessageCircle size={20} className="text-gray-400 sm:w-6 sm:h-6" />
          </div>
          <p className="text-gray-500 text-xs sm:text-sm">
            No messages yet. Start the conversation!
          </p>
        </div>
      ) : (
        stabilizedMessages.map((message, index) => {
          if (!message.sender) {
            console.warn("Malformed message at index", index, message);
            return (
              <div
                key={getMessageKey(message, index)}
                className="flex justify-center"
              >
                <Badge variant="destructive" className="text-xs">
                  Error: Malformed message
                </Badge>
              </div>
            );
          }

          if (message.sender === "ai" && !message.text) {
            return (
              <div
                key={getMessageKey(message, index)}
                className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6"
              >
                <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <BrainCircuit size={12} className="sm:w-4 sm:h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            );
          }

          if (!message.text) {
            return (
              <div
                key={getMessageKey(message, index)}
                className="flex justify-center"
              >
                <Badge variant="destructive" className="text-xs">
                  Error: Malformed message
                </Badge>
              </div>
            );
          }

          const isUser = message.sender === "user";
          const isConsecutive =
            index > 0 &&
            stabilizedMessages[index - 1]?.sender === message.sender;

          return (
            <div
              key={getMessageKey(message, index)}
              className={`flex items-end gap-2 sm:gap-3 animate-in fade-in duration-300 ${
                isUser ? "justify-end" : "justify-start"
              }`}
            >
              {!isUser && (
                <div className="flex flex-col items-center">
                  <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      <BrainCircuit size={12} className="sm:w-4 sm:h-4" />
                    </AvatarFallback>
                  </Avatar>
                  {message.timestamp && (
                    <span className="text-xs text-gray-400 mt-1 hidden sm:block">
                      {formatTime(message.timestamp)}
                    </span>
                  )}
                </div>
              )}

              <div
                className={`max-w-[75%] sm:max-w-[75%] group ${
                  isConsecutive ? "mt-1" : "mt-0"
                }`}
              >
                <div
                  className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm transition-all duration-200 hover:shadow-md ${
                    isUser
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      : "bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-800"
                  }`}
                  role="article"
                  aria-label={isUser ? "User message" : "AI message"}
                >
                  <div
                    className={`prose prose-xs sm:prose-sm max-w-none ${
                      isUser ? "prose-invert" : ""
                    } [&_p]:mb-1 sm:[&_p]:mb-2 [&_p:last-child]:mb-0`}
                  >
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            className={`${
                              isUser
                                ? "text-blue-200 hover:text-blue-100"
                                : "text-blue-600 hover:text-blue-700"
                            } underline transition-colors`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                        code: ({ children, className }) => (
                          <code
                            className={`${
                              isUser
                                ? "bg-white/20 text-blue-100"
                                : "bg-gray-100 text-gray-800"
                            } px-1 py-0.5 sm:px-1.5 sm:py-0.5 rounded text-xs sm:text-sm font-mono`}
                          >
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre
                            className={`${
                              isUser
                                ? "bg-white/20 border-white/30"
                                : "bg-gray-100 border-gray-200"
                            } border rounded-lg p-2 sm:p-3 overflow-x-auto text-xs sm:text-sm`}
                          >
                            {children}
                          </pre>
                        ),
                      }}
                    >
                      {message.text}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {isUser && (
                <div className="flex flex-col items-center">
                  <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white shadow-sm">
                    <AvatarImage
                      src={user?.imageUrl || ""}
                      alt={user?.fullName || "User"}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white">
                      {user?.fullName?.charAt(0) || (
                        <User size={12} className="sm:w-4 sm:h-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {message.timestamp && (
                    <span className="text-xs text-gray-400 mt-1 hidden sm:block">
                      {formatTime(message.timestamp)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Enhanced loading indicators */}
      {typeof isLoading === "string" && isLoading === "observer" && (
        <LoadingIndicator text="Thinking" />
      )}
      {typeof isLoading === "string" && isLoading === "generating" && (
        <LoadingIndicator text="Generating" />
      )}
      {typeof isLoading === "string" && isLoading === "streaming" && (
        <LoadingIndicator text="Responding" />
      )}

      <div ref={endOfMessagesRef} aria-hidden="true" />
    </div>
  );
}
