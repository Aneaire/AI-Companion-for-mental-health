import {
  Bot,
  ChevronDown,
  ChevronUp,
  Info,
  Loader,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import { Alert, AlertDescription } from "../ui/alert";

const availableModels = [
  {
    id: "gemini-2-flash",
    name: "Gemini 2.0 Flash",
    icon: <Sparkles size={16} className="text-purple-600" />,
  },
  {
    id: "gemini-2-5-flash",
    name: "Gemini 2.5 Flash",
    icon: <Sparkles size={16} className="text-purple-600" />,
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    icon: <Bot size={16} className="text-red-600" />,
  },
  {
    id: "claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    icon: <Bot size={16} className="text-red-600" />,
  },
  {
    id: "gpt-4-1",
    name: "GPT-4.1",
    icon: <Bot size={16} className="text-green-600" />,
  },
];

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function MessageInput({
  onSendMessage,
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(availableModels[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const toggleModelDropdown = () => {
    setIsModelDropdownOpen(!isModelDropdownOpen);
  };

  const selectModel = (model: {
    id: string;
    name: string;
    icon: JSX.Element;
  }) => {
    setSelectedModel(model);
    setIsModelDropdownOpen(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      <div className="flex justify-end items-end my-2">
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
          {/* Model selector button */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={toggleModelDropdown}
              className="flex items-center gap-1 px-3 py-2 ml-2 text-sm rounded-md text-gray-700 hover:bg-gray-100 transition-colors duration-200"
            >
              <span className="flex items-center gap-1">
                {selectedModel.icon}
                <span className="max-w-24 truncate hidden sm:inline">
                  {selectedModel.name}
                </span>
              </span>
              {isModelDropdownOpen ? (
                <ChevronUp size={16} className="text-gray-700" />
              ) : (
                <ChevronDown size={16} className="text-gray-700" />
              )}
            </button>

            {/* Model dropdown */}
            {isModelDropdownOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden z-50">
                <div className="max-h-72 overflow-y-auto py-1">
                  {availableModels.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => selectModel(model)}
                      className={`flex items-center gap-2 w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                        selectedModel.id === model.id ? "bg-gray-100" : ""
                      }`}
                    >
                      {model.icon}
                      <span className="text-gray-700">{model.name}</span>
                      {selectedModel.id === model.id && (
                        <span className="ml-auto text-purple-600 text-xs font-medium">
                          Selected
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300 mx-2"></div>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none py-3 px-2 max-h-48 resize-none text-gray-900"
            style={{ height: "auto" }}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={disabled}
            className={`flex items-center justify-center p-2 mr-2 rounded-md ${
              message.trim()
                ? "text-white bg-purple-600 hover:bg-purple-700"
                : "text-gray-400 bg-gray-200 cursor-not-allowed opacity-50"
            } transition-colors duration-200`}
          >
            {!disabled ? (
              <Send size={18} />
            ) : (
              <div className="flex items-center justify-center">
                <Loader size={18} className="animate-spin" />
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-2 text-center">
        {selectedModel.name} • Press Enter to send, Shift+Enter for a new line
      </div>
    </div>
  );
}
