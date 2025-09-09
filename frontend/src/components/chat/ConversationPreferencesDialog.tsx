import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ConversationPreferences } from "@/stores/chatStore";
import { Settings } from "lucide-react";
import { useState } from "react";

interface ConversationPreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: ConversationPreferences;
  onPreferencesChange: (preferences: ConversationPreferences) => void;
}

export function ConversationPreferencesDialog({
  isOpen,
  onClose,
  preferences,
  onPreferencesChange,
}: ConversationPreferencesDialogProps) {
  const [localPreferences, setLocalPreferences] =
    useState<ConversationPreferences>(preferences);

  const handleCheckboxChange = (
    key: keyof ConversationPreferences,
    checked: boolean
  ) => {
    const newPreferences = { ...localPreferences, [key]: checked };
    setLocalPreferences(newPreferences);
  };

  const handleSave = () => {
    onPreferencesChange(localPreferences);
    onClose();
  };

  const handleCancel = () => {
    setLocalPreferences(preferences);
    onClose();
  };

  const preferenceOptions = [
    {
      key: "briefAndConcise" as const,
      label: "Brief & Concise",
      description: "Keep responses short and to the point",
      icon: "⚡",
    },
    {
      key: "empatheticAndSupportive" as const,
      label: "Empathetic & Supportive",
      description: "Show understanding and emotional support",
      icon: "💝",
    },
    {
      key: "solutionFocused" as const,
      label: "Solution Focused",
      description: "Prioritize practical solutions and advice",
      icon: "🎯",
    },
    {
      key: "casualAndFriendly" as const,
      label: "Casual & Friendly",
      description: "Use a relaxed, conversational tone",
      icon: "😊",
    },
    {
      key: "professionalAndFormal" as const,
      label: "Professional & Formal",
      description: "Maintain a formal, clinical approach",
      icon: "👔",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white/95 backdrop-blur-xl border-0 shadow-2xl">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
              <Settings size={20} className="text-white" />
            </div>
            Conversation Preferences
          </DialogTitle>
          <DialogDescription className="text-gray-600 leading-relaxed">
            Customize how the AI responds to your messages. These preferences
            will apply to both therapist and impersonation modes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-6">
          {preferenceOptions.map((option) => (
            <div key={option.key} className="group">
              <div className="flex items-start space-x-4 p-4 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-all duration-200 border border-gray-100/50">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white shadow-sm text-sm">
                  {option.icon}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={option.key}
                      checked={localPreferences[option.key]}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange(option.key, checked as boolean)
                      }
                      className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-500 border-2"
                    />
                    <Label
                      htmlFor={option.key}
                      className="text-sm font-medium leading-none cursor-pointer group-hover:text-blue-600 transition-colors"
                    >
                      {option.label}
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">
                    {option.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg"
          >
            Save Preferences
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

