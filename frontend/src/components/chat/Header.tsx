// components/Header.tsx
import { Button } from "@/components/ui/button";
import type { MentalHealthConcern } from "@/types/chat";
import { BrainCircuit } from "lucide-react";
import type { JSX } from "react";

interface HeaderProps {
  selectedConcern: MentalHealthConcern | null;
  onResetDialog: () => void;
}

export function Header({
  selectedConcern,
  onResetDialog,
}: HeaderProps): JSX.Element {
  return (
    <header
      className={`py-2 px-4 shadow-md ${
        !selectedConcern
          ? "bg-indigo-600 text-white"
          : selectedConcern.color
              .split(" ")
              .filter((c) => !c.startsWith("hover:"))
              .join(" ")
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-1">
            <BrainCircuit
              className={`${selectedConcern && selectedConcern.iconColor} `}
              size={20}
            />
            AI Smart Therapist
          </h1>
          {selectedConcern && (
            <div className="text-xs opacity-90 flex items-center gap-1">
              <span>Current focus:</span>
              <span
                className={`${selectedConcern.color
                  .split(" ")[0]
                  .replace(
                    "bg",
                    "bg-opacity-20"
                  )} bg-white px-1.5 py-0.5 rounded-full text-xs font-medium`}
              >
                {selectedConcern.label}
              </span>
            </div>
          )}
        </div>

        {selectedConcern && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetDialog}
            className=" text-gray-700 hover:bg-white hover:bg-opacity-20 text-xs py-1"
          >
            Change Topic
          </Button>
        )}
      </div>
    </header>
  );
}
