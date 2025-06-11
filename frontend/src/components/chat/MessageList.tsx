// components/MessageList.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MentalHealthConcern, Message } from "@/types/chat";
import { useUser } from "@clerk/clerk-react";
import { BrainCircuit } from "lucide-react";
import type { JSX } from "react";

interface MessageListProps {
  messages: Message[];
  selectedConcern: MentalHealthConcern | null;
}

import { useEffect, useRef } from "react";
// ... other imports

export function MessageList({
  messages,
  selectedConcern,
}: MessageListProps): JSX.Element {
  const data = useUser();
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto mb-3 space-y-3 md:p-2 px-0 py-2">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} mb-2`}
        >
          {message.sender === "ai" && (
            <Avatar className="mr-1 mt-1 size-10">
              <AvatarFallback
                className={`${selectedConcern?.iconColor || "text-indigo-500"} bg-white text-xs`}
              >
                <BrainCircuit size={25} />
              </AvatarFallback>
            </Avatar>
          )}

          <div
            className={`max-w-3/4 rounded-lg px-3 py-2 shadow-sm md:text-base text-sm bg-indigo-600 ${
              message.sender === "user"
                ? `${selectedConcern ? selectedConcern.iconColor.replace("text", "bg") : "bg-indigo-600"} text-white`
                : "bg-white border border-gray-100 text-gray-800"
            }`}
          >
            {message.text}
          </div>

          {message.sender === "user" && (
            <Avatar className="ml-1 mt-1 size-10">
              <AvatarImage src={data.user?.imageUrl} />
            </Avatar>
          )}
        </div>
      ))}
      {/* 👇 Add this dummy div to scroll into view */}
      <div ref={endOfMessagesRef} />
    </div>
  );
}
