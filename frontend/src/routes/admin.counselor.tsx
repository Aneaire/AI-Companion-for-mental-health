import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { CounselorSidebar } from "@/components/admin/CounselorSidebar";
import { CounselorChatArea } from "@/components/chat/CounselorChatArea";
import { PendingRequests } from "@/components/admin/PendingRequests";
import { useCounselorChat } from "@/hooks/useCounselorChat";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/admin/counselor")({
  component: CounselorDashboard,
});

function CounselorDashboard() {
  return (
    <AdminProtectedRoute allowedRoles={['superadmin', 'observer']}>
      <CounselorDashboardContent />
    </AdminProtectedRoute>
  );
}

function CounselorDashboardContent() {
  const {
    requests,
    chats,
    selectedChat,
    chatMessages,
    newMessage,
    isLoading,
    isAccepting,
    isSending,
    activeView,
    setNewMessage,
    setActiveView,
    selectChat,
    acceptRequest,
    sendMessage,
    endChat,
    selectView,
  } = useCounselorChat();

  const sidebarContent = (
    <CounselorSidebar
      requests={requests}
      chats={chats}
      activeView={activeView}
      selectedChat={selectedChat}
      onActiveViewChange={setActiveView}
      onChatSelect={selectChat}
      onRequestAccept={acceptRequest}
      isAccepting={isAccepting}
    />
  );

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold">Counselor Dashboard</h1>
              <p className="text-muted-foreground">Manage counseling requests and active sessions</p>
            </div>

            {/* Pending Requests View */}
            {activeView === "pending" && (
              <PendingRequests
                requests={requests}
                onAcceptRequest={acceptRequest}
                isAccepting={isAccepting}
              />
            )}

            {/* Current Sessions View */}
            {activeView === "current" && (
              <div className="w-full">
                {selectedChat ? (
                  <CounselorChatArea
                    selectedChat={selectedChat}
                    messages={chatMessages}
                    newMessage={newMessage}
                    onNewMessageChange={setNewMessage}
                    onSendMessage={sendMessage}
                    onEndChat={endChat}
                    isSending={isSending}
                  />
                ) : (
                  <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] bg-gradient-to-br from-gray-50/50 via-white to-indigo-50/30 rounded-2xl shadow-lg border border-gray-200/60">
                    <div className="flex-1 flex items-center justify-center p-8">
                      <div className="text-center max-w-lg">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-6 mx-auto">
                          <MessageCircle size={48} className="text-gray-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-4">
                          Select a Counseling Session
                        </h3>
                        <p className="text-gray-600 mb-6">
                          Choose an active session from sidebar to begin your counseling conversation.
                        </p>
                        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span>{chats.filter(c => c.status === "active").length} Active Sessions</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Default View - No Selection */}
            {!activeView && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Counselor Dashboard</h3>
                  <p className="text-muted-foreground">Select an option from sidebar to get started</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}