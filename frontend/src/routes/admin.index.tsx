import { createRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "@tanstack/react-router";
import { MessageSquare, BarChart3, Users, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
  const { user } = useUser();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
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

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = sidebarRef.current;
      if (sidebar && !sidebar.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };
    if (isSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSidebarOpen]);

  if (isLoading) {
    return <div className="p-8">Loading metrics...</div>;
  }

  if (!metrics) {
    return <div className="p-8">No metrics available</div>;
  }



  return (
    <div className="flex h-screen w-full">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Navigation Section */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <MessageSquare size={16} />
              Chat
            </Link>
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/admin"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={16} />
              Admin
            </Link>
            <Link
              to="/quality-analysis"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/quality-analysis"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={16} />
              Quality Analysis
            </Link>
            <Link
              to="/admin-management"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/admin-management"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <Users size={16} />
              Admin Management
            </Link>
          </div>
        </div>

        {/* Admin Tools Section */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-lg text-gray-800">Admin Tools</span>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 text-gray-500 text-sm">
            <p className="mb-2">Dashboard Features:</p>
            <ul className="space-y-2 text-xs">
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
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                Admin management tools
              </li>
            </ul>
          </div>
        </ScrollArea>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-700">
                {user?.firstName?.charAt(0) || user?.emailAddresses?.[0]?.emailAddress?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.emailAddresses?.[0]?.emailAddress
                }
              </p>
              <p className="text-xs text-gray-500">
                Admin User
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(true)}
          >
            <BarChart3 size={20} />
            <span className="ml-2">Admin</span>
          </Button>
          <h1 className="font-semibold">Dashboard</h1>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="hidden md:block mb-6">
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
                    <p className="text-sm text-gray-600">Persona usage over the last 30 days</p>
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
                          <div className="text-xs">No persona selections in the last 10 hours</div>
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
      </div>
    </div>
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
