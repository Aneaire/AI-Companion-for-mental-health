import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { qualityApi } from "@/lib/client";
import type { Message } from "@/types/chat";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MessageQualityAnalyzerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  initialForm?: any;
}

interface QualityScore {
  timestamp: number;
  score: number;
  category: string;
  message: string;
}

interface AnalysisResult {
  overallProgress: number;
  emotionalStability: number;
  communicationClarity: number;
  problemSolving: number;
  selfAwareness: number;
  qualityScores: QualityScore[];
  insights: string[];
  recommendations: string[];
}

export function MessageQualityAnalyzer({
  isOpen,
  onClose,
  messages,
  initialForm,
}: MessageQualityAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const analyzeMessages = async () => {
    if (messages.length === 0) {
      setError("No messages to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await qualityApi.analyzeQuality({
        messages: messages.map((msg) => ({
          text: msg.text,
          sender:
            msg.sender === "therapist" || msg.sender === "impostor"
              ? "ai"
              : msg.sender,
          timestamp: msg.timestamp.getTime(),
        })),
        initialForm,
      });

      setAnalysisResult(result);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isOpen && !analysisResult) {
      analyzeMessages();
    }
  }, [isOpen]);

  // Clear analysis result when messages change
  useEffect(() => {
    setAnalysisResult(null);
    setError(null);
  }, [messages]);

  const chartData =
    analysisResult?.qualityScores.map((score, index) => ({
      message: `Msg ${index + 1}`,
      score: score.score,
      category: score.category,
    })) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message Quality Analysis</DialogTitle>
          <DialogDescription>
            AI-powered analysis of your conversation quality and progress over
            time.
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing your conversation...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error: {error}</p>
            <Button
              onClick={analyzeMessages}
              className="mt-2"
              variant="outline"
            >
              Retry Analysis
            </Button>
          </div>
        )}

        {analysisResult && !isAnalyzing && (
          <div className="space-y-6">
            {/* Overall Progress */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analysisResult.overallProgress}%
                </div>
                <div className="text-sm text-blue-800">Overall Progress</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {analysisResult.emotionalStability}%
                </div>
                <div className="text-sm text-green-800">
                  Emotional Stability
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {analysisResult.communicationClarity}%
                </div>
                <div className="text-sm text-purple-800">Communication</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analysisResult.problemSolving}%
                </div>
                <div className="text-sm text-orange-800">Problem Solving</div>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-teal-600">
                  {analysisResult.selfAwareness}%
                </div>
                <div className="text-sm text-teal-800">Self Awareness</div>
              </div>
            </div>

            {/* Quality Trend Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">
                Quality Trend Over Time
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="message" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, "Quality Score"]}
                      labelFormatter={(label) => `Message: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">
                  Key Insights
                </h3>
                <ul className="space-y-2">
                  {analysisResult.insights.map((insight, index) => (
                    <li
                      key={index}
                      className="text-sm text-yellow-700 flex items-start"
                    >
                      <span className="text-yellow-600 mr-2">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-indigo-800 mb-3">
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {analysisResult.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      className="text-sm text-indigo-700 flex items-start"
                    >
                      <span className="text-indigo-600 mr-2">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default MessageQualityAnalyzer;
