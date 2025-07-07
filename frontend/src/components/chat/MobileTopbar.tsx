import { Button } from "@/components/ui/button";
import type { ConversationPreferences } from "@/stores/chatStore";
import { Menu, Settings } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { ConversationPreferencesDialog } from "./ConversationPreferencesDialog";

interface MobileTopbarProps {
  onMenuClick: () => void;
  preferences: ConversationPreferences;
  onPreferencesChange: (preferences: ConversationPreferences) => void;
}

export function MobileTopbar({
  onMenuClick,
  preferences,
  onPreferencesChange,
}: MobileTopbarProps): JSX.Element {
  const [prefsOpen, setPrefsOpen] = useState(false);
  return (
    <div className="flex items-center justify-between px-4 bg-white border-b border-gray-200 md:hidden shadow-sm z-30 sticky top-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6 text-gray-700" />
      </Button>
      <span className="font-semibold text-lg text-gray-800">AI Chat</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setPrefsOpen(true)}
        aria-label="Conversation Preferences"
      >
        <Settings className="h-6 w-6 text-gray-700" />
      </Button>
      <ConversationPreferencesDialog
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        preferences={preferences}
        onPreferencesChange={onPreferencesChange}
      />
    </div>
  );
}

export default MobileTopbar;
