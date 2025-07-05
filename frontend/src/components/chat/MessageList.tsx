import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Message } from "@/types/chat";
import { useUser } from "@clerk/clerk-react";
import { BrainCircuit } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import ReactMarkdown from "react-markdown";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean | "idle" | "observer" | "generating" | "streaming";
}

// Enhanced patchMarkdown to handle more streaming edge cases
export function patchMarkdown(text: string): string {
  let patched = text;

  // Handle incomplete code blocks
  // Check for an odd number of triple backticks
  const codeBlockMatches = (patched.match(/```/g) || []).length;
  if (codeBlockMatches % 2 !== 0) {
    patched += "\n```"; // Close the code block
  }

  // Handle incomplete lists: if a list item is the very last line and doesn't end with a newline, add one.
  // This is crucial for ReactMarkdown to render subsequent text on a new line.
  const lines = patched.split("\n");
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    // Check if it looks like an incomplete list item
    if (lastLine.match(/^\s*[-+*]\s+\S+.*$/) && !lastLine.endsWith("\n")) {
      patched += "\n";
    }
  }

  // Remove 4-space indents for non-code content that might arise from incorrect pasting
  // or partial markdown rendering. Be careful not to remove indents inside code blocks.
  let inCodeBlock = false;
  const processedLines: string[] = [];
  for (const line of patched.split("\n")) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
    } else if (!inCodeBlock && line.startsWith("    ")) {
      processedLines.push(line.substring(4)); // Remove 4 spaces
    } else {
      processedLines.push(line);
    }
  }
  patched = processedLines.join("\n");

  // Handle incomplete tables: if a line looks like a table row but no header/delimiter is present
  // This is a more complex heuristic and might be over-aggressive.
  // Consider if Gemini consistently provides tables with headers first.
  // If not, this might need more sophisticated parsing or be removed if it causes issues.
  // For now, let's keep it simple: if it's an unclosed table row.
  if (patched.match(/^\|.*\|.*$/m) && !patched.match(/^\|[-:\s|]+$/m)) {
    // This is a very rough heuristic. It assumes a table is starting and needs a delimiter.
    // Better to rely on the source providing complete tables.
    // If you see actual issues with tables, this part needs more robust logic.
    // For now, removing this can prevent false positives if the source already provides valid markdown.
    // patched += "\n| --- | --- |\n";
  }

  // Trim trailing whitespace to avoid rendering artifacts, but preserve a single trailing newline if present,
  // as it's often significant for markdown block elements.
  return patched;
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
  // State to stabilize streamed text for rendering
  const [stabilizedMessages, setStabilizedMessages] = useState<Message[]>([]);

  // Stabilize messages for rendering during streaming
  useEffect(() => {
    const timer = setTimeout(() => {
      setStabilizedMessages(
        messages.map((msg) => ({
          ...msg,
          text: patchMarkdown(msg.text || ""),
        }))
      );
    }, 50); // Debounce to avoid rapid re-renders

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

  return (
    <div
      className="space-y-4 p-4 md:px-4 px-0.5 pt-44"
      role="log"
      aria-live="polite"
      ref={scrollContainerRef}
    >
      {stabilizedMessages.length === 0 ? (
        <div className="text-center text-gray-500 text-sm">
          No messages yet. Start the conversation!
        </div>
      ) : (
        stabilizedMessages.map((message, index) => {
          if (!message.sender) {
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
          if (message.sender === "ai" && !message.text) {
            return (
              <div
                key={getMessageKey(message, index)}
                className="flex items-center gap-2 p-3"
              >
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
            );
          }
          if (!message.text) {
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
                    {message.text}
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

      {/* Enhanced loading indicators for smooth transition */}
      {typeof isLoading === "string" && isLoading === "observer" && (
        <div className="flex justify-start gap-2 p-3 animate-fade-in">
          <Avatar className="size-8 flex-shrink-0">
            <AvatarFallback className="bg-indigo-100 text-indigo-600">
              <BrainCircuit size={20} />
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-3 shadow-sm">
            <span className="text-gray-500 text-sm font-medium">
              Thinking...
            </span>
            <div className="ml-2 flex space-x-1 items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        </div>
      )}
      {typeof isLoading === "string" && isLoading === "generating" && (
        <div className="flex justify-start gap-2 p-3 animate-fade-in">
          <Avatar className="size-8 flex-shrink-0">
            <AvatarFallback className="bg-indigo-100 text-indigo-600">
              <BrainCircuit size={20} />
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-3 shadow-sm">
            <span className="text-gray-500 text-sm font-medium">
              Generating...
            </span>
            <div className="ml-2 flex space-x-1 items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        </div>
      )}
      <div ref={endOfMessagesRef} aria-hidden="true" />
    </div>
  );
}
