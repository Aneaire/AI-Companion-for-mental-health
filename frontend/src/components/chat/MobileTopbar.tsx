import { Button } from "@/components/ui/button";
import type { ConversationPreferences } from "@/stores/chatStore";
import { Menu, Settings, Radio, MessageSquare } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { ConversationPreferencesDialog } from "./ConversationPreferencesDialog";

interface MobileTopbarProps {
  onMenuClick: () => void;
  preferences: ConversationPreferences;
  onPreferencesChange: (preferences: ConversationPreferences) => void;
  isImpersonatePage?: boolean;
}

export function MobileTopbar({
  onMenuClick,
  preferences,
  onPreferencesChange,
  isImpersonatePage = false,
}: MobileTopbarProps): JSX.Element {
  const [prefsOpen, setPrefsOpen] = useState(false);

  const handlePodcastToggle = () => {
    onPreferencesChange({
      ...preferences,
      podcastMode: !preferences?.podcastMode,
    });
  };

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
      <div className="flex items-center gap-1">
        {isImpersonatePage && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePodcastToggle}
            className={`${
              preferences?.podcastMode
                ? "text-purple-600 bg-purple-100/50"
                : "text-gray-600"
            }`}
            aria-label={
              preferences?.podcastMode
                ? "Switch to Chat View"
                : "Switch to Podcast View"
            }
          >
            {preferences?.podcastMode ? (
              <MessageSquare className="h-5 w-5" />
            ) : (
              <Radio className="h-5 w-5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPrefsOpen(true)}
          aria-label="Conversation Preferences"
        >
          <Settings className="h-6 w-6 text-gray-700" />
        </Button>
      </div>
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

