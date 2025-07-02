import { Info, Send, Play, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

interface ImpersonateInputProps {
  onSendMessage: (message: string) => void;
  onStartImpersonation: () => void;
  onStopImpersonation: () => void;
  disabled?: boolean;
  isImpersonating?: boolean;
}

export default function ImpersonateInput({
  onSendMessage,
  onStartImpersonation,
  onStopImpersonation,
  disabled = false,
  isImpersonating = false,
}: ImpersonateInputProps) {
  const [message, setMessage] = useState("");
  const [isImpersonateMode, setIsImpersonateMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (isImpersonateMode) {
      if (isImpersonating) {
        onStopImpersonation();
      } else {
        onStartImpersonation();
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

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      <div className="flex justify-between items-center my-2">
        <Alert variant="default" className="py-1 px-2 bg-amber-50 border-amber-100 w-fit">
          <AlertDescription className="text-xs text-amber-800 flex items-center gap-1">
            <Info size={10} className="text-amber-600" />
            {isImpersonateMode 
              ? "Impersonation mode: AI will roleplay as the patient"
              : "Chat mode: You can send messages directly"
            }
          </AlertDescription>
        </Alert>
        
        <div className="flex items-center space-x-2">
          <Label htmlFor="impersonate-mode" className="text-sm font-medium">
            Impersonate
          </Label>
          <Switch
            id="impersonate-mode"
            checked={isImpersonateMode}
            onCheckedChange={setIsImpersonateMode}
            disabled={disabled}
          />
        </div>
      </div>
      
      <div className="relative">
        <div className="relative flex items-center bg-white rounded-lg shadow border border-gray-300 focus-within:border-purple-500 transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isImpersonateMode 
                ? "Click Start to begin impersonation conversation..."
                : "Message..."
            }
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none py-3 px-4 max-h-48 resize-none text-gray-900"
            rows={1}
            disabled={disabled || isImpersonateMode}
          />

          <Button
            onClick={handleSubmit}
            disabled={disabled || (!isImpersonateMode && !message.trim())}
            className="mr-2 rounded-md"
            size="sm"
          >
            {isImpersonateMode ? (
              isImpersonating ? <Square size={18} /> : <Play size={18} />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
