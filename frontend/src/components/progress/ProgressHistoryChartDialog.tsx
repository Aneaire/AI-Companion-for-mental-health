import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

export function ProgressHistoryChartDialog({
  open,
  onOpenChange,
  progressHistory,
  progressRationales,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progressHistory: number[];
  progressRationales: string[];
}) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setAnimationProgress(0);
      const timer = setTimeout(() => setAnimationProgress(1), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (progressHistory.length <= 1) return null;

  // Dynamic sizing based on data
  const minWidth = 400;
  const pointSpacing = Math.max(40, Math.min(80, 600 / progressHistory.length));
  const chartWidth = Math.max(minWidth, progressHistory.length * pointSpacing);
  const chartHeight = 160;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };

  const maxValue = Math.max(...progressHistory, 10);
  const minValue = Math.min(...progressHistory, 0);
  const valueRange = maxValue - minValue || 1;

  // Smart grid line calculation
  const getOptimalGridLines = () => {
    const targetGridLines = 5;
    const rawStep = valueRange / targetGridLines;

    // Round to nice numbers (1, 2, 5, 10, 20, 50, etc.)
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalizedStep = rawStep / magnitude;

    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;

    const step = niceStep * magnitude;

    // Calculate grid values
    const gridStart = Math.floor(minValue / step) * step;
    const gridEnd = Math.ceil(maxValue / step) * step;

    const gridValues = [];
    for (let value = gridStart; value <= gridEnd; value += step) {
      gridValues.push(Math.round(value * 100) / 100);
    }

    return gridValues;
  };

  const gridValues = getOptimalGridLines();

  const getY = (value: number) => {
    return (
      padding.top +
      ((maxValue - value) / valueRange) *
        (chartHeight - padding.top - padding.bottom)
    );
  };

  const getX = (index: number) => {
    return (
      padding.left +
      (index * (chartWidth - padding.left - padding.right)) /
        (progressHistory.length - 1)
    );
  };

  // Create gradient path for area fill
  const pathPoints = progressHistory
    .map((value, index) => `${getX(index)},${getY(value)}`)
    .join(" ");

  const areaPath = `M ${padding.left},${chartHeight - padding.bottom} L ${pathPoints} L ${chartWidth - padding.right},${chartHeight - padding.bottom} Z`;
  const linePath = `M ${pathPoints.replace(/ /g, " L ")}`;

  // Grid lines with smart values
  const gridLines = gridValues.map((value) => ({
    y: getY(value),
    value: value,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-gradient-to-br from-slate-50 to-white border-0 shadow-2xl">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Progress History Chart
          </DialogTitle>
          <p className="text-sm text-slate-600 mt-2">
            Track your journey with {progressHistory.length} data points
          </p>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-xl bg-white shadow-inner border border-slate-200/50">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-purple-50/30"></div>

          <div className="overflow-x-auto p-6 relative">
            <svg
              width={chartWidth}
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="drop-shadow-sm"
              style={{ background: "transparent" }}
            >
              {/* Grid lines */}
              {gridLines.map((line, i) => (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={line.y}
                    x2={chartWidth - padding.right}
                    y2={line.y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={padding.left - 8}
                    y={line.y + 4}
                    fontSize="11"
                    fill="#64748b"
                    textAnchor="end"
                    className="font-medium"
                  >
                    {line.value}
                  </text>
                </g>
              ))}

              {/* Area fill with gradient */}
              <defs>
                <linearGradient
                  id="areaGradient"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient
                  id="lineGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Area fill */}
              <path
                d={areaPath}
                fill="url(#areaGradient)"
                opacity={animationProgress}
                style={{
                  transition: "opacity 0.8s ease-out",
                }}
              />

              {/* Main line with animation */}
              <path
                d={linePath}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="3"
                filter="url(#glow)"
                strokeDasharray={`${chartWidth * animationProgress} ${chartWidth}`}
                style={{
                  transition: "stroke-dasharray 1.2s ease-out",
                }}
              />

              {/* Data points with tooltips */}
              <TooltipProvider>
                {progressHistory.map((value, index) => {
                  const cx = getX(index);
                  const cy = getY(value);
                  const isHovered = hoveredPoint === index;
                  const delay = index * 0.1;

                  return (
                    <g key={index}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <g>
                            {/* Outer ring for hover effect */}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isHovered ? 12 : 8}
                              fill="rgba(99, 102, 241, 0.1)"
                              stroke="rgba(99, 102, 241, 0.3)"
                              strokeWidth="2"
                              opacity={animationProgress}
                              style={{
                                transition: "all 0.3s ease",
                                transform: `scale(${animationProgress})`,
                                transformOrigin: `${cx}px ${cy}px`,
                                animationDelay: `${delay}s`,
                              }}
                            />
                            {/* Main point */}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isHovered ? 6 : 4}
                              fill="#ffffff"
                              stroke="url(#lineGradient)"
                              strokeWidth="3"
                              style={{
                                cursor: "pointer",
                                filter: isHovered
                                  ? "drop-shadow(0 4px 8px rgba(99, 102, 241, 0.3))"
                                  : "none",
                                transition: "all 0.3s ease",
                                transform: `scale(${animationProgress})`,
                                transformOrigin: `${cx}px ${cy}px`,
                                animationDelay: `${delay}s`,
                              }}
                              onMouseEnter={() => setHoveredPoint(index)}
                              onMouseLeave={() => setHoveredPoint(null)}
                              opacity={animationProgress}
                            />
                            {/* Value label on hover */}
                            {isHovered && (
                              <text
                                x={cx}
                                y={cy - 20}
                                fontSize="12"
                                fill="#6366f1"
                                textAnchor="middle"
                                className="font-bold animate-in fade-in duration-200"
                              >
                                {value}
                              </text>
                            )}
                          </g>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="center"
                          className="max-w-sm bg-white border border-slate-200 shadow-lg"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                              <span className="font-bold text-slate-900">
                                Progress: {value}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 leading-relaxed">
                              {progressRationales[index] ||
                                "No details available"}
                            </div>
                            <div className="text-xs text-slate-400 border-t pt-1">
                              Data point {index + 1} of {progressHistory.length}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </g>
                  );
                })}
              </TooltipProvider>

              {/* X-axis labels */}
              {progressHistory.map((_, index) => (
                <text
                  key={index}
                  x={getX(index)}
                  y={chartHeight - padding.bottom + 20}
                  fontSize="10"
                  fill="#64748b"
                  textAnchor="middle"
                  className="font-medium"
                >
                  {index + 1}
                </text>
              ))}
            </svg>
          </div>

          {/* Summary stats */}
          <div className="border-t border-slate-200/50 bg-gradient-to-r from-slate-50/80 to-white/80 p-4">
            <div className="flex justify-between items-center text-sm">
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-slate-500 text-xs">Current</div>
                  <div className="font-bold text-indigo-600">
                    {progressHistory[progressHistory.length - 1]}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500 text-xs">Peak</div>
                  <div className="font-bold text-green-600">
                    {Math.max(...progressHistory)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500 text-xs">Average</div>
                  <div className="font-bold text-slate-600">
                    {(
                      progressHistory.reduce((a, b) => a + b, 0) /
                      progressHistory.length
                    ).toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-400">
                Hover points for details
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

