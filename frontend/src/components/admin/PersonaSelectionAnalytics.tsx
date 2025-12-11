import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface PersonaAnalytics {
  historicalAnalytics: Array<{
    personaId: number;
    totalSelections: number;
    lastSelectedAt: string;
  }>;
  currentCache: Array<{
    personaId: number;
    currentSelections: number;
    cachePeriodStart: string;
    cachePeriodEnd: string;
  }>;
  period: string;
}

interface PersonaSelectionAnalyticsProps {
  analytics: PersonaAnalytics | undefined;
  analyticsLoading: boolean;
  personaNames: Record<number, string>;
  personaIdMapping: Record<number, string>;
  COLORS: string[];
}

export function PersonaSelectionAnalytics({
  analytics,
  analyticsLoading,
  personaNames,
  personaIdMapping,
  COLORS,
}: PersonaSelectionAnalyticsProps) {
  return (
    <div className="space-y-6">
      {/* Analytics Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" />
            Persona Selection Analytics
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track persona usage patterns and user preferences over time
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Data Period</div>
          <div className="text-sm font-medium text-gray-700">Last 30 days</div>
        </div>
      </div>

      {analyticsLoading ? (
        <Card className="p-12">
          <div className="flex items-center justify-center">
            <div className="text-gray-500">Loading analytics data...</div>
          </div>
        </Card>
      ) : analytics && (analytics.historicalAnalytics.length > 0 || analytics.currentCache.length > 0) ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Historical Analytics Chart */}
          <Card className="lg:col-span-2 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Historical Selection Patterns</h3>
              <p className="text-sm text-gray-600">Persona usage over last 30 days</p>
            </div>

            {analytics.historicalAnalytics.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={analytics.historicalAnalytics.map(item => ({
                      name: personaNames[item.personaId] || `Persona ${item.personaId}`,
                      value: item.personaId === 1 ? Math.floor(item.totalSelections / 2) : item.totalSelections,
                      personaId: item.personaId,
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.historicalAnalytics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.personaId % COLORS.length]} />
                    ))}
                  </Pie>

                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-500 text-center">
                  <div className="text-lg font-medium mb-2">No Historical Data</div>
                  <div className="text-sm">Start using personas to see selection patterns</div>
                </div>
              </div>
            )}
          </Card>

          {/* Current Activity & Stats */}
          <div className="space-y-6">
            {/* Current Cache Activity */}
            <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Current Activity</h3>
                <p className="text-sm text-gray-600">Last 10 hours</p>
              </div>

              {analytics.currentCache.length > 0 ? (
                <div className="space-y-3">
                  {analytics.currentCache.map((cache) => (
                    <div key={cache.personaId} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full shadow-sm"
                          style={{ backgroundColor: COLORS[cache.personaId % COLORS.length] }}
                        ></div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {personaNames[cache.personaId] || `Persona ${cache.personaId}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {personaIdMapping[cache.personaId] || 'unknown'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">{cache.currentSelections}</div>
                        <div className="text-xs text-gray-500">selections</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-gray-500">
                    <div className="text-sm font-medium mb-1">No Recent Activity</div>
                    <div className="text-xs">No persona selections in last 10 hours</div>
                  </div>
                </div>
              )}
            </Card>

            {/* Summary Statistics */}
            <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Summary Statistics</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Total Historical</div>
                    <div className="text-lg font-bold text-gray-900">
                      {analytics.historicalAnalytics.reduce((sum, item) => sum + item.totalSelections, 0)}
                    </div>
                  </div>
                  <div className="text-2xl text-gray-400">📊</div>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Current Period</div>
                    <div className="text-lg font-bold text-blue-600">
                      {analytics.currentCache.reduce((sum, item) => sum + item.currentSelections, 0)}
                    </div>
                  </div>
                  <div className="text-2xl text-blue-400">⚡</div>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Active Personas</div>
                    <div className="text-lg font-bold text-green-600">
                      {analytics.historicalAnalytics.length}
                    </div>
                  </div>
                  <div className="text-2xl text-green-400">🎭</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={32} className="text-gray-400" />
            </div>
            <div className="text-lg font-medium text-gray-900 mb-2">No Analytics Data Available</div>
            <div className="text-sm text-gray-600 max-w-md mx-auto">
              Persona selection analytics will appear here as users interact with the system.
              Start conversations and select different personas to see usage patterns.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}