import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Message } from "@/types/chat";
import { useUser } from "@clerk/clerk-react";
import { BrainCircuit } from "lucide-react";
import { useEffect, useRef, type JSX } from "react";
import ReactMarkdown from "react-markdown";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean; // Added to detect streaming
}

export function MessageList({
  messages,
  isLoading,
}: MessageListProps): JSX.Element {
  const { user } = useUser();
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef<number>(messages.length);
  const lastMessageTextRef = useRef<string>("");

  // Debug: Log messages
  useEffect(() => {
    console.log("MessageList received messages:", messages);
  }, [messages]);

  // Auto-scroll during streaming or new messages
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const isAtBottom =
      scrollContainerRef.current.scrollHeight -
        scrollContainerRef.current.scrollTop <=
      scrollContainerRef.current.clientHeight + 50;

    const lastMessage = messages[messages.length - 1];
    const isStreamingUpdate =
      isLoading &&
      lastMessage?.sender === "ai" &&
      lastMessage.text !== lastMessageTextRef.current;

    if (
      (isAtBottom &&
        (messages.length > lastMessageCountRef.current || isStreamingUpdate)) ||
      isLoading
    ) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    lastMessageCountRef.current = messages.length;
    lastMessageTextRef.current = lastMessage?.text || "";
  }, [messages, isLoading]);

  const getMessageKey = (message: Message, index: number) => {
    return (
      message.tempId ||
      `${message.sender}-${message.timestamp?.getTime() || index}`
    );
  };

  return (
    <div
      className="space-y-4 p-4 pb-20"
      role="log"
      aria-live="polite"
      ref={scrollContainerRef}
    >
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 text-sm">
          No messages yet. Start the conversation!
        </div>
      ) : (
        messages.map((message, index) => {
          if (!message.sender || !message.text) {
            console.warn("Malformed message at index", index, message);
            return (
              <div
                key={getMessageKey(message, index)}
                className="text-center text-red-500 text-sm"
              >
                [Error: Malformed message]
              </div>
            );
          }
          return (
            <div
              key={getMessageKey(message, index)}
              className={`flex items-end gap-2 animate-in fade-in duration-300 ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.sender === "ai" && (
                <Avatar className="size-8 flex-shrink-0">
                  <AvatarFallback className="bg-indigo-100 text-indigo-600">
                    <BrainCircuit size={20} />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[70%] rounded-2xl p-3 shadow-sm transition-all duration-200 ${
                  message.sender === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-50 border border-gray-200 text-gray-800"
                }`}
                role="article"
                aria-label={
                  message.sender === "user" ? "User message" : "AI message"
                }
              >
                <div className="prose prose-sm max-w-none [&_p]:mb-0">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="text-blue-500 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {message.text || "[Empty message]"}
                  </ReactMarkdown>
                </div>
              </div>
              {message.sender === "user" && (
                <Avatar className="size-8 flex-shrink-0">
                  <AvatarImage
                    src={user?.imageUrl || ""}
                    alt={user?.fullName || "User"}
                  />
                  <AvatarFallback className="bg-indigo-100 text-indigo-600">
                    {user?.fullName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })
      )}
      {isLoading && (
        <div className="flex justify-start gap-2 p-3">
          <Avatar className="size-8 flex-shrink-0">
            <AvatarFallback className="bg-indigo-100 text-indigo-600">
              <BrainCircuit size={20} />
            </AvatarFallback>
          </Avatar>
          <div className="flex space-x-1 items-center bg-gray-50 border border-gray-200 rounded-2xl p-3">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
          </div>
        </div>
      )}
      <div ref={endOfMessagesRef} aria-hidden="true" />
    </div>
  );
}
