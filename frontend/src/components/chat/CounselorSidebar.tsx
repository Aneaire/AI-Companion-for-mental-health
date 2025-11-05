import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@clerk/clerk-react";
import { HeadphonesIcon, MessageCircle, Plus, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface CounselorRequest {
  id: number;
  status: "pending" | "accepted" | "completed" | "cancelled";
  requestReason: string;
  urgencyLevel: "low" | "medium" | "high" | "urgent";
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
}

interface CounselorChat {
  id: number;
  requestId: number;
  status: "active" | "ended";
  startedAt: string;
  messageCount: number;
}

interface CounselorSidebarProps {
  onSelectChat: (chat: CounselorChat) => void;
  onOpenRequestDialog: () => void;
  selectedChatId: number | null;
}

export function CounselorSidebar({ 
  onSelectChat, 
  onOpenRequestDialog, 
  selectedChatId 
}: CounselorSidebarProps) {
  const { getToken } = useAuth();
  const [requests, setRequests] = useState<CounselorRequest[]>([]);
  const [activeChats, setActiveChats] = useState<CounselorChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<"pending" | "current" | null>(null);

  useEffect(() => {
    fetchCounselorData();
    // Set up polling for real-time updates
    const interval = setInterval(fetchCounselorData, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchCounselorData = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      // Fetch requests and chats in parallel
      const [requestsResponse, chatsResponse] = await Promise.all([
        fetch("/api/counselor/user/requests", {
          headers: { "Authorization": `Bearer ${token}` },
        }),
        fetch("/api/counselor/user/chats", {
          headers: { "Authorization": `Bearer ${token}` },
        }),
      ]);

      // Update requests
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setRequests(requestsData.requests || []);
      }

      // Update active chats from real chat data
      if (chatsResponse.ok) {
        const chatsData = await chatsResponse.json();
        setActiveChats(chatsData.chats || []);
      }
    } catch (error) {
      console.error("Error fetching counselor data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "secondary";
      case "accepted": return "default";
      case "completed": return "secondary";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500";
      case "accepted": return "bg-green-500";
      case "active": return "bg-green-500";
      case "completed": return "bg-gray-400";
      case "ended": return "bg-gray-400";
      case "cancelled": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter(req => req.status === "pending");
  const completedRequests = requests.filter(req => ["completed", "cancelled"].includes(req.status));

  const selectView = (view: "pending" | "current") => {
    setSelectedView(view === selectedView ? null : view);
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <HeadphonesIcon className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-sm">Counselor</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 rounded-full hover:bg-blue-100"
          onClick={onOpenRequestDialog}
          title="Request Counselor"
        >
          <Plus className="text-blue-600 h-3 w-3" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-2">
        <div className="flex space-x-1 border-b border-gray-200">
          {/* Current Sessions Tab */}
          <button
            onClick={() => selectView("current")}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-200 border-b-2 ${
              selectedView === "current"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <MessageCircle className="h-3 w-3" />
            <span>Current Sessions</span>
            {activeChats.length > 0 && (
              <Badge variant="secondary" className="text-xs h-4 px-1.5">
                {activeChats.length}
              </Badge>
            )}
          </button>

          {/* Pending Requests Tab */}
          <button
            onClick={() => selectView("pending")}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-200 border-b-2 ${
              selectedView === "pending"
                ? "text-yellow-600 border-yellow-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="text-xs h-4 px-1.5">
                {pendingRequests.length}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <ScrollArea className="flex-1 min-h-0">
        {selectedView === "current" && (
          <div className="px-2">
            {activeChats.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No active sessions</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activeChats.map((chat) => {
                  const request = requests.find(req => req.id === chat.requestId);
                  return (
                    <div
                      key={chat.id}
                      className={`cursor-pointer transition-all duration-200 rounded px-2 py-2 ${
                        selectedChatId === chat.id
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => onSelectChat(chat)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <MessageCircle className="h-2 w-2 text-blue-600" />
                          </div>
                          <span className="text-sm font-medium truncate">
                            Counselor Chat
                          </span>
                          <div className={`w-2 h-2 rounded-full ${getStatusDot(chat.status)} flex-shrink-0`} />
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant={getStatusColor(chat.status)} className="text-xs px-1 py-0 h-5">
                            {chat.status}
                          </Badge>
                          {request && (
                            <Badge variant={getUrgencyColor(request.urgencyLevel)} className="text-xs px-1 py-0 h-5">
                              {request.urgencyLevel}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">
                            {formatTime(chat.startedAt)}
                          </span>
                        </div>
                      </div>
                      {request && (
                        <p className="text-xs text-gray-600 line-clamp-2 mt-1 ml-6">
                          {request.requestReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedView === "pending" && (
          <div className="px-2">
            {pendingRequests.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                </div>
                <p className="text-sm text-gray-500">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-1">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-2 rounded-lg border border-yellow-200 bg-yellow-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">Pending Request</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs px-1 py-0 h-5">
                          PENDING
                        </Badge>
                        <Badge variant={getUrgencyColor(request.urgencyLevel)} className="text-xs px-1 py-0 h-5">
                          {request.urgencyLevel}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {formatTime(request.requestedAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                      {request.requestReason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Default state when nothing is selected */}
        {!selectedView && (activeChats.length === 0 && requests.length === 0) && (
          <div className="px-4 py-8 text-center">
            <HeadphonesIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No counselor sessions</p>
            <p className="text-xs text-gray-400 mt-1">Click + to request support</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}