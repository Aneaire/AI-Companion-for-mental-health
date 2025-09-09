// components/Header.tsx
import { BrainCircuit } from "lucide-react";
import type { JSX } from "react";

export function Header(): JSX.Element {
  return (
    <header className="py-2 px-4 shadow-md bg-indigo-600 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-1">
            <BrainCircuit className="text-white" size={20} />
            AI Assistant
          </h1>
        </div>
      </div>
    </header>
  );
}

