import { Info, Send } from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";

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
    <div className="w-full max-w-4xl mx-auto relative">
      <div className="flex justify-between items-center my-2">
        <Alert
          variant="default"
          className="py-1 px-2 bg-amber-50 border-amber-100 w-fit"
        >
          <AlertDescription className="text-xs text-amber-800 flex items-center gap-1">
            <Info size={10} className="text-amber-600" />
            This is an AI assistant, not a replacement for professional mental
            health care
          </AlertDescription>
        </Alert>
      </div>
      <div className="relative">
        <div className="relative flex items-center bg-white rounded-lg shadow border border-gray-300 focus-within:border-purple-500 transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none py-3 px-4 max-h-48 resize-none text-gray-900"
            style={{ height: "auto" }}
            rows={1}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <button
            onClick={handleSubmit}
            disabled={disabled || !message.trim()}
            className={`flex items-center justify-center p-2 mr-2 rounded-md ${
              message.trim()
                ? "text-white bg-purple-600 hover:bg-purple-700"
                : "text-gray-400 bg-gray-200 cursor-not-allowed opacity-50"
            } transition-colors duration-200`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-2 text-center">
        Press Enter to send, Shift+Enter for a new line
      </div>
    </div>
  );
}
