import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, FileText, MessageSquare } from "lucide-react";

interface FormRequiredStateProps {
  sessionNumber: number;
  onOpenForm: () => void;
}

export function FormRequiredState({ sessionNumber, onOpenForm }: FormRequiredStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 to-indigo-50/30 p-8">
      <Card className="max-w-md w-full shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <AlertCircle size={32} className="text-white" />
            </div>
          </div>
          <CardTitle className="text-xl">Complete Your Follow-up Form</CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            Before starting Session {sessionNumber}, please complete the follow-up form based on your previous session.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-white" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Why this form matters</h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  Your answers help your therapist understand your progress and prepare 
                  personalized questions for a more effective session.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={onOpenForm}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            size="lg"
          >
            <MessageSquare size={16} className="mr-2" />
            Open Follow-up Form
          </Button>

          <p className="text-center text-sm text-gray-500">
            The form typically takes 2-3 minutes to complete
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
