import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import type { JSX } from "react";

export interface SidebarProps {
  threads: { id: number; title: string }[];
  onSelectThread: (id: number) => void;
  onNewThread: () => void;
  selectedThreadId: number | null;
}

export function Sidebar({
  threads,
  onSelectThread,
  onNewThread,
  selectedThreadId,
}: SidebarProps): JSX.Element {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
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
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                    selectedThreadId === thread.id
                      ? "bg-blue-50 text-blue-700 border-l-4 border-blue-500"
                      : "text-gray-700 hover:bg-gray-100"
                  } truncate`}
                  onClick={() => onSelectThread(thread.id)}
                >
                  {thread.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}

export default Sidebar;
