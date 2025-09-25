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
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConversationPreferences } from "@/stores/chatStore";
import {
  AlertTriangle,
  Archive,
  MessageSquare,
  Settings,
  Trash2,
  User,
  Volume2,
} from "lucide-react";
import type { JSX } from "react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { fetchVoices, type ElevenLabsVoice } from "@/services/elevenlabs/voices";

interface ThreadSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedThreadId: number | null;
  threadTitle?: string;
  preferences: ConversationPreferences;
  onPreferencesChange: (preferences: ConversationPreferences) => void;
  onDeleteThread?: (threadId: number) => void;
  onArchiveThread?: (threadId: number) => void;
  context: "main" | "impersonate";
}

export function ThreadSettingsDialog({
  isOpen,
  onClose,
  selectedThreadId,
  threadTitle,
  preferences,
  onPreferencesChange,
  onDeleteThread,
  onArchiveThread,
  context,
}: ThreadSettingsDialogProps): JSX.Element {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  // ElevenLabs model options
  const elevenLabsModels = [
    { id: "eleven_v3", name: "Eleven v3" },
    { id: "eleven_flash_v2_5", name: "Eleven Flash v2.5" },
    { id: "eleven_flash_v2", name: "Eleven Flash v2" },
    { id: "eleven_turbo_v2", name: "Eleven Turbo v2" },
  ];

  // Fetch voices when dialog opens
  useEffect(() => {
    if (isOpen && voices.length === 0) {
      setVoicesLoading(true);
      fetchVoices()
        .then(setVoices)
        .catch((error) => {
          console.error("Failed to fetch voices:", error);
          toast.error("Failed to load voices");
        })
        .finally(() => setVoicesLoading(false));
    }
  }, [isOpen, voices.length]);

  const updateVoicePreference = (key: keyof ConversationPreferences, value: string | boolean) => {
    onPreferencesChange({
      ...preferences,
      [key]: value,
    });
  };

  const handleDeleteClick = () => {
    if (!selectedThreadId) return;
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedThreadId || !onDeleteThread) return;
    onDeleteThread(selectedThreadId);
    setShowDeleteConfirmation(false);
    onClose();
    toast.success("Thread deleted successfully");
  };

  const handleArchiveClick = () => {
    if (!selectedThreadId || !onArchiveThread) return;
    onArchiveThread(selectedThreadId);
    onClose();
    toast.success("Thread archived successfully");
  };

  const updatePreference = (key: keyof ConversationPreferences, value: boolean) => {
    onPreferencesChange({
      ...preferences,
      [key]: value,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={20} />
            Thread Settings
          </DialogTitle>
          <DialogDescription>
            Manage your current thread and conversation preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="voice" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conversation" className="flex items-center gap-2">
              <MessageSquare size={16} />
              Conversation
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Volume2 size={16} />
              Voice
            </TabsTrigger>
            <TabsTrigger value="thread" className="flex items-center gap-2">
              <User size={16} />
              Thread Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversation" className="space-y-6 mt-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Conversation Preferences</h3>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Brief and Concise</Label>
                    <span className="text-sm text-gray-500 font-mono">
                      {preferences.briefAndConcise}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Adjust how brief and concise responses should be
                  </p>
                  <Slider
                    value={[preferences.briefAndConcise]}
                    onValueChange={(value) => updatePreference("briefAndConcise", value[0])}
                    min={0}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Detailed</span>
                    <span>Concise</span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Empathetic and Supportive</Label>
                    <p className="text-sm text-gray-600">
                      Use warm, caring language with emotional support
                    </p>
                  </div>
                  <Switch
                    checked={preferences.empatheticAndSupportive}
                    onCheckedChange={(checked) =>
                      updatePreference("empatheticAndSupportive", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Solution Focused</Label>
                    <p className="text-sm text-gray-600">
                      Focus on practical solutions and actionable advice
                    </p>
                  </div>
                  <Switch
                    checked={preferences.solutionFocused}
                    onCheckedChange={(checked) =>
                      updatePreference("solutionFocused", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Casual and Friendly</Label>
                    <p className="text-sm text-gray-600">
                      Use relaxed, informal language
                    </p>
                  </div>
                  <Switch
                    checked={preferences.casualAndFriendly}
                    onCheckedChange={(checked) =>
                      updatePreference("casualAndFriendly", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Professional and Formal</Label>
                    <p className="text-sm text-gray-600">
                      Maintain professional, clinical tone
                    </p>
                  </div>
                  <Switch
                    checked={preferences.professionalAndFormal}
                    onCheckedChange={(checked) =>
                      updatePreference("professionalAndFormal", checked)
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="voice" className="space-y-6 mt-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Text-to-Speech Settings</h3>
              <div className="space-y-4">
                <div className="space-y-3">
                  {context === "main" ? (
                    <>
                      <Label className="text-base">Voice Selection</Label>
                      <p className="text-sm text-gray-600">
                        Choose a voice for text-to-speech playback on the main chat page
                      </p>
                      <Select
                        value={preferences.mainTTSVoiceId || ""}
                        onValueChange={(value) => updateVoicePreference("mainTTSVoiceId", value)}
                        disabled={voicesLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select a voice"} />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.map((voice) => (
                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                              {voice.name} ({voice.labels?.accent || "Unknown"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <Label className="text-base">Role-Specific Voices</Label>
                      <p className="text-sm text-gray-600">
                        Set different voices for therapist and impostor roles during impersonation
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Therapist Voice</Label>
                          <Select
                            value={preferences.therapistVoiceId || ""}
                            onValueChange={(value) => updateVoicePreference("therapistVoiceId", value)}
                            disabled={voicesLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select therapist voice"} />
                            </SelectTrigger>
                            <SelectContent>
                              {voices.map((voice) => (
                                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  {voice.name} ({voice.labels?.accent || "Unknown"})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Impostor Voice</Label>
                          <Select
                            value={preferences.impostorVoiceId || ""}
                            onValueChange={(value) => updateVoicePreference("impostorVoiceId", value)}
                            disabled={voicesLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select impostor voice"} />
                            </SelectTrigger>
                            <SelectContent>
                              {voices.map((voice) => (
                                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  {voice.name} ({voice.labels?.accent || "Unknown"})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                   )}
                 </div>

                 <Separator />

                 <div className="space-y-3">
                   <Label className="text-base">ElevenLabs Model</Label>
                   <p className="text-sm text-gray-600">
                     Choose the AI model for text-to-speech generation
                   </p>
                   <Select
                     value={context === "main" ? (preferences.mainTTSModel || "eleven_flash_v2_5") : (preferences.therapistModel || "eleven_flash_v2_5")}
                     onValueChange={(value) => updateVoicePreference(context === "main" ? "mainTTSModel" : "therapistModel", value)}
                   >
                     <SelectTrigger className="w-full">
                       <SelectValue placeholder="Select a model" />
                     </SelectTrigger>
                     <SelectContent>
                       {elevenLabsModels.map((model) => (
                         <SelectItem key={model.id} value={model.id}>
                           {model.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                   {context === "impersonate" && (
                     <div className="mt-4">
                       <Label className="text-sm font-medium">Impostor Model</Label>
                       <Select
                         value={preferences.impostorModel || "eleven_flash_v2_5"}
                         onValueChange={(value) => updateVoicePreference("impostorModel", value)}
                         className="mt-2"
                       >
                         <SelectTrigger className="w-full">
                           <SelectValue placeholder="Select impostor model" />
                         </SelectTrigger>
                         <SelectContent>
                           {elevenLabsModels.map((model) => (
                             <SelectItem key={model.id} value={model.id}>
                               {model.name}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>
                   )}
                 </div>

                 <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Text-to-Speech</Label>
                    <p className="text-sm text-gray-600">
                      Enable TTS functionality for voice playback
                    </p>
                  </div>
                  <Switch
                    checked={context === "main" ? (preferences.mainEnableTTS ?? false) : (preferences.enableTTS ?? false)}
                    onCheckedChange={(checked) =>
                      updateVoicePreference(context === "main" ? "mainEnableTTS" : "enableTTS", checked)
                    }
                  />
                </div>

                <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Speed</Label>
                      <span className="text-sm text-gray-500 font-mono">
                        {(context === "main" ? (preferences.mainTTSSpeed ?? 1.0) : (preferences.ttsSpeed ?? 1.0)).toFixed(1)}x
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Adjust playback speed (0.5x to 2.0x)
                    </p>
                    <Slider
                      value={[context === "main" ? (preferences.mainTTSSpeed ?? 1.0) : (preferences.ttsSpeed ?? 1.0)]}
                      onValueChange={(value) => updateVoicePreference(context === "main" ? "mainTTSSpeed" : "ttsSpeed", value[0])}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      className="w-full"
                    />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Slower</span>
                    <span>Faster</span>
                  </div>
                </div>

                <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Volume</Label>
                      <span className="text-sm text-gray-500 font-mono">
                        {context === "main" ? (preferences.mainTTSVolume ?? 80) : (preferences.ttsVolume ?? 80)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Adjust playback volume
                    </p>
                    <Slider
                      value={[context === "main" ? (preferences.mainTTSVolume ?? 80) : (preferences.ttsVolume ?? 80)]}
                      onValueChange={(value) => updateVoicePreference(context === "main" ? "mainTTSVolume" : "ttsVolume", value[0])}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Quiet</span>
                    <span>Loud</span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Auto-play TTS</Label>
                    <p className="text-sm text-gray-600">
                      Automatically play text-to-speech for new messages
                    </p>
                  </div>
                  <Switch
                    checked={context === "main" ? (preferences.mainTTSAutoPlay ?? false) : (preferences.ttsAutoPlay ?? false)}
                    onCheckedChange={(checked) =>
                      updateVoicePreference(context === "main" ? "mainTTSAutoPlay" : "ttsAutoPlay", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Adaptive Pacing</Label>
                    <p className="text-sm text-gray-600">
                      Adjust speed based on message length for natural conversation flow
                    </p>
                  </div>
                  <Switch
                    checked={context === "main" ? (preferences.mainTTSAdaptivePacing ?? false) : (preferences.ttsAdaptivePacing ?? false)}
                    onCheckedChange={(checked) =>
                      updateVoicePreference(context === "main" ? "mainTTSAdaptivePacing" : "ttsAdaptivePacing", checked)
                    }
                  />
                </div>


              </div>
            </div>
          </TabsContent>

          <TabsContent value="thread" className="space-y-6 mt-6">
            {selectedThreadId ? (
              <div>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <MessageSquare size={16} className="text-gray-600" />
                    <span className="font-medium">
                      {threadTitle || `Thread #${selectedThreadId}`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Thread ID: {selectedThreadId}
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Thread Actions</h4>

                  {onArchiveThread && (
                    <Button
                      variant="outline"
                      className="w-full justify-start text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
                      onClick={handleArchiveClick}
                    >
                      <Archive size={16} className="mr-2" />
                      Archive Thread
                    </Button>
                  )}

                  {onDeleteThread && (
                    <Button
                      variant="outline"
                      className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                      onClick={handleDeleteClick}
                    >
                      <Trash2 size={16} className="mr-2" />
                      Delete Thread
                    </Button>
                  )}
                </div>

                {/* Delete Confirmation */}
                {showDeleteConfirmation && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={16} className="text-red-600" />
                      <span className="font-medium text-red-800">
                        Confirm Deletion
                      </span>
                    </div>
                    <p className="text-sm text-red-700 mb-4">
                      Are you sure you want to delete this thread? This action cannot be undone and will permanently remove all messages and sessions in this thread.
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center space-x-2 mb-3">
                        <Checkbox id="confirm-delete" />
                        <Label htmlFor="confirm-delete" className="text-sm">
                          I understand this action cannot be undone
                        </Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirmation(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleConfirmDelete}
                      >
                        Delete Thread
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                <p>No thread selected</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ThreadSettingsDialog;
