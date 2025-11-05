import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Eye, User } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@clerk/clerk-react";

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

interface QualityAnalysisSidebarProps {
  onThreadSelect: (threadId: number) => void;
  selectedThreadId: number | null;
}

export function QualityAnalysisSidebar({ onThreadSelect, selectedThreadId }: QualityAnalysisSidebarProps) {
  const { getToken } = useAuth();
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<ThreadsResponse>({
    queryKey: ["qualityThreads"],
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const searchParams = new URLSearchParams({
        page: (pageParam as number).toString(),
        limit: "30",
      });

      const response = await fetch(`/api/quality/threads?${searchParams}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch threads: ${response.status}`);
      }

      return response.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasNext ? lastPage.pagination.currentPage + 1 : undefined,
  });

  // Load more threads when scrolling to bottom
  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const threads = data?.pages.flatMap((page: ThreadsResponse) => page.threads) || [];

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

  if (isLoading) {
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
      {/* Threads List */}
      <ScrollArea className="h-[450px]">
        <div className="space-y-1 pr-2">
          {threads.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No threads found</p>
            </div>
          ) : (
            threads.map((thread) => (
              <Card
                key={thread.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-sm ${
                  selectedThreadId === thread.id 
                    ? "ring-1 ring-blue-500 bg-blue-50" 
                    : "hover:bg-gray-50"
                }`}
                onClick={() => onThreadSelect(thread.id)}
              >
                <div className="p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-2.5 w-2.5 text-blue-600" />
                      </div>
                      <span className="text-xs font-medium truncate">
                        {thread.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                        {thread.sessionCount}
                      </Badge>
                      <span className="text-xs text-gray-400 ml-1">
                        {formatTime(thread.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
          
          {/* Load More Trigger */}
          {hasNextPage && (
            <div ref={ref} className="flex justify-center py-3">
              {isFetchingNextPage ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  className="text-xs h-7"
                >
                  Load More
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Summary Stats */}
      <div className="p-2 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-600 flex justify-between">
          <span>Total Threads:</span>
          <span className="font-medium">
            {(data?.pages[0] as ThreadsResponse)?.pagination.totalThreads || 0}
          </span>
        </div>
      </div>
    </div>
  );
}