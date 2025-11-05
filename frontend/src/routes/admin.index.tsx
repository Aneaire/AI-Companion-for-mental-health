import { createRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@clerk/clerk-react";
import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface MetricsData {
  threadMetrics: {
    total: number;
    withSessions: number;
    percentageWithSessions: number;
  };
  sessionMetrics: {
    total: number;
    completed: number;
    completionRate: number;
  };
  messageMetrics: {
    total: number;
    averagePerSession: number;
  };
  formMetrics: {
    total: number;
    completionRate: number;
  };
}

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

const personaIdMapping: Record<number, string> = {
  1: 'listener',
  2: 'guide',
  3: 'crisis',
  4: 'companion',
  5: 'anchor',
  6: 'confrontational',
  7: 'direct_engager',
};

const personaNames: Record<number, string> = {
  1: 'Empathetic Listener',
  2: 'Supportive Guide',
  3: 'Crisis Support',
  4: 'Friendly Companion',
  5: 'Calm Anchor',
  6: 'Direct Confrontational',
  7: 'Direct Engager',
};

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#6366f1'];

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <AdminProtectedRoute>
      <AdminDashboardContent />
    </AdminProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { getToken } = useAuth();
  
  const { data: metrics, isLoading } = useQuery<MetricsData>({
    queryKey: ["adminMetrics"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch("/api/admin/metrics", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch metrics:", response.status, response.statusText);
        throw new Error("Failed to fetch metrics");
      }

      const data = await response.json();
      return data;
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<PersonaAnalytics>({
    queryKey: ["personaAnalytics"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch("/api/persona-cards/analytics", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch analytics:", response.status, response.statusText);
        throw new Error("Failed to fetch analytics");
      }

      const data = await response.json();
      return data;
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-8">Loading metrics...</div>
      </AdminLayout>
    );
  }

  if (!metrics) {
    return (
      <AdminLayout>
        <div className="p-8">No metrics available</div>
      </AdminLayout>
    );
  }

  const sidebarContent = (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Dashboard Features</h4>
        <ul className="space-y-2 text-xs text-blue-700">
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            System metrics overview
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            Persona analytics & insights
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Usage pattern tracking
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            title="Total Threads"
            value={metrics.threadMetrics.total}
            description={`${metrics.threadMetrics.percentageWithSessions.toFixed(
              1
            )}% with sessions`}
          />
          
          <MetricCard
            title="Total Sessions"
            value={metrics.sessionMetrics.total}
            description={`${metrics.sessionMetrics.completionRate.toFixed(
              1
            )}% completed`}
          />
          
          <MetricCard
            title="Messages per Session"
            value={metrics.messageMetrics.averagePerSession.toFixed(1)}
            description="average"
          />
          
          <MetricCard
            title="Form Completion"
            value={`${metrics.formMetrics.completionRate.toFixed(1)}%`}
            description={`${metrics.formMetrics.total} forms submitted`}
          />
        </div>

        {/* Enhanced Analytics Section */}
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
                          value: item.totalSelections,
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
                      <Tooltip 
                        formatter={(value: number) => [`${value} selections`, 'Count']}
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      />
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
      </div>
    </AdminLayout>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </Card>
  );
}