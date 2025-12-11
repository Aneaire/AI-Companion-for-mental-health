import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { QualityAnalysisSidebar } from "@/components/admin/QualityAnalysisSidebar";
import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, BarChart3, MessageSquare, FileText, Clock, TrendingUp, AlertCircle, RefreshCw, X, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface QualityAnalysis {
  overallProgress: number;
  emotionalStability: number;
  communicationClarity: number;
  problemSolving: number;
  selfAwareness: number;
  qualityScores: Array<{
    timestamp: number;
    score: number;
    category: string;
    message: string;
  }>;
  insights: string[];
  recommendations: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatResponse {
  response: string;
  recommendations: string[];
  insights: string[];
}

interface ThreadData {
  id: number;
  displayName: string;
  sessionCount: number;
  messageCount: number;
  formCount: number;
}

export const Route = createFileRoute("/quality-analysis")({
  component: QualityAnalysis,
});

function QualityAnalysis() {
  return (
    <AdminProtectedRoute allowedRoles={['superadmin', 'admin', 'observer']}>
      <QualityAnalysisContent />
    </AdminProtectedRoute>
  );
}

function QualityAnalysisContent() {
  const { getToken } = useAuth();
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<QualityAnalysis | null>(null);
  const [analysisInput, setAnalysisInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [activeTab, setActiveTab] = useState<"analysis" | "chat">("analysis");

  // Fetch thread data when thread is selected
  const { data: threadData, isLoading: isLoadingThreadData, error: threadDataError } = useQuery({
    queryKey: ["threadData", selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return null;

      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`/api/quality/threads/${selectedThreadId}/data`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch thread data");
      }

      return await response.json() as ThreadData;
    },
    enabled: !!selectedThreadId,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Generate quality analysis with retry logic
  const generateAnalysis = async (attempt = 1) => {
    if (!selectedThreadId || !analysisInput.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      const response = await fetch(`/api/quality`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId: selectedThreadId,
          analysisFocus: analysisInput,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed (${response.status})`);
      }

      const analysisResult = await response.json() as QualityAnalysis;
      setAnalysis(analysisResult);
      setRetryCount(0); // Reset retry count on success
      toast.success("Analysis completed successfully!", {
        description: "Therapeutic insights have been generated for this thread.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error generating analysis:", error);

      // Retry logic for network errors
      if (attempt < 3 && (errorMessage.includes("fetch") || errorMessage.includes("network"))) {
        setRetryCount(attempt);
        setTimeout(() => generateAnalysis(attempt + 1), 2000 * attempt); // Exponential backoff
        return;
      }

      setError(errorMessage);
      setRetryCount(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleThreadSelect = (threadId: number) => {
    setSelectedThreadId(threadId);
    setAnalysis(null); // Reset analysis when new thread is selected
    setError(null); // Clear any previous errors
    setChatMessages([]); // Reset chat when new thread is selected
  };

  const handleGenerateAnalysis = () => {
    generateAnalysis();
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!selectedThreadId || !chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
      timestamp: Date.now(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatting(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      const response = await fetch(`/api/quality/users/chat`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId: selectedThreadId,
          question: userMessage.content,
          conversationHistory: chatMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Chat failed (${response.status})`);
      }

      const chatResponse: ChatResponse = await response.json();

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: chatResponse.response,
        timestamp: Date.now(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const chatErrorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error sending chat message:", error);

      const errorChatMessage: ChatMessage = {
        role: "assistant",
        content: `Error: ${chatErrorMessage}`,
        timestamp: Date.now(),
      };

      setChatMessages(prev => [...prev, errorChatMessage]);
    } finally {
      setIsChatting(false);
    }
  };

  const sidebarContent = (
    <QualityAnalysisSidebar 
      onUserSelect={() => {}}
      onThreadSelect={handleThreadSelect}
      selectedUserId={selectedUserId}
      selectedThreadId={selectedThreadId}
    />
  );

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Quality Analysis</h1>
          </div>
          <p className="text-gray-600 text-lg">Analyze thread quality and generate therapeutic insights when you don't need to see specific conversations of the user - an alternative to monitor threads</p>
        </div>

        {selectedThreadId ? (
          <div className="space-y-8">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("analysis")}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "analysis"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <BarChart3 className="inline h-4 w-4 mr-2" />
                Quality Analysis
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "chat"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <MessageCircle className="inline h-4 w-4 mr-2" />
                Interactive Chat
              </button>
            </div>

            {/* Analysis Tab */}
            {activeTab === "analysis" && (
              <>
                <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Generate Analysis</h3>
                    <p className="text-sm text-gray-600">Configure and run quality assessment</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Analysis Focus</label>
                     <Input
                       placeholder="e.g., conversation quality, user engagement, therapeutic progress..."
                       value={analysisInput}
                       onChange={(e) => setAnalysisInput(e.target.value)}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           handleGenerateAnalysis();
                         }
                       }}
                       className="h-12 text-base"
                       disabled={isAnalyzing}
                     />
                  </div>
                  
                   <Button
                     onClick={handleGenerateAnalysis}
                     disabled={isAnalyzing || !analysisInput.trim()}
                     className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700"
                   >
                     {isAnalyzing ? (
                       <>
                         <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                         {retryCount > 0 ? `Retrying... (${retryCount}/3)` : "Analyzing Thread..."}
                       </>
                     ) : (
                       <>
                         <Send className="h-5 w-5 mr-3" />
                         Generate Analysis
                       </>
                     )}
                   </Button>

                   {/* Error Display */}
                   {error && (
                     <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                       <div className="flex items-start gap-3">
                         <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                         <div className="flex-1">
                           <h4 className="text-sm font-medium text-red-800 mb-1">Analysis Failed</h4>
                           <p className="text-sm text-red-700 mb-3">{error}</p>
                           <Button
                             onClick={handleGenerateAnalysis}
                             variant="outline"
                             size="sm"
                             className="border-red-300 text-red-700 hover:bg-red-50"
                           >
                             <RefreshCw className="h-4 w-4 mr-2" />
                             Try Again
                           </Button>
                         </div>
                       </div>
                     </div>
                   )}
                </div>
              </div>
            </Card>

            {/* Thread Info - Enhanced */}
            <Card className="shadow-lg">
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Thread #{selectedThreadId}</h3>
                      <p className="text-sm text-gray-600">Therapeutic conversation analysis</p>
                    </div>
                  </div>
                   {analysis && (
                     <div className="flex items-center gap-2">
                       <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                         Analysis Complete
                       </div>
                       <Button
                         onClick={() => {
                           setAnalysis(null);
                           setError(null);
                         }}
                         variant="ghost"
                         size="sm"
                         className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                         title="Clear analysis"
                       >
                         <X className="h-4 w-4" />
                       </Button>
                     </div>
                   )}
                </div>
                
                {/* Always show metrics when thread is selected */}
                <div className="space-y-8">
                  {/* Analysis Results - Only show when analysis exists */}
                  {analysis && (
                    <div className="space-y-6">
                      {/* Overall Scores */}
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h4 className="font-semibold text-gray-900 mb-4 text-lg">Therapeutic Progress Scores</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{analysis.overallProgress}%</div>
                            <div className="text-sm text-gray-600">Overall Progress</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{analysis.emotionalStability}%</div>
                            <div className="text-sm text-gray-600">Emotional Stability</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{analysis.communicationClarity}%</div>
                            <div className="text-sm text-gray-600">Communication</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{analysis.problemSolving}%</div>
                            <div className="text-sm text-gray-600">Problem Solving</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-indigo-600">{analysis.selfAwareness}%</div>
                            <div className="text-sm text-gray-600">Self Awareness</div>
                          </div>
                        </div>
                      </div>

                      {/* Insights */}
                      {analysis.insights.length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-6">
                          <h4 className="font-semibold text-gray-900 mb-3 text-lg">Key Insights</h4>
                          <ul className="space-y-3">
                            {analysis.insights.map((insight, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div className="text-gray-700 prose prose-sm max-w-none">
                                  <ReactMarkdown>{insight}</ReactMarkdown>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendations */}
                      {analysis.recommendations.length > 0 && (
                        <div className="bg-green-50 rounded-xl p-6">
                          <h4 className="font-semibold text-gray-900 mb-3 text-lg">Recommendations</h4>
                          <ul className="space-y-3">
                            {analysis.recommendations.map((rec, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div className="text-gray-700 prose prose-sm max-w-none">
                                  <ReactMarkdown>{rec}</ReactMarkdown>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                   {/* Metrics Grid - Always show when thread is selected */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {isLoadingThreadData ? (
                       // Loading skeleton
                       Array.from({ length: 3 }).map((_, index) => (
                         <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 animate-pulse">
                           <div className="flex items-center gap-3 mb-3">
                             <div className="h-5 w-5 bg-gray-300 rounded"></div>
                             <div className="h-4 w-16 bg-gray-300 rounded"></div>
                           </div>
                           <div className="h-8 w-12 bg-gray-300 rounded mb-2"></div>
                           <div className="h-3 w-24 bg-gray-300 rounded"></div>
                         </div>
                       ))
                     ) : threadDataError ? (
                       // Error state for thread data
                       <div className="col-span-3 p-6 bg-red-50 border border-red-200 rounded-xl">
                         <div className="flex items-center gap-3 mb-2">
                           <AlertCircle className="h-5 w-5 text-red-500" />
                           <span className="text-sm font-medium text-red-800">Failed to load thread data</span>
                         </div>
                         <p className="text-sm text-red-700">{threadDataError.message}</p>
                       </div>
                     ) : (
                       // Actual metrics
                       <>
                         <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                           <div className="flex items-center gap-3 mb-3">
                             <Clock className="h-5 w-5 text-blue-600" />
                             <span className="text-sm font-medium text-blue-800">Sessions</span>
                           </div>
                           <div className="text-3xl font-bold text-blue-600">{threadData?.sessionCount || 0}</div>
                           <div className="text-sm text-blue-600 mt-1">Therapeutic sessions</div>
                         </div>

                         <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                           <div className="flex items-center gap-3 mb-3">
                             <MessageSquare className="h-5 w-5 text-green-600" />
                             <span className="text-sm font-medium text-green-800">Messages</span>
                           </div>
                           <div className="text-3xl font-bold text-green-600">{threadData?.messageCount || 0}</div>
                           <div className="text-sm text-green-600 mt-1">Total exchanges</div>
                         </div>

                         <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                           <div className="flex items-center gap-3 mb-3">
                             <FileText className="h-5 w-5 text-purple-600" />
                             <span className="text-sm font-medium text-purple-800">Forms</span>
                           </div>
                           <div className="text-3xl font-bold text-purple-600">{threadData?.formCount || 0}</div>
                           <div className="text-sm text-purple-600 mt-1">Assessments</div>
                         </div>
                       </>
                     )}
                   </div>

                  {/* Show message when no analysis */}
                  {!analysis && (
                    <div className="text-center py-8">
                      <div className="p-4 bg-gray-100 rounded-full inline-flex mb-4">
                        <Bot className="h-12 w-12 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No Analysis Available</h4>
                      <p className="text-gray-500 max-w-md mx-auto">Generate an analysis to see detailed insights about this thread's therapeutic quality and engagement patterns.</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
              </>
            )}

            {/* Chat Tab */}
            {activeTab === "chat" && (
              <Card className="shadow-lg">
                <div className="px-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <MessageCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Interactive Analysis Chat</h3>
                      <p className="text-sm text-gray-600">Ask questions about this user's therapeutic journey</p>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 h-[50vh] overflow-y-auto">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>Start a conversation about this user's therapeutic progress</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                             <div
                               className={`max-w-sm lg:max-w-lg xl:max-w-xl px-4 py-2 rounded-lg ${
                                 message.role === "user"
                                   ? "bg-blue-600 text-white"
                                   : "bg-white border border-gray-200 text-gray-900"
                               }`}
                             >
                               <div className="text-base prose prose-base max-w-none">
                                 <ReactMarkdown>
                                   {message.content}
                                 </ReactMarkdown>
                               </div>
                             </div>
                          </div>
                        ))}
                        {isChatting && (
                          <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                                <span className="text-sm text-gray-500">Thinking...</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div className="flex gap-3">
                    <Input
                      placeholder="Ask about user progress, patterns, or therapeutic insights..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                      className="flex-1"
                      disabled={isChatting}
                    />
                    <Button
                      onClick={sendChatMessage}
                      disabled={isChatting || !chatInput.trim()}
                      className="px-6"
                    >
                      {isChatting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Card className="shadow-lg">
            <div className="flex items-center justify-center h-80">
              <div className="text-center max-w-md">
                <div className="p-4 bg-gray-100 rounded-full inline-flex mb-6">
                  <User className="h-16 w-16 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Select a Thread</h3>
                <p className="text-gray-600 text-lg">Choose a thread from the sidebar to start quality analysis and generate therapeutic insights.</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}