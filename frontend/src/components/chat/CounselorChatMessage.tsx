import { User } from "lucide-react";
import type { CounselorMessage, CounselorChat } from "@/types/counselor";
import { formatRelativeTime } from "@/lib/utils";

interface CounselorChatMessageProps {
  message: CounselorMessage;
  previousMessage?: CounselorMessage;
  selectedChat: CounselorChat;
}

export function CounselorChatMessage({ 
  message, 
  previousMessage, 
  selectedChat 
}: CounselorChatMessageProps) {
  const isUser = message.senderType === "user";
  const isConsecutive = previousMessage?.senderType === message.senderType;

  const getMessagePosition = () => {
    return isUser ? "justify-start" : "justify-end";
  };

  const getMessageStyling = () => {
    return isUser 
      ? "bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-800"
      : "bg-gradient-to-r from-blue-600 to-purple-600 text-white";
  };

  const getAvatar = () => {
    if (isUser) {
      return (
        <div className="flex flex-col items-center">
          <div className={`w-6 h-6 md:w-8 md:h-8 border-2 border-white shadow-sm rounded-full overflow-hidden flex items-center justify-center ${
            selectedChat.user?.profileImageUrl
              ? ""
              : "bg-gradient-to-br from-blue-500 to-purple-600"
          }`}>
            {selectedChat.user?.profileImageUrl ? (
              <img
                src={selectedChat.user.profileImageUrl}
                alt="Profile"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <User size={12} className="text-white md:w-4 md:h-4" />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 md:w-8 md:h-8 border-2 border-white shadow-sm rounded-full overflow-hidden bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
          <User size={12} className="text-white md:w-4 md:h-4" />
        </div>
      </div>
    );
  };

  const getTimestampColor = () => {
    return isUser ? "text-gray-500" : "text-blue-100";
  };

  const getAriaLabel = () => {
    return isUser ? "User message" : "Admin/Counselor message";
  };

  return (
    <div
      className={`flex items-end gap-2 md:gap-3 animate-in fade-in duration-300 ${
        getMessagePosition()
      } ${isConsecutive ? "mt-1" : "mt-2"}`}
    >
      {isUser && getAvatar()}
      
      <div className={`max-w-[75%] sm:max-w-[70%] md:max-w-[65%] lg:max-w-[55%] group relative ${isConsecutive ? "mt-1" : "mt-0"}`}>
        <div
          className={`rounded-xl px-3 py-2 md:px-4 md:py-2.5 shadow-sm transition-all duration-200 hover:shadow-md ${
            getMessageStyling()
          }`}
          role="article"
          aria-label={getAriaLabel()}
        >
          <div className={`prose prose-sm md:prose-base max-w-none ${!isUser ? "prose-invert" : ""} [&_p]:mb-1.5 md:[&_p]:mb-2 [&_p:last-child]:mb-0`}>
            <p className="text-sm md:text-base leading-relaxed">{message.message}</p>
          </div>
          <p className={`text-xs mt-1 ${getTimestampColor()}`}>
            {formatRelativeTime(message.timestamp)}
          </p>
        </div>
      </div>

      {!isUser && getAvatar()}
    </div>
  );
}