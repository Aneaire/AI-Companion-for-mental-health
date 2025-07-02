import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import HeaderUser from "@/integrations/clerk/header-user";
import { useUser } from "@clerk/clerk-react";
import { Link, useLocation } from "@tanstack/react-router";
import { MessageSquare, Plus } from "lucide-react";
import { useEffect, useRef, type JSX } from "react";

export interface SidebarProps {
  threads: { id: number; title: string }[];
  onSelectThread: (id: number) => void;
  onNewThread: () => void;
  selectedThreadId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  threads,
  onSelectThread,
  onNewThread,
  selectedThreadId,
  isOpen,
  onClose,
}: SidebarProps): JSX.Element {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  const { user } = useUser();
  const location = useLocation();

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
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors duration-200
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
                    <span className="line-clamp-1 w-full">{thread.title}</span>
                  </button>
                </li>
              ))}
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
