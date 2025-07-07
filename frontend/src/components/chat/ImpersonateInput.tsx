import { Info, Play, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

interface ImpersonateInputProps {
  mode: "impersonate" | "chat";
  onModeChange: (mode: "impersonate" | "chat") => void;
  isImpersonating: boolean;
  onStart: () => void;
  onStop: () => void;
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  hideModeSwitch?: boolean;
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

  const isButtonDisabled = () => {
    if (disabled) return true;
    if (mode === "impersonate") {
      return pendingStart;
    } else {
      return !message.trim();
    }
  };

  const getStatusBadge = () => {
    if (mode === "impersonate") {
      if (isImpersonating) {
        return (
          <Badge variant="destructive" className="text-xs">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-1" />
            Active
          </Badge>
        );
      }
      if (pendingStart) {
        return (
          <Badge variant="secondary" className="text-xs">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1" />
            Starting...
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="text-xs">
          Ready
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="w-full mx-auto p-3 sm:p-4 bg-white/50 backdrop-blur-sm border-t border-gray-200/60">
      {/* Mode Info and Switch - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-3 sm:gap-0">
        <div className="md:flex hidden items-center gap-2 sm:gap-3 ">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-gray-500 sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm text-gray-700">
              {mode === "impersonate" ? "AI Roleplay Mode" : "Direct Chat Mode"}
            </span>
          </div>
          {getStatusBadge()}
        </div>

        {!hideModeSwitch && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs sm:text-sm text-gray-600">Chat</span>
            <Switch
              checked={mode === "impersonate"}
              onCheckedChange={(checked) =>
                onModeChange(checked ? "impersonate" : "chat")
              }
              disabled={disabled || isImpersonating}
            />
            <span className="text-xs sm:text-sm text-gray-600">Roleplay</span>
          </div>
        )}
      </div>

      {/* Input Area - Mobile Optimized */}
      <div className="relative">
        <div className="flex items-end gap-2 p-2 sm:p-3 bg-white rounded-lg border border-gray-200 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all duration-200">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              mode === "impersonate"
                ? isImpersonating
                  ? "AI is impersonating..."
                  : "Click Start to begin roleplay"
                : "Type your message..."
            }
            className="flex-1 min-h-[36px] sm:min-h-[40px] max-h-24 sm:max-h-32 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm sm:text-base"
            disabled={mode === "impersonate"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <Button
            onClick={handleSubmit}
            disabled={isButtonDisabled()}
            size="sm"
            variant={
              mode === "impersonate" && isImpersonating
                ? "destructive"
                : "default"
            }
            className="shrink-0 h-8 sm:h-9 px-2 sm:px-3"
          >
            {mode === "impersonate" ? (
              isImpersonating ? (
                <div className="text-white flex items-center justify-center">
                  <Square size={14} className="mr-1 text-white sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm">Stop</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <Play size={14} className="mr-1 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm">Start</span>
                </div>
              )
            ) : (
              <div className="flex items-center">
                <Send size={14} className="mr-1 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Send</span>
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Helper Text - Desktop */}
      <div className="mt-2 text-xs text-gray-500 text-center px-2 hidden md:block">
        {mode === "impersonate"
          ? isImpersonating
            ? "AI is actively roleplaying. Press Stop to end the session."
            : "Start an AI-to-AI roleplay conversation where the AI plays the patient role."
          : "Press Enter to send your message, or Shift+Enter for a new line."}
      </div>
      {/* Helper Text - Mobile */}
      <div className="mt-2 text-xs text-gray-500 text-center px-2 block md:hidden">
        {mode === "impersonate"
          ? isImpersonating
            ? "AI is roleplaying. Press Stop."
            : "Start AI-to-AI roleplay (AI as patient)."
          : "Enter: send. Shift+Enter: new line."}
      </div>
    </div>
  );
}
