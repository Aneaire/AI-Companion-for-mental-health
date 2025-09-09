import { Button } from "@/components/ui/button";

export function ProgressHistorySparkline({
  progressHistory,
  onOpenChart,
}: {
  progressHistory: number[];
  onOpenChart: () => void;
}) {
  if (progressHistory.length <= 1) return null;
  return (
    <div className="pt-2 flex items-center gap-2">
      <svg
        width="100%"
        height="32"
        viewBox={`0 0 ${progressHistory.length * 16} 32`}
        style={{ maxWidth: 240 }}
      >
        <polyline
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          points={progressHistory
            .map((v, i) => `${i * 16},${32 - v * 3}`)
            .join(" ")}
        />
        {progressHistory.map((v, i) => (
          <circle key={i} cx={i * 16} cy={32 - v * 3} r="2" fill="#6366f1" />
        ))}
      </svg>
      <Button variant="outline" size="sm" onClick={onOpenChart}>
        View Chart
      </Button>
      <div className="text-xs text-gray-500 mt-1">Progress history</div>
    </div>
  );
}

