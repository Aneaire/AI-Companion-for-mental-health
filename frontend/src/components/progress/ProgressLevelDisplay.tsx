import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export function ProgressLevelDisplay({ progress }: { progress: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <Label>
        Patient Progress Level:{" "}
        <span className="font-bold text-blue-700 text-lg">{progress}</span>
      </Label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            What does this mean?
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Progress Level Legend</DialogTitle>
          </DialogHeader>
          <ul className="text-sm space-y-2 mt-2">
            <li>
              <span className="font-bold">0</span>: Extremely struggling,
              hopeless, or in crisis
            </li>
            <li>
              <span className="font-bold">2</span>: Very low, feeling stuck,
              little hope
            </li>
            <li>
              <span className="font-bold">4</span>: Some insight, but still
              mostly struggling
            </li>
            <li>
              <span className="font-bold">6</span>: Making progress, some hope,
              occasional positive moments
            </li>
            <li>
              <span className="font-bold">8</span>: Mostly positive, confident,
              resilient, but not perfect
            </li>
            <li>
              <span className="font-bold">10</span>: Thriving, empowered,
              optimistic, and self-sufficient
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
