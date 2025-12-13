import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Search, Calendar, User, Shield, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface AccessLog {
  id: number;
  userId: number;
  threadId: number | null;
  accessType: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approvedAt: string | null;
  expiresAt: string | null;
  deniedAt: string | null;
  denialReason: string | null;
  createdAt: string;
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface AccessLogsResponse {
  logs: AccessLog[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalLogs: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
}

export const Route = createFileRoute('/admin/access-logs')({
  component: AccessLogs,
});

function AccessLogs() {
  return (
    <AdminProtectedRoute>
      <AccessLogsContent />
    </AdminProtectedRoute>
  );
}

function AccessLogsContent() {
  const { getToken } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [pageSize] = useState(20);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page when search changes
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query for access logs
  const { data: logsData, isLoading, error } = useQuery<AccessLogsResponse>({
    queryKey: ["adminAccessLogs", currentPage, pageSize, debouncedSearchTerm, statusFilter],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/admin/thread-access/logs?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch access logs");
      }

      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'denied':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Denied</Badge>;
      case 'expired':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAccessTypeLabel = (accessType: string) => {
    switch (accessType) {
      case 'user_threads':
        return 'User Threads';
      case 'thread_details':
        return 'Thread Details';
      case 'thread_messages':
        return 'Thread Messages';
      default:
        return accessType;
    }
  };

  const sidebarContent = (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Access Logs</h4>
        <ul className="space-y-2 text-xs text-blue-700">
          <li className="flex items-center gap-2">
            <Shield className="w-2 h-2 bg-blue-500 rounded-full"></Shield>
            Monitor access requests
          </li>
          <li className="flex items-center gap-2">
            <User className="w-2 h-2 bg-purple-500 rounded-full"></User>
            Track admin activity
          </li>
          <li className="flex items-center gap-2">
            <Clock className="w-2 h-2 bg-green-500 rounded-full"></Clock>
            View access timelines
          </li>
        </ul>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <AdminLayout sidebarContent={sidebarContent}>
        <div className="p-8">Loading access logs...</div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout sidebarContent={sidebarContent}>
        <div className="p-8 text-red-600">
          Error loading access logs: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={24} className="text-blue-600" />
            Thread Access Logs
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor and audit thread access requests and approvals
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by user email or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Logs List */}
        <Card className="p-6">
          <div className="space-y-4">
            {logsData?.logs.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No access logs found</h3>
                <p className="text-gray-600">
                  {debouncedSearchTerm || statusFilter ? "Try adjusting your search or filters" : "No access requests have been made yet"}
                </p>
              </div>
            ) : (
              logsData?.logs.map((log: AccessLog) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(log.status)}
                      <Badge variant="outline">
                        {getAccessTypeLabel(log.accessType)}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">
                          {log.user.firstName && log.user.lastName
                            ? `${log.user.firstName} ${log.user.lastName}`
                            : log.user.email
                          }
                        </span>
                        <span className="text-gray-500">({log.user.email})</span>
                      </div>

                      <p className="text-sm text-gray-700">
                        <strong>Reason:</strong> {log.reason}
                      </p>

                      {log.denialReason && (
                        <p className="text-sm text-red-600">
                          <strong>Denial reason:</strong> {log.denialReason}
                        </p>
                      )}

                      {log.expiresAt && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          Expires: {new Date(log.expiresAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {logsData && logsData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center mt-6 pt-6 border-t border-gray-200">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!logsData.pagination.hasPrev}
                >
                  Previous
                </Button>
                <span className="px-3 py-2 text-sm text-gray-600">
                  Page {logsData.pagination.currentPage} of {logsData.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(logsData.pagination.totalPages, prev + 1))}
                  disabled={!logsData.pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}