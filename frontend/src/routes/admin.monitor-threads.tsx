import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ObserverProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Eye, MessageSquare, Users, Calendar, Search, Filter, ArrowLeft, User } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";

interface UserData {
  id: number;
  clerkId: string;
  email: string;
  nickname: string | null;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  status: string;
  role: string;
  hobby: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  threadCount: number;
}

interface UsersResponse {
  users: UserData[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
  search: string;
  sortBy: string;
  sortOrder: string;
}

interface ThreadData {
  id: number;
  displayName: string;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
  reasonForVisit: string | null;
}

interface UserThreadsResponse {
  threads: ThreadData[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalThreads: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
}

export const Route = createFileRoute('/admin/monitor-threads')({
  component: MonitorThreads,
});

function MonitorThreads() {
  return (
    <ObserverProtectedRoute>
      <MonitorThreadsContent />
    </ObserverProtectedRoute>
  );
}

function MonitorThreadsContent() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userThreadsPage, setUserThreadsPage] = useState(1);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search term
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page when search changes
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query for users list
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery<UsersResponse>({
    queryKey: ["adminUsers", currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm,
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      setIsInitialLoad(false);
      return response.json();
    },
    enabled: !selectedUser, // Only run when not viewing user threads
  });

  // Query for selected user's threads
  const { data: userThreadsData, isLoading: threadsLoading, error: threadsError } = useQuery<UserThreadsResponse>({
    queryKey: ["adminUserThreads", selectedUser?.id, userThreadsPage],
    queryFn: async () => {
      if (!selectedUser) return null;

      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const params = new URLSearchParams({
        page: userThreadsPage.toString(),
        limit: pageSize.toString(),
      });

      const response = await fetch(`/api/admin/users/${selectedUser.id}/threads?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user threads");
      }

      return response.json();
    },
    enabled: !!selectedUser,
  });

  const sidebarContent = (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Monitor Threads</h4>
        <ul className="space-y-2 text-xs text-blue-700">
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            View users and their threads
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            Monitor session progress
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Analyze thread analytics
          </li>
        </ul>
      </div>
    </div>
  );

  if (isInitialLoad && usersLoading && !selectedUser) {
    return (
      <AdminLayout sidebarContent={sidebarContent}>
        <div className="p-8">Loading users...</div>
      </AdminLayout>
    );
  }

  if (usersError && !selectedUser) {
    return (
      <AdminLayout sidebarContent={sidebarContent}>
        <div className="p-8 text-red-600">
          Error loading users: {usersError instanceof Error ? usersError.message : "Unknown error"}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            {selectedUser && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedUser(null);
                  setUserThreadsPage(1);
                }}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Users
              </Button>
            )}
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={24} className="text-blue-600" />
              Monitor Threads
            </h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {selectedUser
              ? `Viewing threads for ${selectedUser.firstName || selectedUser.email}`
              : "View users and their therapeutic conversation threads"
            }
          </p>
        </div>

        {/* Search and Filters */}
        {!selectedUser && (
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        )}



        {/* Content */}
        {selectedUser ? (
          /* User Threads View */
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedUser.firstName && selectedUser.lastName
                  ? `${selectedUser.firstName} ${selectedUser.lastName}`
                  : selectedUser.email
                }
              </h2>
              <p className="text-sm text-gray-600">
                {selectedUser.threadCount} total thread{selectedUser.threadCount !== 1 ? 's' : ''}
              </p>
            </div>

            {threadsLoading ? (
              <div className="text-center py-8">Loading threads...</div>
            ) : threadsError ? (
              <div className="text-center py-8 text-red-600">
                Error loading threads: {threadsError instanceof Error ? threadsError.message : "Unknown error"}
              </div>
            ) : (
              <div className="space-y-4">
                {userThreadsData?.threads.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No threads found</h3>
                    <p className="text-gray-600">This user hasn't started any conversations yet</p>
                  </div>
                ) : (
                  userThreadsData?.threads.map((thread: ThreadData) => (
                    <div
                      key={thread.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{thread.displayName}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {thread.sessionCount} session{thread.sessionCount !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(thread.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                           {thread.reasonForVisit && (
                             <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                               {thread.reasonForVisit}
                             </p>
                           )}
                         </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {thread.sessionCount > 0 ? 'Active' : 'Empty'}
                        </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/admin/threads/${thread.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Messages
                    </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Pagination for user threads */}
            {userThreadsData && userThreadsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center mt-6 pt-6 border-t border-gray-200">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUserThreadsPage(prev => Math.max(1, prev - 1))}
                    disabled={!userThreadsData.pagination.hasPrev}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUserThreadsPage(prev => Math.min(userThreadsData.pagination.totalPages, prev + 1))}
                    disabled={!userThreadsData.pagination.hasNext}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          /* Users List View */
          <Card className="p-6">
            <div className="space-y-4">
              {usersData?.users.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                  <p className="text-gray-600">
                    {debouncedSearchTerm ? "Try adjusting your search terms" : "No users available"}
                  </p>
                </div>
              ) : (
                usersData?.users.map((user: UserData) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.email
                          }
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{user.email}</span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {user.threadCount} thread{user.threadCount !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={user.threadCount > 0 ? "default" : "secondary"}>
                        {user.threadCount > 0 ? 'Has Threads' : 'No Threads'}
                      </Badge>
                      <Button variant="outline" size="sm">
                        View Threads
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination for users */}
            {usersData && usersData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center mt-6 pt-6 border-t border-gray-200">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!usersData.pagination.hasPrev}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(usersData.pagination.totalPages, prev + 1))}
                    disabled={!usersData.pagination.hasNext}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}