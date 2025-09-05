import { createRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { useAuth } from "@clerk/clerk-react";
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
  
  const { data: metrics, isLoading } = useQuery<MetricsData>({
    queryKey: ["adminMetrics"],
    queryFn: async () => {
      console.log("Fetching admin metrics...");
      
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch("http://localhost:4000/api/admin/metrics", {
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

  if (isLoading) {
    return <div className="p-8">Loading metrics...</div>;
  }

  if (!metrics) {
    return <div className="p-8">No metrics available</div>;
  }

  const threadData = [
    {
      name: "Thread Distribution",
      "With Sessions": metrics.threadMetrics.withSessions,
      "Without Sessions":
        metrics.threadMetrics.total - metrics.threadMetrics.withSessions,
    },
  ];

  const sessionData = [
    {
      name: "Session Status",
      Completed: metrics.sessionMetrics.completed,
      Active:
        metrics.sessionMetrics.total - metrics.sessionMetrics.completed,
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Thread Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={threadData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="With Sessions" fill="#4f46e5" />
              <Bar dataKey="Without Sessions" fill="#e5e7eb" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

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