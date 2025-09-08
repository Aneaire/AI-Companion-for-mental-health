import { createRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HeaderUser from "@/integrations/clerk/header-user";
import { Link, useLocation } from "@tanstack/react-router";
import { MessageSquare, BarChart3, Send, Bot, User } from "lucide-react";

interface AnonymizedThread {
  id: number;
  displayName: string;
  sessionCount: number;
  createdAt: string;
}

interface AnalysisMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface ThreadAnalysis {
  threadId: number;
  displayName: string;
  sessionCount: number;
  messageCount: number;
  formCount: number;
  isAnalyzed: boolean;
  summary: string;
}

export const Route = createRoute({
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
  const { user } = useUser();
  const location = useLocation();
  const [selectedThread, setSelectedThread] = useState<AnonymizedThread | null>(null);
  const [draggedThread, setDraggedThread] = useState<AnonymizedThread | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [threadAnalysis, setThreadAnalysis] = useState<ThreadAnalysis | null>(null);
  const [analysisMessages, setAnalysisMessages] = useState<AnalysisMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: threads, isLoading: threadsLoading } = useQuery<AnonymizedThread[]>({
    queryKey: ["anonymizedThreads"],
    queryFn: async () => {
      console.log("Fetching anonymized threads...");
      
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch("http://localhost:4000/api/admin/threads/anonymized", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch threads:", response.status, response.statusText);
        throw new Error("Failed to fetch threads");
      }

      const data = await response.json();
      console.log("Got anonymized threads data:", data);
      return data;
    },
  });

  const handleDragStart = (thread: AnonymizedThread) => {
    setDraggedThread(thread);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedThread) {
      setSelectedThread(draggedThread);
      setDraggedThread(null);
    }
  };

  const handleThreadSelect = async (thread: AnonymizedThread) => {
    setSelectedThread(thread);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
    
    // Load thread analysis
    await loadThreadAnalysis(thread);
  };

  const loadThreadAnalysis = async (thread: AnonymizedThread) => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch(`http://localhost:4000/api/admin/threads/${thread.id}/analyze`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load thread analysis");
      }

      const analysis = await response.json();
      setThreadAnalysis(analysis);
      
      // Add initial AI message with analysis summary
      setAnalysisMessages([{
        id: Date.now().toString(),
        sender: 'ai',
        content: `Thread "${thread.displayName}" has been analyzed. This thread contains ${analysis.sessionCount} sessions with ${analysis.messageCount} messages and ${analysis.formCount} forms submitted.\n\n${analysis.summary}\n\nFeel free to ask me specific questions about the conversation flow, AI effectiveness, user engagement patterns, or therapeutic progress indicators.`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error("Error loading thread analysis:", error);
      setAnalysisMessages([{
        id: Date.now().toString(),
        sender: 'ai',
        content: "I apologize, but I encountered an error while analyzing this thread. Please try selecting another thread or refresh the page.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendAnalysisMessage = async () => {
    if (!inputMessage.trim() || !threadAnalysis || isLoading) return;
    
    const userMessage: AnalysisMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setAnalysisMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch(`http://localhost:4000/api/admin/threads/${threadAnalysis.threadId}/chat`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputMessage,
          conversationHistory: analysisMessages.slice(-10), // Send last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get analysis response");
      }

      const data = await response.json();
      
      const aiMessage: AnalysisMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        content: data.response,
        timestamp: new Date()
      };
      
      setAnalysisMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending analysis message:", error);
      const errorMessage: AnalysisMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        content: "I apologize, but I encountered an error processing your question. Please try again.",
        timestamp: new Date()
      };
      setAnalysisMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analysisMessages]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = sidebarRef.current;
      if (sidebar && !sidebar.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };
    if (isSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSidebarOpen]);

  if (threadsLoading) {
    return <div className="p-8">Loading threads...</div>;
  }

  return (
    <div className="flex h-screen w-full">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Navigation Section */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <MessageSquare size={16} />
              Chat
            </Link>
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/admin"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={16} />
              Admin
            </Link>
            <Link
              to="/quality-analysis"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/quality-analysis"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={16} />
              Quality Analysis
            </Link>
          </div>
        </div>

        {/* Threads Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-lg text-gray-800">Threads</span>
        </div>

        {/* Thread List */}
        <ScrollArea className="flex-1 min-h-0">
          {threads?.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">No threads available.</div>
          ) : (
            <ul>
              {threads?.map((thread) => (
                <li key={thread.id}>
                  <div
                    draggable
                    onDragStart={() => handleDragStart(thread)}
                    onClick={() => handleThreadSelect(thread)}
                    className={`flex flex-col px-4 py-3 cursor-move hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                      selectedThread?.id === thread.id
                        ? "bg-blue-50 border-l-4 border-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{thread.displayName}</span>
                      <span className="text-xs text-gray-500">
                        {thread.sessionCount} session{thread.sessionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Created: {new Date(thread.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-700">
                {user?.firstName?.charAt(0) || user?.emailAddresses?.[0]?.emailAddress?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.emailAddresses?.[0]?.emailAddress
                }
              </p>
              <p className="text-xs text-gray-500">
                Admin User
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(true)}
          >
            <MessageSquare size={20} />
            <span className="ml-2">Threads</span>
          </Button>
          <h1 className="font-semibold">Quality Analysis</h1>
        </div>

        {/* Analysis Area */}
        <div className="flex-1 flex flex-col">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedThread.displayName}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedThread.sessionCount} session{selectedThread.sessionCount !== 1 ? 's' : ''} • 
                      Created: {new Date(selectedThread.createdAt).toLocaleDateString()}
                      {threadAnalysis && (
                        <> • {threadAnalysis.messageCount} messages • {threadAnalysis.formCount} forms</>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedThread(null);
                      setThreadAnalysis(null);
                      setAnalysisMessages([]);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 flex flex-col bg-gray-50">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4 max-w-4xl mx-auto">
                    {analysisMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.sender === 'ai' && (
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Bot size={16} className="text-blue-600" />
                          </div>
                        )}
                        <div
                          className={`max-w-2xl px-4 py-3 rounded-lg ${
                            message.sender === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <p className={`text-xs mt-2 ${
                            message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        {message.sender === 'user' && (
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User size={16} className="text-gray-600" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Bot size={16} className="text-blue-600" />
                        </div>
                        <div className="bg-white text-gray-900 border border-gray-200 px-4 py-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                            <span className="text-sm text-gray-500 ml-2">Analyzing...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Chat Input */}
                <div className="p-4 bg-white border-t border-gray-200">
                  <div className="max-w-4xl mx-auto flex gap-3">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Ask about conversation flow, AI effectiveness, user engagement..."
                      className="flex-1"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendAnalysisMessage();
                        }
                      }}
                      disabled={isLoading || !threadAnalysis}
                    />
                    <Button 
                      onClick={sendAnalysisMessage}
                      disabled={!inputMessage.trim() || isLoading || !threadAnalysis}
                      size="icon"
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 max-w-4xl mx-auto">
                    This AI agent analyzes conversation patterns without revealing actual content. 
                    Ask about therapeutic effectiveness, engagement levels, or conversation flow.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div 
              className="flex-1 flex items-center justify-center p-6"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Card className="w-full max-w-md">
                <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="text-lg font-medium mb-2">Select a Thread to Analyze</h3>
                  <p className="text-sm">
                    Click on a thread from the sidebar or drag it here to start analyzing conversation effectiveness
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}