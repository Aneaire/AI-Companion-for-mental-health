import { Button } from "@/components/ui/button";
import type { ConversationPreferences } from "@/stores/chatStore";
import { BrainCircuit, Settings } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { ConversationPreferencesDialog } from "./ConversationPreferencesDialog";

interface ChatHeaderProps {
  preferences: ConversationPreferences;
  onPreferencesChange: (preferences: ConversationPreferences) => void;
}

export function ChatHeader({
  preferences,
  onPreferencesChange,
}: ChatHeaderProps): JSX.Element {
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 shadow text-white rounded-t-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20">
            <BrainCircuit size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Companion</h1>
            <p className="text-sm opacity-80">
              You're chatting with your AI support companion
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={() => setIsPreferencesOpen(true)}
          title="Conversation Preferences"
        >
          <Settings size={20} />
        </Button>
      </header>

      <ConversationPreferencesDialog
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        preferences={preferences}
        onPreferencesChange={onPreferencesChange}
      />
    </>
  );
}

export default ChatHeader;
