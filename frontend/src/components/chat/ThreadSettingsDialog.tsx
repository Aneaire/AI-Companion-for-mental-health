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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  fetchVoices,
  type ElevenLabsVoice,
} from "@/services/elevenlabs/voices";
import type { ConversationPreferences } from "@/stores/chatStore";
import {
  AlertTriangle,
  Archive,
  MessageSquare,
  Music,
  Settings,
  Trash2,
  User,
  Volume2,
  Zap,
} from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

// Smart presets for therapeutic approaches
const therapeuticPresets = {
  "cognitive-behavioral": {
    name: "Cognitive-Behavioral Therapy",
    description: "Focus on thought patterns and behavioral changes",
    icon: "🧠",
    settings: {
      responseStyle: {
        questioningStyle: "direct" as const,
        emotionalTone: "analytical" as const,
        interventionTiming: "immediate" as const,
      },
      therapeuticApproach: {
        focusAreas: ["cognitive", "behavioral"],
        sessionPace: 60,
        depthLevel: "progressive" as const,
        goalOrientation: "solution-focused" as const,
      },
    },
  },
  "psychodynamic": {
    name: "Psychodynamic Therapy",
    description: "Explore unconscious patterns and early experiences",
    icon: "🔍",
    settings: {
      responseStyle: {
        questioningStyle: "open-ended" as const,
        emotionalTone: "balanced" as const,
        interventionTiming: "delayed" as const,
      },
      therapeuticApproach: {
        focusAreas: ["psychodynamic"],
        sessionPace: 30,
        depthLevel: "deep" as const,
        goalOrientation: "exploratory" as const,
      },
    },
  },
  "humanistic": {
    name: "Humanistic Therapy",
    description: "Emphasize personal growth and self-actualization",
    icon: "🌱",
    settings: {
      responseStyle: {
        questioningStyle: "open-ended" as const,
        emotionalTone: "emotional" as const,
        interventionTiming: "minimal" as const,
      },
      therapeuticApproach: {
        focusAreas: ["humanistic"],
        sessionPace: 40,
        depthLevel: "progressive" as const,
        goalOrientation: "process-oriented" as const,
      },
    },
  },
  "solution-focused": {
    name: "Solution-Focused Brief Therapy",
    description: "Quick, goal-oriented approach focusing on solutions",
    icon: "⚡",
    settings: {
      responseStyle: {
        questioningStyle: "direct" as const,
        emotionalTone: "analytical" as const,
        interventionTiming: "immediate" as const,
      },
      therapeuticApproach: {
        focusAreas: ["behavioral"],
        sessionPace: 80,
        depthLevel: "surface" as const,
        goalOrientation: "solution-focused" as const,
      },
    },
  },
  "integrative": {
    name: "Integrative Therapy",
    description: "Combine multiple approaches for comprehensive care",
    icon: "🎯",
    settings: {
      responseStyle: {
        questioningStyle: "mixed" as const,
        emotionalTone: "adaptive" as const,
        interventionTiming: "opportunistic" as const,
      },
      therapeuticApproach: {
        focusAreas: ["cognitive", "behavioral", "humanistic", "integrative"],
        sessionPace: 50,
        depthLevel: "adaptive" as const,
        goalOrientation: "exploratory" as const,
      },
    },
  },
};

