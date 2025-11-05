import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, Eye, User } from "lucide-react";
import { useState } from "react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<ThreadsResponse>({
    queryKey: ["qualityThreads", searchTerm],
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const searchParams = new URLSearchParams({
        page: (pageParam as number).toString(),
        limit: "20",
        ...(searchTerm && { search: searchTerm }),
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
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search threads..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Threads List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-2">
          {threads.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No threads found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search</p>
            </div>
          ) : (
            threads.map((thread) => (
              <Card
                key={thread.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedThreadId === thread.id 
                    ? "ring-2 ring-blue-500 bg-blue-50" 
                    : "hover:bg-gray-50"
                }`}
                onClick={() => onThreadSelect(thread.id)}
              >
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-3 w-3 text-blue-600" />
                      </div>
                      <span className="font-medium text-sm truncate">
                        {thread.displayName}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {thread.sessionCount} sessions
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {formatTime(thread.createdAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onThreadSelect(thread.id);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
          
          {/* Load More Trigger */}
          {hasNextPage && (
            <div ref={ref} className="flex justify-center py-4">
              {isFetchingNextPage ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                >
                  Load More
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Summary Stats */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Total Threads:</span>
            <span className="font-medium">
              {(data?.pages[0] as ThreadsResponse)?.pagination.totalThreads || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Loaded:</span>
            <span className="font-medium">{threads.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}