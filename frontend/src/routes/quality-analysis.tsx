import { createRoute, createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Route as rootRoute } from "./__root";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { QualityAnalysisSidebar } from "@/components/admin/QualityAnalysisSidebar";
import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User } from "lucide-react";

interface ThreadAnalysis {
  threadId: number;
  displayName: string;
  sessionCount: number;
  messageCount: number;
  formCount: number;
  isAnalyzed: boolean;
  summary: string;
}

export const Route = createRoute("/quality-analysis")({
  getParentRoute: () => rootRoute,
  path: "/quality-analysis",
  component: QualityAnalysis,
});

function QualityAnalysis() {
  return (
    <AdminProtectedRoute>
      <QualityAnalysisContent />
    </AdminProtectedRoute>
  );
}

function QualityAnalysisContent() {
  const { getToken } = useAuth();
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<ThreadAnalysis | null>(null);
  const [analysisInput, setAnalysisInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleThreadSelect = (threadId: number) => {
    setSelectedThreadId(threadId);
    // Load thread analysis here
  };

  const sidebarContent = (
    <QualityAnalysisSidebar 
      onThreadSelect={handleThreadSelect}
      selectedThreadId={selectedThreadId}
    />
  );

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Quality Analysis</h1>
          <p className="text-gray-600">Analyze thread quality and generate insights</p>
        </div>

        {selectedThreadId ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Thread Info */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Thread #{selectedThreadId}</h3>
                  
                  {analysis ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Analysis Summary</h4>
                        <p className="text-gray-700">{analysis.summary}</p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{analysis.sessionCount}</div>
                          <div className="text-xs text-blue-600">Sessions</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{analysis.messageCount}</div>
                          <div className="text-xs text-green-600">Messages</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{analysis.formCount}</div>
                          <div className="text-xs text-purple-600">Forms</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No analysis available for this thread</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Analysis Controls */}
            <div className="space-y-6">
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Generate Analysis</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Analysis Focus</label>
                      <Input
                        placeholder="e.g., conversation quality, user engagement..."
                        value={analysisInput}
                        onChange={(e) => setAnalysisInput(e.target.value)}
                      />
                    </div>
                    
                    <Button 
                      onClick={() => {
                        setIsAnalyzing(true);
                        // Generate analysis logic here
                        setTimeout(() => {
                          setAnalysis({
                            threadId: selectedThreadId,
                            displayName: `Thread ${selectedThreadId}`,
                            sessionCount: 5,
                            messageCount: 23,
                            formCount: 2,
                            isAnalyzed: true,
                            summary: "This thread shows good engagement with consistent participation across multiple sessions. The user demonstrates clear communication patterns and the AI responses are appropriate and supportive."
                          });
                          setIsAnalyzing(false);
                        }, 2000);
                      }}
                      disabled={isAnalyzing || !analysisInput.trim()}
                      className="w-full"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Generate Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Select a thread from the sidebar to start analysis</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}