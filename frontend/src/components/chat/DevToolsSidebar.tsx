import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types/chat";
import { useAuth } from "@clerk/clerk-react";
import type { JSX } from "react";
import { memo, useState } from "react";
import MessageQualityAnalyzer from "./MessageQualityAnalyzer";

interface DevToolsSidebarProps {
  agentStrategy: string;
  agentRationale: string;
  agentNextSteps: string[];
  messageCount: number;
  messages: Message[];
  initialForm?: any;
  isOpen: boolean;
  onClose: () => void;
}

function DevToolsSidebar({
  agentStrategy,
  agentRationale,
  agentNextSteps,
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
  const { loadingState } = useChatStore();
  const [showQualityAnalysis, setShowQualityAnalysis] = useState(false);
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

          {/* Observer Loading Status */}
          {(loadingState === "observer" || loadingState === "generating") && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-900">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                <span className="text-sm font-medium">
                  {loadingState === "observer"
                    ? "Analyzing conversation..."
                    : "Generating response..."}
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

          {/* Agent Strategy */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Strategy</h4>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
              {loadingState === "observer" || loadingState === "generating" ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  <span>Analyzing...</span>
                </div>
              ) : (
                agentStrategy || "No strategy available"
              )}
            </div>
          </div>

          {/* Agent Rationale */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Rationale
            </h4>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900">
              {loadingState === "observer" || loadingState === "generating" ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                  <span>Analyzing...</span>
                </div>
              ) : (
                agentRationale || "No rationale available"
              )}
            </div>
          </div>

          {/* Agent Next Steps */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Next Steps
            </h4>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              {loadingState === "observer" || loadingState === "generating" ? (
                <div className="flex items-center gap-2 text-sm text-purple-900">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                  <span>Analyzing...</span>
                </div>
              ) : agentNextSteps && agentNextSteps.length > 0 ? (
                <ul className="text-sm text-purple-900 space-y-1">
                  {agentNextSteps.map((step, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-purple-900">
                  No next steps available
                </span>
              )}
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

