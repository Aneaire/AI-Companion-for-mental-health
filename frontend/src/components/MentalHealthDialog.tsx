// components/MentalHealthDialog.tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mentalHealthConcerns, type MentalHealthConcern } from "@/types/chat";
import { Info } from "lucide-react";
import type { JSX } from "react";

interface MentalHealthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConcern: (concern: MentalHealthConcern) => void;
}

export function MentalHealthDialog({
  open,
  onOpenChange,
  onSelectConcern,
}: MentalHealthDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            How are you feeling today?
          </DialogTitle>
          <DialogDescription className="text-sm mt-1">
            Select the concern you'd like to discuss with your AI therapist
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2">
          {mentalHealthConcerns.map((concern: MentalHealthConcern) => (
            <Card
              key={concern.id}
              className={`cursor-pointer border-2 transition-all ${concern.color}`}
              onClick={() => onSelectConcern(concern)}
            >
              <CardHeader className="p-3 pb-1">
                <CardTitle className={`text-base ${concern.iconColor}`}>
                  {concern.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <CardDescription className="text-xs">
                  {concern.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <Alert variant="default" className="bg-blue-50 border-blue-200 mt-1">
          <Info className="h-3 w-3 text-blue-600" />
          <AlertTitle className="text-blue-800 text-sm">
            Support, not replacement
          </AlertTitle>
          <AlertDescription className="text-blue-700 text-xs">
            Your selection helps us provide relevant support but should not
            replace professional care.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}

