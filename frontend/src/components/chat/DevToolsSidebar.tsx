import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types/chat";
import { useAuth } from "@clerk/clerk-react";
import type { JSX } from "react";
import { memo, useState, useEffect } from "react";
import MessageQualityAnalyzer from "./MessageQualityAnalyzer";

interface DevToolsSidebarProps {
  messageCount: number;
  messages: Message[];
  initialForm?: any;
  isOpen: boolean;
  onClose: () => void;
}

function DevToolsSidebar({
  messageCount,
  messages,
  initialForm,
  isOpen,
  onClose,
}: DevToolsSidebarProps): JSX.Element {
  const { userId: clerkId } = useAuth();
  const { data: userProfile, isLoading: userProfileLoading } = useUserProfile(
    clerkId || null
  );
  const { loadingState, selectedPersona, personaRationale } = useChatStore();
  const [showQualityAnalysis, setShowQualityAnalysis] = useState(false);
  const [showPersonaBadge, setShowPersonaBadge] = useState(false);

  // Sync with Thread component's persona display state
  useEffect(() => {
    const handlePersonaDisplayState = (event: any) => {
      setShowPersonaBadge(event.detail.showPersona);
    };

    window.addEventListener('personaDisplayState', handlePersonaDisplayState);
    
    return () => {
      window.removeEventListener('personaDisplayState', handlePersonaDisplayState);
    };
  }, []);
  if (!isOpen) return <></>;

  return (
    <>
      <div className="fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-40 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Agent Dev Tools
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* AI Loading Status */}
          {loadingState === "generating" && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-900">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                <span className="text-sm font-medium">
                  Generating response...
                </span>
              </div>
            </div>
          )}

          {/* Quality Analysis Button */}
          <div className="mb-6">
            <Button
              onClick={() => setShowQualityAnalysis(true)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={messageCount === 0}
            >
              Quality Analysis
            </Button>
            {messageCount === 0 && (
              <p className="text-xs text-gray-500 mt-1 text-center">
                Need messages to analyze
              </p>
            )}
          </div>



          {/* Persona Selection Rationale */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Selection Reasoning
            </h4>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900">
              {loadingState === "generating" ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                  <span>Analyzing...</span>
                </div>
              ) : personaRationale ? (
                <div className="space-y-2">
                  <div className="font-medium">Rule-Based Analysis:</div>
                  <div className="text-xs space-y-1">
                    {personaRationale.includes('crisis') && (
                      <div>• Crisis keywords detected - prioritizing support</div>
                    )}
                    {personaRationale.includes('advice') && (
                      <div>• User seeking advice - selecting guide persona</div>
                    )}
                    {personaRationale.includes('companion') && (
                      <div>• User wants conversation - selecting companion</div>
                    )}
                    {personaRationale.includes('emotional') && (
                      <div>• User needs emotional support - selecting listener</div>
                    )}
                    {personaRationale.includes('evasive') && (
                      <div>• User being evasive - selecting direct engager</div>
                    )}
                    {(!personaRationale.includes('crisis') && 
                     !personaRationale.includes('advice') && 
                     !personaRationale.includes('companion') && 
                     !personaRationale.includes('emotional') &&
                     !personaRationale.includes('evasive')) && (
                      <div>• Default selection - using listener persona</div>
                    )}
                  </div>
                </div>
              ) : (
                "No rationale available"
              )}
            </div>
          </div>

          {/* Persona Display Toggle */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Chat Header Badge
            </h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <Button
                size="sm"
                variant={showPersonaBadge ? "default" : "outline"}
                onClick={() => {
                  // Toggle persona display in Thread component
                  const newState = !showPersonaBadge;
                  window.dispatchEvent(new CustomEvent('togglePersonaDisplay', { detail: { showPersona: newState } }));
                }}
                className="w-full"
              >
                {showPersonaBadge ? "Hide Persona Badge" : "Show Persona Badge"}
              </Button>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-2 h-2 rounded-full ${showPersonaBadge ? "bg-green-500" : "bg-gray-300"}`} />
                <p className="text-xs text-gray-600">
                  {showPersonaBadge ? "Persona badge visible in header" : "Persona badge hidden"}
                </p>
              </div>
            </div>
          </div>

          {/* Message Count */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Message Count
            </h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-900">
              {messageCount} messages
            </div>
          </div>

          {/* User Profile Info */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              User Profile
            </h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-900">
              {userProfileLoading ? (
                "Loading..."
              ) : userProfile ? (
                <div>
                  <div>ID: {userProfile.id}</div>
                  <div>Name: {userProfile.nickname}</div>
                  <div>Email: {userProfile.email}</div>
                </div>
              ) : (
                "No user profile"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quality Analysis Modal */}
      <MessageQualityAnalyzer
        isOpen={showQualityAnalysis}
        onClose={() => setShowQualityAnalysis(false)}
        messages={messages}
        initialForm={initialForm}
      />
    </>
  );
}

export default memo(DevToolsSidebar);