// Impostor behavior presets
const impostorPresets = {
  "resistant-patient": {
    name: "Resistant Patient",
    description: "Hesitant to share, guarded responses",
    icon: "🛡️",
    settings: {
      impostorBehavior: {
        detailLevel: 30,
        emotionalExpression: "reserved" as const,
        responsePattern: "indirect" as const,
        informationSharing: "cautious" as const,
        specificityEnforcement: 40,
        exampleFrequency: "rare" as const,
        sensoryDetailLevel: 20,
        timelineReferences: "vague" as const,
      },
    },
  },
  "open-patient": {
    name: "Open Patient",
    description: "Willing to share, expressive and detailed",
    icon: "💬",
    settings: {
      impostorBehavior: {
        detailLevel: 80,
        emotionalExpression: "expressive" as const,
        responsePattern: "direct" as const,
        informationSharing: "open" as const,
        specificityEnforcement: 90,
        exampleFrequency: "frequent" as const,
        sensoryDetailLevel: 70,
        timelineReferences: "specific" as const,
      },
    },
  },
  "analytical-patient": {
    name: "Analytical Patient",
    description: "Logical, detailed, process-oriented responses",
    icon: "📊",
    settings: {
      impostorBehavior: {
        detailLevel: 70,
        emotionalExpression: "reserved" as const,
        responsePattern: "direct" as const,
        informationSharing: "selective" as const,
        specificityEnforcement: 80,
        exampleFrequency: "occasional" as const,
        sensoryDetailLevel: 40,
        timelineReferences: "specific" as const,
      },
    },
  },
  "emotional-patient": {
    name: "Emotional Patient",
    description: "Feelings-focused, expressive and subjective",
    icon: "❤️",
    settings: {
      impostorBehavior: {
        detailLevel: 60,
        emotionalExpression: "expressive" as const,
        responsePattern: "mixed" as const,
        informationSharing: "open" as const,
        specificityEnforcement: 60,
        exampleFrequency: "frequent" as const,
        sensoryDetailLevel: 80,
        timelineReferences: "mixed" as const,
      },
    },
  },
};

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
  const [showPresets, setShowPresets] = useState(false);
  const [lastAppliedPreset, setLastAppliedPreset] = useState<string | null>(null);

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

  const updateVoicePreference = (
    key: keyof ConversationPreferences,
    value: string | boolean
  ) => {
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

  const updatePreference = (
    key: keyof ConversationPreferences,
    value: boolean | any
  ) => {
    onPreferencesChange({
      ...preferences,
      [key]: value,
    });
  };

  const applyPreset = (presetType: 'therapeutic' | 'impostor', presetKey: string) => {
    const preset = presetType === 'therapeutic' 
      ? therapeuticPresets[presetKey as keyof typeof therapeuticPresets]
      : impostorPresets[presetKey as keyof typeof impostorPresets];
    
    if (!preset) return;

    const updatedPreferences = {
      ...preferences,
      ...preset.settings,
    };

    onPreferencesChange(updatedPreferences);
    setLastAppliedPreset(`${presetType}-${presetKey}`);
    toast.success(`Applied ${preset.name} preset`);
  };

  const resetToPreset = () => {
    if (!lastAppliedPreset) {
      toast.error("No preset has been applied yet");
      return;
    }

    const [presetType, presetKey] = lastAppliedPreset.split('-');
    applyPreset(presetType as 'therapeutic' | 'impostor', presetKey);
    toast.success("Reset to last applied preset");
  };

  const detectConflicts = () => {
    const conflicts = [];
    
    // Check for contradictory settings
    if (preferences.professionalAndFormal && preferences.casualAndFriendly) {
      conflicts.push("Professional and Casual styles conflict");
    }
    
    if (preferences.empatheticAndSupportive && preferences.solutionFocused && preferences.briefAndConcise > 80) {
      conflicts.push("High conciseness may reduce empathetic expression");
    }
    
    if (preferences.therapeuticApproach?.sessionPace && preferences.therapeuticApproach.sessionPace > 80 && 
        preferences.therapeuticApproach?.depthLevel === 'deep') {
      conflicts.push("Fast pace may conflict with deep exploration");
    }
    
    return conflicts;
  };

  const conflicts = detectConflicts();

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
              <TabsTrigger
                value="conversation"
                className="flex items-center gap-2"
              >
                <MessageSquare size={16} />
                Conversation
              </TabsTrigger>
              <TabsTrigger value="voice" className="flex items-center gap-2">
                <Volume2 size={16} />
                Voice
              </TabsTrigger>
              <TabsTrigger value="thread" className="flex items-center gap-2">
                <User size={16} />
                Thread
              </TabsTrigger>
            </TabsList>

          <TabsContent value="conversation" className="space-y-6 mt-6">
            {/* Conflict Detection Alert */}
            {conflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Potential Conflicts Detected</h4>
                    <ul className="text-sm text-amber-700 mt-1 space-y-1">
                      {conflicts.map((conflict, index) => (
                        <li key={index}>• {conflict}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Smart Presets Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Zap size={18} />
                  Quick Presets
                </h3>
                <div className="flex items-center gap-2">
                  {lastAppliedPreset && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetToPreset}
                    >
                      Reset to Preset
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPresets(!showPresets)}
                  >
                    {showPresets ? "Hide" : "Show"} Presets
                  </Button>
                </div>
              </div>
              
              {showPresets && (
                <div className="space-y-4">
                  {/* Therapeutic Approach Presets */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Therapeutic Approaches</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(therapeuticPresets).map(([key, preset]) => (
                        <div
                          key={key}
                          className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => applyPreset('therapeutic', key)}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-lg">{preset.icon}</span>
                            <div className="flex-1">
                              <h5 className="font-medium text-sm">{preset.name}</h5>
                              <p className="text-xs text-gray-600 mt-1">{preset.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Impostor Behavior Presets - Only show in impersonate context */}
                  {context === "impersonate" && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Impostor Behaviors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(impostorPresets).map(([key, preset]) => (
                          <div
                            key={key}
                            className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => applyPreset('impostor', key)}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-lg">{preset.icon}</span>
                              <div className="flex-1">
                                <h5 className="font-medium text-sm">{preset.name}</h5>
                                <p className="text-xs text-gray-600 mt-1">{preset.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

             <div>
               <h3 className="text-lg font-semibold mb-4">
                 Detailed Settings
               </h3>
               <div className="space-y-4">
                 {/* Language Selection */}
                 <div className="flex items-center justify-between">
                   <div className="space-y-0.5">
                     <Label className="text-base">Response Language</Label>
                     <p className="text-sm text-gray-600">
                       Choose the language for AI responses
                     </p>
                   </div>
                   <div className="flex items-center space-x-2">
                     <Button
                       variant={preferences.language === "english" ? "default" : "outline"}
                       size="sm"
                       onClick={() => updatePreference("language", "english")}
                     >
                       English
                     </Button>
                     <Button
                       variant={preferences.language === "filipino" ? "default" : "outline"}
                       size="sm"
                       onClick={() => updatePreference("language", "filipino")}
                     >
                       Filipino
                     </Button>
                   </div>
                 </div>

                 <Separator />
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
                    onValueChange={(value) =>
                      updatePreference("briefAndConcise", value[0])
                    }
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
                    <Label className="text-base">
                      Empathetic and Supportive
                    </Label>
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

                <Separator />

                {/* Response Style Controls */}
                <div>
                  <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                    <Settings size={16} />
                    Response Style Controls
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Questioning Style</Label>
                      <Select
                        value={preferences.responseStyle?.questioningStyle || "mixed"}
                        onValueChange={(value) =>
                          updatePreference("responseStyle", {
                            ...preferences.responseStyle,
                            questioningStyle: value as any,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open-ended">Open-ended Questions</SelectItem>
                          <SelectItem value="closed">Closed Questions</SelectItem>
                          <SelectItem value="direct">Direct Questions</SelectItem>
                          <SelectItem value="mixed">Mixed Style</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-600">
                        How the therapist approaches questioning in conversations
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Emotional Tone</Label>
                      <Select
                        value={preferences.responseStyle?.emotionalTone || "balanced"}
                        onValueChange={(value) =>
                          updatePreference("responseStyle", {
                            ...preferences.responseStyle,
                            emotionalTone: value as any,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="analytical">Analytical</SelectItem>
                          <SelectItem value="emotional">Emotional</SelectItem>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="adaptive">Adaptive</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-600">
                        The emotional approach in therapeutic responses
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Intervention Timing</Label>
                      <Select
                        value={preferences.responseStyle?.interventionTiming || "opportunistic"}
                        onValueChange={(value) =>
                          updatePreference("responseStyle", {
                            ...preferences.responseStyle,
                            interventionTiming: value as any,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="delayed">Delayed</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="opportunistic">Opportunistic</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-600">
                        When to provide interventions and guidance
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Therapeutic Approach */}
                <div>
                  <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                    <User size={16} />
                    Therapeutic Approach
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Focus Areas</Label>
                      <div className="flex flex-wrap gap-2">
                        {["cognitive", "behavioral", "humanistic", "integrative", "psychodynamic"].map((area) => (
                          <Badge
                            key={area}
                            variant={
                              preferences.therapeuticApproach?.focusAreas?.includes(area as any)
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer"
                            onClick={() => {
                              const currentAreas = preferences.therapeuticApproach?.focusAreas || [];
                              const newAreas = currentAreas.includes(area as any)
                                ? currentAreas.filter((a) => a !== area)
                                : [...currentAreas, area as any];
                              updatePreference("therapeuticApproach", {
                                ...preferences.therapeuticApproach,
                                focusAreas: newAreas,
                              });
                            }}
                          >
                            {area.charAt(0).toUpperCase() + area.slice(1)}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600">
                        Select therapeutic modalities to incorporate
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Session Pace</Label>
                        <span className="text-sm text-gray-500 font-mono">
                          {preferences.therapeuticApproach?.sessionPace || 50}%
                        </span>
                      </div>
                      <Slider
                        value={[preferences.therapeuticApproach?.sessionPace || 50]}
                        onValueChange={(value) =>
                          updatePreference("therapeuticApproach", {
                            ...preferences.therapeuticApproach,
                            sessionPace: value[0],
                          })
                        }
                        min={0}
                        max={100}
                        step={10}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Slow</span>
                        <span>Moderate</span>
                        <span>Fast</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Depth Level</Label>
                      <Select
                        value={preferences.therapeuticApproach?.depthLevel || "progressive"}
                        onValueChange={(value) =>
                          updatePreference("therapeuticApproach", {
                            ...preferences.therapeuticApproach,
                            depthLevel: value as any,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="surface">Surface Level</SelectItem>
                          <SelectItem value="deep">Deep Exploration</SelectItem>
                          <SelectItem value="progressive">Progressive Deepening</SelectItem>
                          <SelectItem value="adaptive">Adaptive Depth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Goal Orientation</Label>
                      <Select
                        value={preferences.therapeuticApproach?.goalOrientation || "exploratory"}
                        onValueChange={(value) =>
                          updatePreference("therapeuticApproach", {
                            ...preferences.therapeuticApproach,
                            goalOrientation: value as any,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exploratory">Exploratory</SelectItem>
                          <SelectItem value="solution-focused">Solution-Focused</SelectItem>
                          <SelectItem value="psychoeducational">Psychoeducational</SelectItem>
                          <SelectItem value="process-oriented">Process-Oriented</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Therapeutic Feedback Style */}
                <div>
                  <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                    <MessageSquare size={16} />
                    Therapeutic Feedback Style
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Constructive Feedback</Label>
                        <p className="text-xs text-gray-600">Provide constructive guidance and suggestions</p>
                      </div>
                      <Switch
                        checked={preferences.feedbackStyle?.constructiveFeedback ?? true}
                        onCheckedChange={(checked) =>
                          updatePreference("feedbackStyle", {
                            ...preferences.feedbackStyle,
                            constructiveFeedback: checked,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Live Acknowledging</Label>
                        <p className="text-xs text-gray-600">Provide real-time validation and acknowledgment</p>
                      </div>
                      <Switch
                        checked={preferences.feedbackStyle?.liveAcknowledging ?? true}
                        onCheckedChange={(checked) =>
                          updatePreference("feedbackStyle", {
                            ...preferences.feedbackStyle,
                            liveAcknowledging: checked,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Validation Level</Label>
                        <span className="text-sm text-gray-500">
                          {preferences.feedbackStyle?.validationLevel ?? 70}%
                        </span>
                      </div>
                      <Slider
                        value={[preferences.feedbackStyle?.validationLevel ?? 70]}
                        onValueChange={([value]) =>
                          updatePreference("feedbackStyle", {
                            ...preferences.feedbackStyle,
                            validationLevel: value,
                          })
                        }
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Minimal</span>
                        <span>Moderate</span>
                        <span>High</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Reinforcement Type</Label>
                      <Select
                        value={preferences.feedbackStyle?.reinforcementType || "balanced"}
                        onValueChange={(value: any) =>
                          updatePreference("feedbackStyle", {
                            ...preferences.feedbackStyle,
                            reinforcementType: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positive">Positive Reinforcement</SelectItem>
                          <SelectItem value="balanced">Balanced Feedback</SelectItem>
                          <SelectItem value="growth-oriented">Growth-Oriented</SelectItem>
                          <SelectItem value="minimal">Minimal Feedback</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Feedback Timing</Label>
                      <Select
                        value={preferences.feedbackStyle?.feedbackTiming || "immediate"}
                        onValueChange={(value: any) =>
                          updatePreference("feedbackStyle", {
                            ...preferences.feedbackStyle,
                            feedbackTiming: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="delayed">Delayed</SelectItem>
                          <SelectItem value="session-summary">Session Summary</SelectItem>
                          <SelectItem value="opportunistic">Opportunistic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium mb-3 block">Feedback Focus Areas</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: "strengths", label: "Strengths", icon: "💪" },
                          { value: "growth-areas", label: "Growth Areas", icon: "🌱" },
                          { value: "progress", label: "Progress", icon: "📈" },
                          { value: "insights", label: "Insights", icon: "💡" },
                          { value: "behavior-patterns", label: "Behavior Patterns", icon: "🔍" },
                        ].map(({ value, label, icon }) => (
                          <label
                            key={value}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                              preferences.feedbackStyle?.feedbackFocus?.includes(value as any)
                                ? "border-primary bg-primary/5"
                                : "border-gray-200 hover:bg-gray-50"
                            )}
                          >
                            <Checkbox
                              checked={preferences.feedbackStyle?.feedbackFocus?.includes(value as any) ?? false}
                              onCheckedChange={(checked) => {
                                const currentFocus = preferences.feedbackStyle?.feedbackFocus || [];
                                const newFocus = checked
                                  ? [...currentFocus, value as any]
                                  : currentFocus.filter((item) => item !== value);
                                updatePreference("feedbackStyle", {
                                  ...preferences.feedbackStyle,
                                  feedbackFocus: newFocus,
                                });
                              }}
                            />
                            <span className="text-sm">{icon} {label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Response Behavior */}
                <div>
                  <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                    <Zap size={16} />
                    Response Behavior
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Unpredictable Responses</Label>
                        <p className="text-xs text-gray-600">Allow AI to respond however it likes</p>
                      </div>
                      <Switch
                        checked={preferences.unpredictability ?? false}
                        onCheckedChange={(checked) =>
                          updatePreference("unpredictability", checked)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Impostor Settings - Only show in impersonate context */}
                {context === "impersonate" && (
                  <>
                    <Separator />

                    {/* Persona Behavior */}
                    <div>
                      <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                        <User size={16} />
                        Persona Behavior
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Detail Level</Label>
                            <span className="text-sm text-gray-500 font-mono">
                              {preferences.impostorBehavior?.detailLevel || 70}%
                            </span>
                          </div>
                          <Slider
                            value={[preferences.impostorBehavior?.detailLevel || 70]}
                            onValueChange={(value) =>
                              updatePreference("impostorBehavior", {
                                ...preferences.impostorBehavior,
                                detailLevel: value[0],
                              })
                            }
                            min={0}
                            max={100}
                            step={10}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>Minimal</span>
                            <span>Moderate</span>
                            <span>Extensive</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Emotional Expression</Label>
                          <Select
                            value={preferences.impostorBehavior?.emotionalExpression || "variable"}
                            onValueChange={(value) =>
                              updatePreference("impostorBehavior", {
                                ...preferences.impostorBehavior,
                                emotionalExpression: value as any,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reserved">Reserved</SelectItem>
                              <SelectItem value="expressive">Expressive</SelectItem>
                              <SelectItem value="variable">Variable</SelectItem>
                              <SelectItem value="contextual">Contextual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Response Pattern</Label>
                          <Select
                            value={preferences.impostorBehavior?.responsePattern || "mixed"}
                            onValueChange={(value) =>
                              updatePreference("impostorBehavior", {
                                ...preferences.impostorBehavior,
                                responsePattern: value as any,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="direct">Direct</SelectItem>
                              <SelectItem value="indirect">Indirect</SelectItem>
                              <SelectItem value="mixed">Mixed</SelectItem>
                              <SelectItem value="situational">Situational</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Information Sharing</Label>
                          <Select
                            value={preferences.impostorBehavior?.informationSharing || "selective"}
                            onValueChange={(value) =>
                              updatePreference("impostorBehavior", {
                                ...preferences.impostorBehavior,
                                informationSharing: value as any,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cautious">Cautious</SelectItem>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="selective">Selective</SelectItem>
                              <SelectItem value="progressive">Progressive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Content Requirements */}
                    <div>
                      <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                        <MessageSquare size={16} />
                        Content Requirements
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Specificity Enforcement</Label>
                            <span className="text-sm text-gray-500 font-mono">
                              {preferences.impostorBehavior?.specificityEnforcement || 80}%
                            </span>
                          </div>
                          <Slider
                            value={[preferences.impostorBehavior?.specificityEnforcement || 80]}
                            onValueChange={(value) =>
                              updatePreference("impostorBehavior", {
                                ...preferences.impostorBehavior,
                                specificityEnforcement: value[0],
                              })
                            }
                            min={0}
                            max={100}
                            step={10}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>Flexible</span>
                            <span>Moderate</span>
                            <span>Strict</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Example Frequency</Label>
                          <Select
                            value={preferences.impostorBehavior?.exampleFrequency || "frequent"}
                            onValueChange={(value) =>
                              updatePreference("impostorBehavior", {
                                ...preferences.impostorBehavior,
                                exampleFrequency: value as any,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rare">Rare</SelectItem>
                              <SelectItem value="occasional">Occasional</SelectItem>
                              <SelectItem value="frequent">Frequent</SelectItem>
                              <SelectItem value="consistent">Consistent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Sensory Detail Level</Label>
                            <span className="text-sm text-gray-500 font-mono">
                              {preferences.impostorBehavior?.sensoryDetailLevel || 60}%
                            </span>
                          </div>
                          <Slider
                            value={[preferences.impostorBehavior?.sensoryDetailLevel || 60]}
                            onValueChange={(value) =>
                              updatePreference("impostorBehavior", {
                                ...preferences.impostorBehavior,
                                sensoryDetailLevel: value[0],
                              })
                            }
                            min={0}
                            max={100}
                            step={10}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>Low</span>
                            <span>Medium</span>
                            <span>High</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Timeline References</Label>
                          <Select
                            value={preferences.impostorBehavior?.timelineReferences || "specific"}
                            onValueChange={(value) =>
                              updatePreference("impostorBehavior", {
                                ...preferences.impostorBehavior,
                                timelineReferences: value as any,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vague">Vague</SelectItem>
                              <SelectItem value="specific">Specific</SelectItem>
                              <SelectItem value="mixed">Mixed</SelectItem>
                              <SelectItem value="flexible">Flexible</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="voice" className="space-y-6 mt-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Text-to-Speech Settings
              </h3>
              <div className="space-y-4">
                {/* Enable Text-to-Speech - Moved to top */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Text-to-Speech</Label>
                    <p className="text-sm text-gray-600">
                      Enable TTS functionality for voice playback
                    </p>
                  </div>
                  <Switch
                    checked={
                      context === "main"
                        ? (preferences.mainEnableTTS ?? false)
                        : (preferences.enableTTS ?? false)
                    }
                    onCheckedChange={(checked) =>
                      updateVoicePreference(
                        context === "main" ? "mainEnableTTS" : "enableTTS",
                        checked
                      )
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  {context === "main" ? (
                    <>
                      <Label className="text-base">Voice Selection</Label>
                      <p className="text-sm text-gray-600">
                        Choose a voice for text-to-speech playback on the main
                        chat page
                      </p>
                      <Select
                        value={preferences.mainTTSVoiceId || ""}
                        onValueChange={(value) =>
                          updateVoicePreference("mainTTSVoiceId", value)
                        }
                        disabled={voicesLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              voicesLoading
                                ? "Loading voices..."
                                : "Select a voice"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.map((voice) => (
                            <SelectItem
                              key={voice.voice_id}
                              value={voice.voice_id}
                            >
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
                        Set different voices for therapist and impostor roles
                        during impersonation
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Therapist Voice
                          </Label>
                          <Select
                            value={preferences.therapistVoiceId || ""}
                            onValueChange={(value) =>
                              updateVoicePreference("therapistVoiceId", value)
                            }
                            disabled={voicesLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  voicesLoading
                                    ? "Loading voices..."
                                    : "Select therapist voice"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {voices.map((voice) => (
                                <SelectItem
                                  key={voice.voice_id}
                                  value={voice.voice_id}
                                >
                                  {voice.name} (
                                  {voice.labels?.accent || "Unknown"})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Impostor Voice
                          </Label>
                          <Select
                            value={preferences.impostorVoiceId || ""}
                            onValueChange={(value) =>
                              updateVoicePreference("impostorVoiceId", value)
                            }
                            disabled={voicesLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  voicesLoading
                                    ? "Loading voices..."
                                    : "Select impostor voice"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {voices.map((voice) => (
                                <SelectItem
                                  key={voice.voice_id}
                                  value={voice.voice_id}
                                >
                                  {voice.name} (
                                  {voice.labels?.accent || "Unknown"})
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
                    value={
                      context === "main"
                        ? preferences.mainTTSModel || "eleven_flash_v2_5"
                        : preferences.therapistModel || "eleven_flash_v2_5"
                    }
                    onValueChange={(value) =>
                      updateVoicePreference(
                        context === "main" ? "mainTTSModel" : "therapistModel",
                        value
                      )
                    }
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
                      <Label className="text-sm font-medium">
                        Impostor Model
                      </Label>
                      <Select
                        value={preferences.impostorModel || "eleven_flash_v2_5"}
                        onValueChange={(value) =>
                          updateVoicePreference("impostorModel", value)
                        }
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
                    <Label className="text-base">Auto-play TTS</Label>
                    <p className="text-sm text-gray-600">
                      Automatically play text-to-speech for new messages
                    </p>
                  </div>
                  <Switch
                    checked={
                      context === "main"
                        ? (preferences.mainTTSAutoPlay ?? false)
                        : (preferences.ttsAutoPlay ?? false)
                    }
                    onCheckedChange={(checked) =>
                      updateVoicePreference(
                        context === "main" ? "mainTTSAutoPlay" : "ttsAutoPlay",
                        checked
                      )
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Adaptive Pacing</Label>
                    <p className="text-sm text-gray-600">
                      Adjust speed based on message length for natural
                      conversation flow
                    </p>
                  </div>
                  <Switch
                    checked={
                      context === "main"
                        ? (preferences.mainTTSAdaptivePacing ?? false)
                        : (preferences.ttsAdaptivePacing ?? false)
                    }
                    onCheckedChange={(checked) =>
                      updateVoicePreference(
                        context === "main"
                          ? "mainTTSAdaptivePacing"
                          : "ttsAdaptivePacing",
                        checked
                      )
                    }
                  />
                </div>

                <Separator />

                {/* Speed slider - Moved to bottom */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Speed</Label>
                    <span className="text-sm text-gray-500 font-mono">
                      {(context === "main"
                        ? (preferences.mainTTSSpeed ?? 1.0)
                        : (preferences.ttsSpeed ?? 1.0)
                      ).toFixed(1)}
                      x
                    </span>
                  </div>
                   <p className="text-sm text-gray-600">
                     Adjust playback speed (0.5x to 1.5x)
                   </p>
                   <Slider
                     value={[
                       context === "main"
                         ? (preferences.mainTTSSpeed ?? 1.0)
                         : (preferences.ttsSpeed ?? 1.0),
                     ]}
                     onValueChange={(value) =>
                       updateVoicePreference(
                         context === "main" ? "mainTTSSpeed" : "ttsSpeed",
                         value[0]
                       )
                     }
                     min={0.5}
                     max={1.5}
                     step={0.1}
                     className="w-full"
                   />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Slower</span>
                    <span>Faster</span>
                  </div>
                </div>

                <Separator />

                {/* Background Music Settings */}
                <div className="space-y-3">
                  <Label className="text-base flex items-center gap-2">
                    <Music size={16} />
                    Background Music
                  </Label>
                  <p className="text-sm text-gray-600">
                    Choose ambient music to play during sessions
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Music Track</Label>
                      <Select
                        value={preferences.podcastMusicTrack ?? "ambient-piano"}
                        onValueChange={(value) =>
                          updateVoicePreference("podcastMusicTrack", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ambient-piano">
                            Ambient Piano
                          </SelectItem>
                          <SelectItem value="japanese-piano">
                            Japanese Piano
                          </SelectItem>
                          <SelectItem value="lofi-nature">
                            Lofi Nature
                          </SelectItem>
                          <SelectItem value="meditation-spiritual">
                            Meditation Spiritual
                          </SelectItem>
                          <SelectItem value="nature-sounds">
                            Nature Sounds
                          </SelectItem>
                          <SelectItem value="rain-and-tears">
                            Rain and Tears
                          </SelectItem>
                          <SelectItem value="waves-and-tears-piano">
                            Waves and Tears Piano
                          </SelectItem>
                          <SelectItem value="none">No Music</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Main Session Page</Label>
                        <Switch
                          checked={preferences.autoPlayMusicOnMain ?? false}
                          onCheckedChange={(checked) =>
                            updateVoicePreference(
                              "autoPlayMusicOnMain",
                              checked
                            )
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Impersonate Page</Label>
                        <Switch
                          checked={
                            preferences.autoPlayMusicOnImpersonate ?? true
                          }
                          onCheckedChange={(checked) =>
                            updateVoicePreference(
                              "autoPlayMusicOnImpersonate",
                              checked
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Background Music Volume</Label>
                      <Slider
                        value={[preferences.podcastMusicVolume ?? 0.3]}
                        onValueChange={(value) =>
                          updateVoicePreference("podcastMusicVolume", value[0])
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Quiet</span>
                        <span>Loud</span>
                      </div>
                    </div>
                  </div>
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
                      Are you sure you want to delete this thread? This action
                      cannot be undone and will permanently remove all messages
                      and sessions in this thread.
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
