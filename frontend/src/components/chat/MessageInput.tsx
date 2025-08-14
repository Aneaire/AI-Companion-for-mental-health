import { Send } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function MessageInput({
  onSendMessage,
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  return (
    <div className="w-full mx-auto bg-white/50 backdrop-blur-sm">
      <div className="relative">
        <div className="flex items-end gap-2 p-2 sm:p-3 bg-white rounded-lg border border-gray-200 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all duration-200">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 min-h-[36px] sm:min-h-[40px] max-h-24 sm:max-h-32 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm sm:text-base"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <Button
            onClick={handleSubmit}
            disabled={disabled || !message.trim()}
            size="sm"
            className="shrink-0 h-8 sm:h-9 px-2 sm:px-3"
          >
            <div className="flex items-center">
              <Send size={14} className="mr-1 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Send</span>
            </div>
          </Button>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500 text-center px-2">
        Press Enter to send, Shift+Enter for a new line
      </div>
    </div>
  );
}
