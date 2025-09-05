import { createRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import HeaderUser from "@/integrations/clerk/header-user";
import { Link, useLocation } from "@tanstack/react-router";
import { MessageSquare, BarChart3 } from "lucide-react";

interface AnonymizedThread {
  id: number;
  displayName: string;
  sessionCount: number;
  createdAt: string;
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

  const { data: threads, isLoading } = useQuery<AnonymizedThread[]>({
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

  const handleThreadSelect = (thread: AnonymizedThread) => {
    setSelectedThread(thread);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

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

  if (isLoading) {
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
        <div className="flex-1 p-6">
          <div className="hidden md:block mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Quality Analysis</h1>
          </div>
          
          <Card className="h-full">
            <div
              className="h-full p-6 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {selectedThread ? (
                <div className="w-full max-w-2xl">
                  <div className="text-center mb-6">
                    <h4 className="text-2xl font-semibold text-gray-900">{selectedThread.displayName}</h4>
                    <p className="text-gray-600 mt-2">
                      {selectedThread.sessionCount} session{selectedThread.sessionCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Created: {new Date(selectedThread.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h5 className="font-medium text-gray-900 mb-3">Thread Analysis Overview</h5>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        All sessions and messages will be loaded
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Session forms and responses
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Quality analysis metrics
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center mt-6">
                    <Button
                      onClick={() => setSelectedThread(null)}
                      variant="outline"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="text-lg font-medium mb-2">Select a Thread to Analyze</h3>
                  <p className="text-sm max-w-md">
                    Click on a thread from the sidebar or drag it here to load all thread data for quality analysis
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}