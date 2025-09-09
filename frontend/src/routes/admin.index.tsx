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
import { MessageSquare, BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
      console.log("Fetching admin metrics...");
      
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
      console.log("Got metrics data:", data);
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

  const sessionData = [
    {
      name: "Session Status",
      Completed: metrics.sessionMetrics.completed,
      Active:
        metrics.sessionMetrics.total - metrics.sessionMetrics.completed,
    },
  ];

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
          </div>
        </div>

        {/* Admin Tools Section */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-lg text-gray-800">Admin Tools</span>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 text-gray-500 text-sm">
            <p className="mb-2">Available admin functions:</p>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                System metrics overview
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Thread analysis tools
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Quality assessment
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

          <div className="grid gap-6 md:grid-cols-1">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Session Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sessionData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Completed" fill="#22c55e" />
                  <Bar dataKey="Active" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
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
