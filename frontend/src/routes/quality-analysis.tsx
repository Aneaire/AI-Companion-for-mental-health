import { createRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useInfiniteQuery } from "@tanstack/react-query";
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
import { useInView } from "react-intersection-observer";

interface AnonymizedThread {
  id: number;
  displayName: string;
  sessionCount: number;
  createdAt: string;
}

interface ThreadsResponse {
  threads: AnonymizedThread[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalThreads: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
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
  context?: {
    threadId: number;
    sessionCount: number;
    messageCount: number;
    formCount: number;
    initialForm: any;
    sessions: any[];
    messages: any[];
    forms: any[];
  };
  metrics?: {
    userMessages: number;
    aiMessages: number;
    avgUserMessageLength: number;
    avgAiMessageLength: number;
    sessionCompletionRate: number;
    formsPerSession: number;
    completedSessions: number;
  };
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
  const threadsPerPage = 10;

  const {
    data: threadsData,
    isLoading: threadsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage
  } = useInfiniteQuery<ThreadsResponse, Error>({
    queryKey: ["anonymizedThreads"],
    queryFn: async ({ pageParam = 1 }) => {
      console.log("Fetching anonymized threads...", { page: pageParam, limit: threadsPerPage });
      
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const url = new URL("http://localhost:4000/api/admin/threads/anonymized");
      url.searchParams.set("page", pageParam.toString());
      url.searchParams.set("limit", threadsPerPage.toString());
      
      const response = await fetch(url.toString(), {
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
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNext ? lastPage.pagination.currentPage + 1 : undefined;
    },
    initialPageParam: 1,
  });

  // Extract threads and pagination data
  const threads = threadsData?.pages.flatMap(page => page.threads) || [];
  const pagination = threadsData?.pages[threadsData.pages.length - 1]?.pagination;

  // Intersection observer for infinite scrolling
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  // Load more when the element comes into view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
      
      // Add initial AI message with comprehensive analysis summary
      const metricsInfo = analysis.metrics ? 
        `\n\n**Detailed Metrics:**\n• User Messages: ${analysis.metrics.userMessages} (avg ${analysis.metrics.avgUserMessageLength} chars)\n• AI Messages: ${analysis.metrics.aiMessages} (avg ${analysis.metrics.avgAiMessageLength} chars)\n• Session Completion: ${analysis.metrics.completedSessions}/${analysis.sessionCount} (${analysis.metrics.sessionCompletionRate}%)\n• Forms per Session: ${analysis.metrics.formsPerSession}` 
        : '';
      
      setAnalysisMessages([{
        id: Date.now().toString(),
        sender: 'ai',
        content: `Thread "${thread.displayName}" has been comprehensively analyzed with full context access including all messages, forms, and user interactions.\n\n**Thread Overview:**\n• ${analysis.sessionCount} sessions with ${analysis.messageCount} total messages\n• ${analysis.formCount} forms submitted (${analysis.context?.initialForm ? '1 initial + ' : ''}${(analysis.formCount || 0) - (analysis.context?.initialForm ? 1 : 0)} generated)\n• Complete conversation history and therapeutic progression data available${metricsInfo}\n\n**Analysis Summary:**\n${analysis.summary}\n\n**Available Analysis Types:**\nI can provide detailed insights on:\n• **Effectiveness**: AI response quality, therapeutic intervention success\n• **Engagement**: User participation patterns, session commitment\n• **Flow**: Conversation progression, therapeutic continuity\n• **Session Comparison**: Individual session metrics and trends\n• **Assessment Integration**: Form completion patterns, progress tracking\n\nWhat specific aspect would you like me to analyze using the complete thread context?`,
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

      // Handle streaming response from Gemini
      let aiResponseText = "";
      const aiMessage: AnalysisMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        content: "",
        timestamp: new Date()
      };
      
      // Add the AI message immediately and update it as chunks come in
      setAnalysisMessages(prev => [...prev, aiMessage]);
      
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const chunkText = line.slice(6);
                if (chunkText && chunkText !== '[DONE]') {
                  aiResponseText += chunkText;
                  // Update the AI message content in real-time
                  setAnalysisMessages(prev => 
                    prev.map(msg => 
                      msg.id === aiMessage.id 
                        ? { ...msg, content: aiResponseText }
                        : msg
                    )
                  );
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        // Fallback for non-streaming response
        const data = await response.json();
        aiResponseText = data.response || "Analysis completed.";
        setAnalysisMessages(prev => 
          prev.map(msg => 
            msg.id === aiMessage.id 
              ? { ...msg, content: aiResponseText }
              : msg
          )
        );
      }
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
    <div className="flex h-screen w-full min-h-0">
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
          {pagination && (
            <span className="text-xs text-gray-500">
              {threads.length} of {pagination.totalThreads}
            </span>
          )}
        </div>

        {/* Thread List */}
        <ScrollArea className="flex-1 min-h-0">
          {threadsLoading ? (
            <div className="p-4 text-gray-500 text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Loading threads...
            </div>
          ) : threads?.length === 0 ? (
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
          
          {/* Load More Trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="p-4 text-center">
              {isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Loading more threads...
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  Scroll to load more
                </div>
              )}
            </div>
          )}
          
          {/* End of List Indicator */}
          {!hasNextPage && threads.length > 0 && (
            <div className="p-4 text-center">
              <div className="text-xs text-gray-400">
                All {pagination?.totalThreads || threads.length} threads loaded
              </div>
            </div>
          )}
        </ScrollArea>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <HeaderUser />
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
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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
        <div className="flex-1 flex flex-col min-h-0">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                        <BarChart3 size={20} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedThread.displayName}</h2>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            {selectedThread.sessionCount} session{selectedThread.sessionCount !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Created: {new Date(selectedThread.createdAt).toLocaleDateString()}
                          </span>
                          {threadAnalysis && (
                            <>
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                {threadAnalysis.messageCount} messages
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                {threadAnalysis.formCount} forms
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => {
                        setSelectedThread(null);
                        setThreadAnalysis(null);
                        setAnalysisMessages([]);
                      }}
                      variant="outline"
                      size="sm"
                      className="border-gray-300 hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      Clear Analysis
                    </Button>
                  </div>
                </div>
               </div>

              {/* Chat Messages */}
              <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 min-h-0">
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth" style={{scrollBehavior: 'smooth'}}>
                  <div className="space-y-6 max-w-5xl mx-auto">
                    {analysisMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'} group`}
                      >
                        {message.sender === 'ai' && (
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                            <Bot size={18} className="text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-3xl px-6 py-4 rounded-2xl shadow-sm transition-all duration-200 group-hover:shadow-md ${
                            message.sender === 'user'
                              ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md'
                              : 'bg-white text-gray-800 border border-gray-200/50 rounded-bl-md'
                          }`}
                        >
                          <div className={`prose prose-sm max-w-none ${
                            message.sender === 'user' 
                              ? 'prose-invert prose-headings:text-blue-50 prose-strong:text-blue-50' 
                              : 'prose-gray prose-headings:text-gray-800 prose-strong:text-gray-800'
                          }`}>
                            <div className="whitespace-pre-wrap leading-relaxed">
                              {message.content.split('\n').map((line, index) => {
                                // Function to render text with bold formatting
                                const renderTextWithBold = (text: string) => {
                                  if (!text.includes('**')) {
                                    return <span>{text}</span>;
                                  }
                                  const parts = text.split('**');
                                  return (
                                    <>
                                      {parts.map((part, partIndex) => 
                                        partIndex % 2 === 1 ? (
                                          <strong key={partIndex} className={`font-semibold ${
                                            message.sender === 'user' ? 'text-blue-100' : 'text-gray-900'
                                          }`}>
                                            {part}
                                          </strong>
                                        ) : (
                                          <span key={partIndex}>{part}</span>
                                        )
                                      )}
                                    </>
                                  );
                                };

                                // Handle bullet points (with possible bold text inside)
                                if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                                  const bulletContent = line.replace(/^[•\-]\s*/, '');
                                  return (
                                    <div key={index} className="flex items-start gap-2 my-1">
                                      <span className={`inline-block w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                                        message.sender === 'user' ? 'bg-blue-200' : 'bg-blue-500'
                                      }`}></span>
                                      <span>{renderTextWithBold(bulletContent)}</span>
                                    </div>
                                  );
                                }
                                
                                // Handle lines with bold text (non-bullet)
                                if (line.includes('**')) {
                                  return (
                                    <div key={index} className="my-2">
                                      {renderTextWithBold(line)}
                                    </div>
                                  );
                                }
                                
                                // Handle regular lines
                                return line ? <div key={index} className="my-1">{line}</div> : <div key={index} className="h-2"></div>;
                              })}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-opacity-20">
                            <p className={`text-xs ${
                              message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {message.timestamp.toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                            {message.sender === 'ai' && (
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                <span>Analysis</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {message.sender === 'user' && (
                          <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                            <User size={18} className="text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-4 justify-start group">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Bot size={18} className="text-white" />
                        </div>
                        <div className="bg-white text-gray-800 border border-gray-200/50 px-6 py-4 rounded-2xl rounded-bl-md shadow-sm max-w-3xl">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                              <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                              <div className="w-2.5 h-2.5 bg-blue-300 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                            </div>
                            <span className="text-sm text-gray-600 font-medium">Analyzing thread context...</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Processing conversation patterns and metrics</p>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Chat Input */}
                <div className="bg-white border-t border-gray-200 shadow-lg">
                  <div className="max-w-5xl mx-auto p-6">
                    {/* Quick Analysis Buttons */}
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: "💡 Effectiveness", query: "How effective was the AI in this conversation?" },
                          { label: "👥 User Engagement", query: "Analyze user engagement patterns" },
                          { label: "🔄 Conversation Flow", query: "How was the conversation flow and progression?" },
                          { label: "📊 Session Comparison", query: "Compare individual sessions" },
                          { label: "📋 Assessment Integration", query: "How well were assessments integrated?" }
                        ].map((button) => (
                          <button
                            key={button.label}
                            onClick={() => setInputMessage(button.query)}
                            disabled={isLoading || !threadAnalysis}
                            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {button.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input Area */}
                    <div className="relative flex items-end gap-3">
                      <div className="flex-1 relative">
                        <Input
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          placeholder="Ask about effectiveness, engagement, flow, session comparison, or assessment patterns..."
                          className="pr-12 py-3 text-sm border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendAnalysisMessage();
                            }
                          }}
                          disabled={isLoading || !threadAnalysis}
                        />
                        {inputMessage.trim() && (
                          <button
                            onClick={() => setInputMessage('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <Button 
                        onClick={sendAnalysisMessage}
                        disabled={!inputMessage.trim() || isLoading || !threadAnalysis}
                        className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                        size="icon"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send size={18} />
                        )}
                      </Button>
                    </div>

                    {/* Status and Info */}
                    <div className="flex items-center justify-between mt-3 text-xs">
                      <div className="text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${threadAnalysis ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                          {threadAnalysis ? 'Full thread context loaded' : 'Select a thread to analyze'}
                        </span>
                      </div>
                      <div className="text-gray-400">
                        Press Enter to send • Shift+Enter for new line
                      </div>
                    </div>


                  </div>
                </div>
              </div>
            </>
          ) : (
            <div 
              className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="w-full max-w-2xl">
                <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                  <div className="p-12 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                      <BarChart3 size={32} className="text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Quality Analysis Dashboard</h3>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                      Select a thread from the sidebar to perform comprehensive quality analysis. 
                      Get insights into therapeutic effectiveness, user engagement patterns, and conversation flow.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <Bot size={16} className="text-white" />
                          </div>
                          <h4 className="font-semibold text-blue-900">AI Effectiveness</h4>
                        </div>
                        <p className="text-sm text-blue-700">Analyze response quality and therapeutic engagement</p>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                            <User size={16} className="text-white" />
                          </div>
                          <h4 className="font-semibold text-green-900">User Engagement</h4>
                        </div>
                        <p className="text-sm text-green-700">Track participation levels and session commitment</p>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                            <MessageSquare size={16} className="text-white" />
                          </div>
                          <h4 className="font-semibold text-purple-900">Conversation Flow</h4>
                        </div>
                        <p className="text-sm text-purple-700">Evaluate progression and therapeutic continuity</p>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                            <BarChart3 size={16} className="text-white" />
                          </div>
                          <h4 className="font-semibold text-orange-900">Session Metrics</h4>
                        </div>
                        <p className="text-sm text-orange-700">Compare individual sessions and trends</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Click</strong> on a thread from the sidebar or <strong>drag & drop</strong> it here
                      </p>
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        Ready for analysis
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}