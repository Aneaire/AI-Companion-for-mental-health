import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import type { JSX } from "react";

interface MobileTopbarProps {
  onMenuClick: () => void;
}

export function MobileTopbar({ onMenuClick }: MobileTopbarProps): JSX.Element {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 md:hidden shadow-sm z-30 sticky top-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6 text-gray-700" />
      </Button>
      <span className="font-semibold text-lg text-gray-800">AI Chat</span>
      <div className="w-10" /> {/* Spacer for symmetry */}
    </div>
  );
}

export default MobileTopbar;
