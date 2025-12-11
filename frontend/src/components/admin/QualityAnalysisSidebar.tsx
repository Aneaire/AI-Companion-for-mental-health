import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Users, ChevronDown, ChevronRight } from "lucide-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@clerk/clerk-react";

interface AnonymizedUser {
  id: string;
  displayName: string;
  threadCount: number;
  totalSessions: number;
  totalMessages: number;
  createdAt: string;
}

interface UserThreadsResponse {
  users: AnonymizedUser[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
}

interface UserThread {
  id: number;
  displayName: string;
  sessionCount: number;
  messageCount: number;
  createdAt: string;
}

interface ThreadResponse {
  threads: UserThread[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalThreads: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
}

interface QualityAnalysisSidebarProps {
  onUserSelect: (userId: string) => void;
  onThreadSelect: (threadId: number) => void;
  selectedUserId: string | null;
  selectedThreadId: number | null;
}

export function QualityAnalysisSidebar({ onUserSelect, onThreadSelect, selectedUserId, selectedThreadId }: QualityAnalysisSidebarProps) {
  const { getToken } = useAuth();
  const { ref, inView } = useInView();
  const [expandedUsers, setExpandedUsers] = React.useState<Set<string>>(new Set());

  // Fetch users
  const {
    data: usersData,
    fetchNextPage: fetchNextUserPage,
    hasNextPage: hasNextUserPage,
    isFetchingNextPage: isFetchingNextUserPage,
    isLoading: isUsersLoading,
  } = useInfiniteQuery<UserThreadsResponse>({
    queryKey: ["qualityUsers"],
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const searchParams = new URLSearchParams({
        page: (pageParam as number).toString(),
        limit: "20",
      });

      const response = await fetch(`/api/quality/users?${searchParams}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      return response.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasNext ? lastPage.pagination.currentPage + 1 : undefined,
  });

  // Fetch threads for expanded users
  const { data: threadsDataMap, isLoading: isThreadsLoading } = useQuery({
    queryKey: ["userThreads", Array.from(expandedUsers)],
    queryFn: async () => {
      if (expandedUsers.size === 0) return {};
      
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      // Fetch threads for all expanded users
      const threadsPromises = Array.from(expandedUsers).map(async (userId) => {
        const response = await fetch(`/api/quality/users/${userId}/threads`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user threads: ${response.status}`);
        }

        const data = await response.json() as ThreadResponse;
        return { userId, threads: data.threads };
      });

      const results = await Promise.all(threadsPromises);
      const threadsMap: Record<string, UserThread[]> = {};
      results.forEach(({ userId, threads }) => {
        threadsMap[userId] = threads;
      });
      
      return threadsMap;
    },
    enabled: expandedUsers.size > 0,
  });

  // Load more users when scrolling to bottom
  React.useEffect(() => {
    if (inView && hasNextUserPage && !isFetchingNextUserPage) {
      fetchNextUserPage();
    }
  }, [inView, hasNextUserPage, isFetchingNextUserPage, fetchNextUserPage]);

  const users = usersData?.pages.flatMap((page: UserThreadsResponse) => page.users) || [];
  const threadsMap = threadsDataMap || {};

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const toggleUserExpansion = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  if (isUsersLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Users List */}
      <ScrollArea className="h-[450px]">
        <div className="space-y-1 pr-2">
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No users found</p>
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id}>
                <div
                  className={`cursor-pointer transition-all duration-200 rounded px-2 py-2 ${
                    selectedUserId === user.id 
                      ? "bg-blue-50 border border-blue-200" 
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    onUserSelect(user.id);
                    if (!expandedUsers.has(user.id)) {
                      toggleUserExpansion(user.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="h-2 w-2 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium truncate">
                        {user.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant="outline" className="text-sm px-1 py-0 h-5">
                        {user.threadCount}
                      </Badge>
                      <div 
                        className="w-4 h-4 flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleUserExpansion(user.id);
                        }}
                      >
                        {expandedUsers.has(user.id) ? (
                          <ChevronDown className="h-3 w-3 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-gray-600" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* User's Threads - Show when expanded */}
                {expandedUsers.has(user.id) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {isThreadsLoading ? (
                      <div className="p-2">
                        <div className="animate-pulse space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-100 rounded"></div>
                          ))}
                        </div>
                      </div>
                    ) : !threadsMap[user.id] || threadsMap[user.id].length === 0 ? (
                      <div className="p-2 text-center">
                        <MessageSquare className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">No threads found</p>
                      </div>
                    ) : (
                      threadsMap[user.id].map((thread: UserThread) => (
                        <div
                          key={thread.id}
                          className={`cursor-pointer transition-all duration-200 rounded px-2 py-1 ml-4 ${
                            selectedThreadId === thread.id 
                              ? "bg-blue-100 border border-blue-300" 
                              : "hover:bg-gray-100"
                          }`}
                          onClick={() => onThreadSelect(thread.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-3 h-3 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <MessageSquare className="h-1.5 w-1.5 text-green-600" />
                              </div>
                              <span className="text-xs font-medium truncate">
                                {thread.displayName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                                {thread.sessionCount}
                              </Badge>
                              <span className="text-xs text-gray-400">
                                {thread.messageCount} msgs
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatTime(thread.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          
          {/* Load More Users Trigger */}
          {hasNextUserPage && (
            <div ref={ref} className="flex justify-center py-3">
              {isFetchingNextUserPage ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextUserPage()}
                  className="text-sm h-7"
                >
                  Load More Users
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Summary Stats */}
      <div className="px-2 py-2 bg-gray-50 rounded text-sm text-gray-600 flex justify-between">
        <span>Total Users:</span>
        <span className="font-medium">
          {(usersData?.pages[0] as UserThreadsResponse)?.pagination.totalUsers || 0}
        </span>
      </div>
    </div>
  );
}