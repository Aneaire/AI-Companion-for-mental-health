import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@clerk/clerk-react";
import { HeadphonesIcon, MessageCircle, Plus, Circle, ChevronDown, ChevronRight } from "lucide-react";
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
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<"pending" | "current" | null>(null);

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

  const handleSectionClick = (section: "pending" | "current") => {
    if (selectedSection === section) {
      setSelectedSection(null);
      setIsAccordionOpen(false);
    } else {
      setSelectedSection(section);
      setIsAccordionOpen(true);
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

      {/* Accordion Button */}
      <div className="px-2">
        <Button
          variant="outline"
          className="w-full justify-between h-8 text-sm"
          onClick={() => setIsAccordionOpen(!isAccordionOpen)}
        >
          <span>Sessions</span>
          {isAccordionOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Accordion Content */}
      {isAccordionOpen && (
        <div className="px-2 space-y-2">
          {/* Pending Section */}
          <div>
            <button
              onClick={() => handleSectionClick("pending")}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedSection === "pending"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Pending Requests</span>
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {pendingRequests.length}
                  </Badge>
                )}
              </div>
            </button>

            {selectedSection === "pending" && (
              <div className="mt-2 space-y-2">
                {pendingRequests.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    No pending requests
                  </div>
                ) : (
                  pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="px-3 py-2 rounded-lg border border-yellow-200 bg-yellow-50"
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
                  ))
                )}
              </div>
            )}
          </div>

          {/* Current Sessions Section */}
          <div>
            <button
              onClick={() => handleSectionClick("current")}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedSection === "current"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Current Sessions</span>
                {activeChats.length > 0 && (
                  <Badge variant="default" className="text-xs h-5 px-1.5">
                    {activeChats.length}
                  </Badge>
                )}
              </div>
            </button>

            {selectedSection === "current" && (
              <div className="mt-2 space-y-2">
                {activeChats.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    No active sessions
                  </div>
                ) : (
                  activeChats.map((chat) => {
                    const request = requests.find(req => req.id === chat.requestId);
                    return (
                      <button
                        key={chat.id}
                        onClick={() => onSelectChat(chat)}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-200 ${
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
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show active session when selected */}
      {selectedSection === "current" && selectedChatId && (
        <div className="px-2 mt-4">
          <div className="text-center text-xs text-gray-500 mb-2">
            Active session selected
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isAccordionOpen && activeChats.length === 0 && requests.length === 0 && (
        <div className="px-4 py-8 text-center">
          <HeadphonesIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No counselor sessions</p>
          <p className="text-xs text-gray-400 mt-1">Click + to request support</p>
        </div>
      )}
    </div>
  );
}