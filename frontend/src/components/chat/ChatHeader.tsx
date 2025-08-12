import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConversationPreferences } from "@/stores/chatStore";
import { BrainCircuit, Settings, Sparkles } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { ThreadSettingsDialog } from "./ThreadSettingsDialog";

interface ChatHeaderProps {
  preferences: ConversationPreferences;
  onPreferencesChange: (preferences: ConversationPreferences) => void;
  selectedThreadId?: number | null;
  threadTitle?: string;
  onDeleteThread?: (threadId: number) => void;
  onArchiveThread?: (threadId: number) => void;
}

export function ChatHeader({
  preferences,
  onPreferencesChange,
  selectedThreadId,
  threadTitle,
  onDeleteThread,
  onArchiveThread,
}: ChatHeaderProps): JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className="relative overflow-hidden bg-white/90 backdrop-blur-sm border-b border-gray-200/60">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 via-white/50 to-purple-50/50" />

        <div className="relative z-10 flex items-center justify-between px-6 py-4">
          {/* Left side - Brand */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                <BrainCircuit size={24} className="text-white" />
              </div>
              {/* Active indicator */}
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm">
                <div className="w-full h-full bg-green-400 rounded-full animate-pulse" />
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  AI Companion
                </h1>
                <Badge variant="outline" className="text-xs">
                  <Sparkles size={10} className="mr-1" />
                  Active
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                Your intelligent healthcare support assistant
              </p>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings size={16} className="mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      <ThreadSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedThreadId={selectedThreadId}
        threadTitle={threadTitle}
        preferences={preferences}
        onPreferencesChange={onPreferencesChange}
        onDeleteThread={onDeleteThread}
        onArchiveThread={onArchiveThread}
      />
    </>
  );
}

export default ChatHeader;
