import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import HeaderUser from "@/integrations/clerk/header-user";
import type { Session } from "@/stores/chatStore";
import { useUser } from "@clerk/clerk-react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, MessageSquare, Plus } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

export interface Thread {
  id: number;
  title: string;
  sessions?: Session[];
}

export interface SidebarProps {
  threads: Thread[];
  onSelectThread: (id: number) => void;
  onSelectSession: (sessionId: number) => void;
  onNewThread: () => void;
  onNewSession: (threadId: number) => void;
  onExpireSession?: (threadId: number) => void;
  selectedThreadId: number | null;
  selectedSessionId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  threads,
  onSelectThread,
  onSelectSession,
  onNewThread,
  onNewSession,
  onExpireSession,
  selectedThreadId,
  selectedSessionId,
  isOpen,
  onClose,
}: SidebarProps): JSX.Element {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  const { user } = useUser();
  const location = useLocation();
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(
    new Set()
  );

  const toggleThreadExpansion = (threadId: number) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
    }
    setExpandedThreads(newExpanded);
  };

  // Auto-expand selected thread
  useEffect(() => {
    if (selectedThreadId) {
      setExpandedThreads(new Set([selectedThreadId]));
    }
  }, [selectedThreadId]);

  // Swipe-to-close for mobile
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchCurrentX.current = e.touches[0].clientX;
    };
    const handleTouchMove = (e: TouchEvent) => {
      touchCurrentX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = () => {
      if (
        touchStartX.current !== null &&
        touchCurrentX.current !== null &&
        touchStartX.current - touchCurrentX.current > 60 // swipe left threshold
      ) {
        onClose();
      }
      touchStartX.current = null;
      touchCurrentX.current = null;
    };
    if (isOpen && window.innerWidth < 768) {
      sidebar.addEventListener("touchstart", handleTouchStart);
      sidebar.addEventListener("touchmove", handleTouchMove);
      sidebar.addEventListener("touchend", handleTouchEnd);
    }
    return () => {
      sidebar.removeEventListener("touchstart", handleTouchStart);
      sidebar.removeEventListener("touchmove", handleTouchMove);
      sidebar.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isOpen, onClose]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = sidebarRef.current;
      if (sidebar && !sidebar.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        id="sidebar"
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm transform transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Navigation Section */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => onClose()} // Close sidebar on mobile after navigation
            >
              <MessageSquare size={16} />
              Chat
            </Link>{" "}
            <Link
              to="/impersonate"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/impersonate"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => onClose()}
            >
              {" "}
              <MessageSquare size={16} /> Impersonate
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-lg text-gray-800">Threads</span>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full hover:bg-blue-100"
            onClick={onNewThread}
            title="Start New Thread"
          >
            <Plus className="text-blue-600" size={20} />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {threads.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">No threads yet.</div>
          ) : (
            <ul>
              {threads.map((thread) => {
                const isExpanded = expandedThreads.has(thread.id);
                const sessions = thread.sessions || [];
                const hasSessions = sessions.length > 0;

                return (
                  <li key={thread.id}>
                    <div className="flex items-center">
                      {hasSessions && (
                        <button
                          onClick={() => toggleThreadExpansion(thread.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-gray-500" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-500" />
                          )}
                        </button>
                      )}
                      <button
                        className={`flex-1 text-left px-4 py-2.5 text-sm font-medium transition-colors duration-200
                          ${
                            selectedThreadId === thread.id
                              ? "bg-blue-50 text-blue-700 border-l-4 border-blue-500 font-semibold shadow-sm"
                              : "text-gray-700 hover:bg-gray-100"
                          }
                        `}
                        style={{
                          boxShadow:
                            selectedThreadId === thread.id
                              ? "0 2px 8px 0 rgba(59,130,246,0.08)"
                              : undefined,
                        }}
                        onClick={() => {
                          onSelectThread(thread.id);
                          onClose(); // Close sidebar on mobile after selection
                        }}
                        title={thread.title} // Show full title on hover
                      >
                        <span className="line-clamp-1 w-full">
                          {thread.title}
                        </span>
                      </button>
                      {hasSessions && sessions.length < 5 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-full hover:bg-red-100 mr-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            // For testing: expire current session instead of creating new one
                            if (onExpireSession) {
                              onExpireSession(thread.id);
                            }
                          }}
                          title="Expire Current Session (Testing)"
                        >
                          <Plus className="text-red-600" size={12} />
                        </Button>
                      )}
                    </div>

                    {/* Sessions */}
                    {isExpanded && hasSessions && (
                      <ul className="ml-6 border-l border-gray-200">
                        {sessions.map((session) => (
                          <li key={session.id}>
                            <button
                              className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200
                                ${
                                  selectedSessionId === session.id
                                    ? "bg-green-50 text-green-700 border-l-4 border-green-400 font-medium shadow-sm"
                                    : session.status === "finished"
                                      ? "text-gray-400 cursor-not-allowed opacity-60"
                                      : "text-gray-600 hover:bg-gray-50"
                                }
                              `}
                              onClick={() => {
                                if (session.status !== "finished") {
                                  onSelectSession(session.id);
                                  onClose(); // Close sidebar on mobile after selection
                                }
                              }}
                              disabled={session.status === "finished"}
                              title={
                                session.sessionName ||
                                `Session ${session.sessionNumber}`
                              }
                            >
                              <div className="flex items-center justify-between">
                                <span className="line-clamp-1 w-full">
                                  {session.sessionName ||
                                    `Session ${session.sessionNumber}`}
                                </span>
                                {session.status === "finished" && (
                                  <span className="text-xs text-gray-400 ml-2">
                                    Finished
                                  </span>
                                )}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        {/* Clerk HeaderUser at the bottom, only on mobile */}
        <div className=" border-t border-gray-200 p-4 mt-auto flex items-center justify-between gap-2">
          {user?.fullName && (
            <span className="text-gray-700 text-sm truncate font-semibold font-stretch-125%">
              {user.fullName}
            </span>
          )}
          <HeaderUser />
        </div>
      </aside>
    </>
  );
}
