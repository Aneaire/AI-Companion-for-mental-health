import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  AlertTriangle, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  User 
} from "lucide-react";
import type { CounselorRequest, CounselorChat, ActiveView } from "@/types/counselor";
import { formatRelativeTime } from "@/lib/utils";

interface CounselorSidebarProps {
  requests: CounselorRequest[];
  chats: CounselorChat[];
  activeView: ActiveView;
  selectedChat: CounselorChat | null;
  onActiveViewChange: (view: ActiveView) => void;
  onChatSelect: (chat: CounselorChat) => void;
  onRequestAccept: (requestId: string) => void;
  isAccepting: string | null;
}

export function CounselorSidebar({
  requests,
  chats,
  activeView,
  selectedChat,
  onActiveViewChange,
  onChatSelect,
  onRequestAccept,
  isAccepting,
}: CounselorSidebarProps) {
  const [isAccordionOpen, setIsAccordionOpen] = useState(true);

  const toggleAccordion = () => {
    setIsAccordionOpen(!isAccordionOpen);
  };

  const selectView = (view: "pending" | "current") => {
    onActiveViewChange(view);
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  const getUrgencyBadgeStyles = (level: string) => {
    switch (level) {
      case "high": 
        return "bg-red-100 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getUserName = (user?: CounselorRequest['user'] | CounselorChat['user']) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.firstName || user?.nickname || "Anonymous User";
  };

  const activeChats = chats.filter(c => c.status === "active");
  const pendingRequests = requests.filter(r => r.status === "pending");

  return (
    <div className="space-y-4">
      {/* Accordion Button */}
      <div className="space-y-2">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-lg blur-sm"></div>
          <Button
            variant="outline"
            onClick={toggleAccordion}
            className="w-full justify-between bg-white/80 backdrop-blur-sm border-gray-200/60 hover:bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 relative"
          >
            <span className="font-medium text-gray-800">Counseling Options</span>
            {isAccordionOpen ? (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            )}
          </Button>
        </div>
        
        {/* Accordion Content */}
        {isAccordionOpen && (
          <div className="space-y-1 pl-2 border-l-2 border-gradient-to-b from-blue-300 to-purple-300 ml-2">
            <Button
              variant={activeView === "pending" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => selectView("pending")}
              className={`w-full justify-start text-sm transition-all duration-200 ${
                activeView === "pending" 
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span>Pending Requests</span>
                <Badge variant={activeView === "pending" ? "secondary" : "outline"} className="ml-2">
                  {pendingRequests.length}
                </Badge>
              </div>
            </Button>
            <Button
              variant={activeView === "current" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => selectView("current")}
              className={`w-full justify-start text-sm transition-all duration-200 ${
                activeView === "current" 
                  ? "bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-md" 
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span>Current Sessions</span>
                <Badge variant={activeView === "current" ? "secondary" : "outline"} className="ml-2">
                  {activeChats.length}
                </Badge>
              </div>
            </Button>
          </div>
        )}
      </div>

      {/* Current Sessions Sidebar */}
      {activeView === "current" && (
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg blur-sm"></div>
            <div className="relative px-3 py-2 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/60">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Active Sessions</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-green-600">
                    {activeChats.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <ScrollArea className="h-[350px]">
            {activeChats.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 font-medium">No active sessions</p>
                <p className="text-xs text-gray-400 mt-1">Accept pending requests to start</p>
              </div>
            ) : (
              <div className="space-y-2 px-1">
                {activeChats.map((chat) => (
                  <div
                    key={chat.$id}
                    className={`group cursor-pointer transition-all duration-200 rounded-xl p-3 ${
                      selectedChat?.$id === chat.$id 
                        ? "bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-300/60 shadow-md" 
                        : "bg-white/60 backdrop-blur-sm border border-gray-200/40 hover:bg-white/80 hover:border-blue-200/60 hover:shadow-sm"
                    }`}
                    onClick={() => onChatSelect(chat)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 overflow-hidden ${
                          selectedChat?.$id === chat.$id
                            ? "bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm"
                            : "bg-gradient-to-br from-green-400 to-blue-500"
                        }`}>
                          {chat.user?.profileImageUrl ? (
                            <img
                              src={chat.user.profileImageUrl}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {getUserName(chat.user)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatRelativeTime(chat.startedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge 
                          variant={selectedChat?.$id === chat.$id ? "default" : "outline"} 
                          className="text-xs px-2 py-1 h-5 bg-blue-100 text-blue-700 border-blue-200"
                        >
                          {chat.messageCount}
                        </Badge>
                        {selectedChat?.$id === chat.$id && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Stats Summary */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-xl blur-sm"></div>
        <div className="relative p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-red-200/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <AlertTriangle className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-gray-800">Counseling Stats</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-orange-50/60 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-orange-600" />
                <span className="text-xs font-medium text-gray-700">Pending</span>
              </div>
              <span className="text-sm font-bold text-orange-600">
                {pendingRequests.length}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50/60 rounded-lg">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium text-gray-700">Active</span>
              </div>
              <span className="text-sm font-bold text-green-600">
                {activeChats.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}