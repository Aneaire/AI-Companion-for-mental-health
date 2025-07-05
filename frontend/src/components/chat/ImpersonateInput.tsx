import { Info, Play, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Switch } from "../ui/switch";

interface ImpersonateInputProps {
  mode: "impersonate" | "chat";
  onModeChange: (mode: "impersonate" | "chat") => void;
  isImpersonating: boolean;
  onStart: () => void;
  onStop: () => void;
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  hideModeSwitch?: boolean; // NEW PROP
}

export function ImpersonateInput({
  mode,
  onModeChange,
  isImpersonating,
  onStart,
  onStop,
  onSendMessage,
  disabled,
  hideModeSwitch,
}: ImpersonateInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingStart, setPendingStart] = useState(false);

  useEffect(() => {
    if (isImpersonating) setPendingStart(false);
  }, [isImpersonating]);

  const handleSubmit = () => {
    if (mode === "impersonate") {
      if (isImpersonating || pendingStart) {
        console.log("ImpersonateInput: Stop button clicked");
        onStop();
      } else {
        console.log("ImpersonateInput: Start button clicked");
        setPendingStart(true);
        onStart();
      }
    } else {
      if (message.trim()) {
        onSendMessage(message.trim());
        setMessage("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  };

  // Fixed button disabled logic
  const isButtonDisabled = () => {
    if (disabled) return true;

    if (mode === "impersonate") {
      // In impersonate mode, button is disabled if pendingStart
      return pendingStart;
    } else {
      // In chat mode, button is disabled if no message
      return !message.trim();
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
            {mode === "impersonate"
              ? "Impersonation mode: AI will roleplay as the patient"
              : "Chat mode: You can send messages directly"}
          </AlertDescription>
        </Alert>
        {!hideModeSwitch && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-700">
              Impersonate
            </span>
            <Switch
              checked={mode === "impersonate"}
              onCheckedChange={(checked) =>
                onModeChange(checked ? "impersonate" : "chat")
              }
              disabled={disabled || isImpersonating}
            />
          </div>
        )}
      </div>
      <div className="relative">
        <div className="relative flex items-center bg-white rounded-lg shadow border border-gray-300 focus-within:border-purple-500 transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              mode === "impersonate"
                ? isImpersonating
                  ? "Impersonating..."
                  : "Click Start to begin impersonation conversation..."
                : "Message..."
            }
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none py-3 px-4 max-h-48 resize-none text-gray-900"
            style={{ height: "auto" }}
            rows={1}
            disabled={mode === "impersonate"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <button
            onClick={() => {
              console.log("Button clicked");
              handleSubmit();
            }}
            disabled={isButtonDisabled()}
            className={`flex items-center justify-center p-2 mr-2 rounded-md transition-colors duration-200
              ${
                mode === "impersonate"
                  ? isImpersonating
                    ? "text-white bg-red-500 hover:bg-red-600"
                    : "text-white bg-purple-600 hover:bg-purple-700"
                  : message.trim()
                    ? "text-white bg-purple-600 hover:bg-purple-700"
                    : "text-gray-400 bg-gray-200 cursor-not-allowed opacity-50"
              }
            `}
          >
            {mode === "impersonate" ? (
              isImpersonating ? (
                <Square size={18} />
              ) : (
                <Play size={18} />
              )
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-2 text-center">
        {mode === "impersonate"
          ? isImpersonating
            ? "Impersonation running... Press Stop to end."
            : "Press Start to begin AI-to-AI conversation."
          : "Press Enter to send, Shift+Enter for a new line"}
      </div>
    </div>
  );
}
