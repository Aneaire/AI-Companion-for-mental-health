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
        console.log("CounselorSidebar - User requests:", requestsData.requests);
        setRequests(requestsData.requests || []);
      } else {
        console.error("Failed to fetch requests:", requestsResponse.status);
      }

      // Update active chats from real chat data
      if (chatsResponse.ok) {
        const chatsData = await chatsResponse.json();
        console.log("CounselorSidebar - User chats:", chatsData.chats);
        setActiveChats(chatsData.chats || []);
      } else {
        console.error("Failed to fetch chats:", chatsResponse.status);
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

      <ScrollArea className="flex-1 min-h-0">
        {activeChats.length === 0 && requests.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <HeadphonesIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No counselor sessions</p>
            <p className="text-xs text-gray-400 mt-1">Click + to request support</p>
          </div>
        ) : (
          <div className="space-y-2 px-2">
            {/* Active Chats */}
            {activeChats.map((chat) => {
              const request = requests.find(req => req.id === chat.requestId);
              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                    selectedChatId === chat.id
                      ? "bg-blue-50 border-blue-200 shadow-sm"
                      : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageCircle className="h-3 w-3 text-blue-600" />
                        <span className="font-medium text-sm truncate">Counselor Chat</span>
                        <div className={`w-2 h-2 rounded-full ${getStatusDot(chat.status)}`} />
                      </div>
                      {request && (
                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                          {request.requestReason}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(chat.status)} className="text-xs">
                          {chat.status}
                        </Badge>
                        {request && (
                          <Badge variant={getUrgencyColor(request.urgencyLevel)} className="text-xs">
                            {request.urgencyLevel}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatTime(chat.startedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Pending Requests */}
            {requests
              .filter(req => req.status === "pending")
              .map((request) => (
                <div
                  key={request.id}
                  className="p-3 rounded-lg border border-yellow-200 bg-yellow-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="font-medium text-sm">Pending Request</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {request.requestReason}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          PENDING
                        </Badge>
                        <Badge variant={getUrgencyColor(request.urgencyLevel)} className="text-xs">
                          {request.urgencyLevel}
                        </Badge>
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatTime(request.requestedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            {/* Completed/Cancelled Requests */}
            {requests
              .filter(req => ["completed", "cancelled"].includes(req.status))
              .map((request) => (
                <div
                  key={request.id}
                  className="p-3 rounded-lg border border-gray-200 bg-gray-50 opacity-70"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="font-medium text-sm text-gray-600">
                          {request.status === "completed" ? "Completed" : "Cancelled"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                        {request.requestReason}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {request.status.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatTime(request.completedAt || request.requestedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}