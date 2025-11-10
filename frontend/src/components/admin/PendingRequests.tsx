import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, User, CheckCircle } from "lucide-react";
import type { CounselorRequest } from "@/types/counselor";
import { formatRelativeTime } from "@/lib/utils";

interface PendingRequestsProps {
  requests: CounselorRequest[];
  onAcceptRequest: (requestId: string) => void;
  isAccepting: string | null;
}

export function PendingRequests({ requests, onAcceptRequest, isAccepting }: PendingRequestsProps) {
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

  const getUserName = (user?: CounselorRequest['user']) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.firstName || user?.nickname || "Anonymous User";
  };

  const pendingRequests = requests.filter(r => r.status === "pending");

  if (pendingRequests.length === 0) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-blue-50/30 rounded-2xl"></div>
        <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Pending Requests</h3>
            <p className="text-sm text-gray-600">All counseling requests have been handled</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {pendingRequests.map((request) => (
        <div key={request.$id} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 via-white to-red-50/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-red-500"></div>
            
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden ${
                      request.user?.profileImageUrl
                        ? ""
                        : "bg-gradient-to-br from-orange-400 to-red-500"
                    }`}>
                      {request.user?.profileImageUrl ? (
                        <img
                          src={request.user.profileImageUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
                      <AlertTriangle className="h-2 w-2 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {getUserName(request.user)}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(request.requestedAt)}
                      </div>
                      <Badge 
                        variant="outline"
                        className={`text-xs px-2 py-1 ${getUrgencyBadgeStyles(request.urgencyLevel)}`}
                      >
                        {request.urgencyLevel.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={() => onAcceptRequest(request.$id)}
                  disabled={isAccepting === request.$id}
                  size="sm"
                  className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {isAccepting === request.$id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept
                    </>
                  )}
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-gray-50/60 rounded-lg">
                  <p className="text-xs font-semibold text-gray-600 mb-1">REQUEST REASON</p>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {request.requestReason}
                  </p>
                </div>
                
                {request.userContext && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      View User Context →
                    </summary>
                    <div className="mt-2 p-3 bg-blue-50/60 rounded-lg border border-blue-200/40">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                        {JSON.stringify(request.userContext, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}