import { Card, CardContent } from "@/components/ui/card";

export function ProgressRationaleCard({ rationale }: { rationale: string }) {
  if (!rationale) return null;
  return (
    <Card className="mt-2 bg-blue-50 border-blue-200">
      <CardContent className="py-2 px-3 text-sm text-blue-900">
        <span className="font-semibold">LLM rationale:</span> {rationale}
      </CardContent>
    </Card>
  );
}
