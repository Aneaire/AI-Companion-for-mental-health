import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@clerk/clerk-react";
import { ArrowLeft, MessageSquare, Calendar, User, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Message } from "@/types/chat";

interface ThreadMessagesResponse {
  thread: {
    id: number;
    userId: number;
    preferredName?: string;
    reasonForVisit?: string;
    createdAt: string;
  };
  sessions: Array<{
    id: number;
    sessionNumber: number;
    sessionName?: string;
    status: string;
    createdAt: string;
  }>;
  messages: Array<{
    id: string;
    sender: "user" | "ai";
    text: string;
    timestamp: string;
    sessionId: number;
    threadType: string;
  }>;
}

export const Route = createFileRoute('/admin/threads/$threadId')({
  component: AdminThreadViewer,
  parseParams: (params) => ({
    threadId: params.threadId,
  }),
});

function AdminThreadViewer() {
  const { threadId } = Route.useParams();
  const { getToken } = useAuth();

  const { data: threadData, isLoading, error } = useQuery<ThreadMessagesResponse>({
    queryKey: ["adminThreadMessages", threadId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`/api/admin/threads/${threadId}/messages`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch thread messages");
      }

      return response.json();
    },
  });

  const sidebarContent = (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Thread Viewer</h4>
        <ul className="space-y-2 text-xs text-blue-700">
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            View complete conversation
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            Monitor message flow
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Review therapeutic interactions
          </li>
        </ul>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <AdminLayout sidebarContent={sidebarContent}>
        <div className="p-8">Loading thread messages...</div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout sidebarContent={sidebarContent}>
        <div className="p-8 text-red-600">
          Error loading thread: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </AdminLayout>
    );
  }

  if (!threadData) {
    return (
      <AdminLayout sidebarContent={sidebarContent}>
        <div className="p-8">No thread data available</div>
      </AdminLayout>
    );
  }

  // Convert messages to the format expected by ChatInterface
  const messages: Message[] = threadData.messages.map(msg => ({
    id: msg.id,
    text: msg.text,
    sender: msg.sender,
    timestamp: new Date(msg.timestamp),
    sessionId: msg.sessionId,
  }));

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/admin/monitor-threads">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Monitor Threads
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={24} className="text-blue-600" />
              Thread #{threadId}
            </h1>
          </div>

          {/* Thread Info */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">User ID</p>
                  <p className="text-lg font-bold text-gray-900">{threadData.thread.userId}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Sessions</p>
                  <p className="text-lg font-bold text-gray-900">{threadData.sessions.length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Messages</p>
                  <p className="text-lg font-bold text-gray-900">{messages.length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Created</p>
                  <p className="text-sm font-bold text-gray-900">
                    {new Date(threadData.thread.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Thread Details */}
          <div className="mt-4 space-y-2">
            {threadData.thread.preferredName && (
              <div>
                <span className="text-sm font-medium text-gray-600">Preferred Name: </span>
                <span className="text-sm text-gray-900">{threadData.thread.preferredName}</span>
              </div>
            )}
            {threadData.thread.reasonForVisit && (
              <div>
                <span className="text-sm font-medium text-gray-600">Reason for Visit: </span>
                <span className="text-sm text-gray-900">{threadData.thread.reasonForVisit}</span>
              </div>
            )}
          </div>

          {/* Sessions Overview */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Sessions:</h3>
            <div className="flex flex-wrap gap-2">
              {threadData.sessions.map((session) => (
                <Badge key={session.id} variant="outline">
                  Session {session.sessionNumber}: {session.status}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Interface - Read Only */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            onSendMessage={() => {}} // No-op for read-only
            loadingState="idle"
            inputVisible={false} // Hide input for admin viewing
            showPersonaInMessages={false}
          />
        </div>
      </div>
    </AdminLayout>
  );
}