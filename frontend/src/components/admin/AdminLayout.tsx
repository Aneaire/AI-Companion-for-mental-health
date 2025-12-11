import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "@tanstack/react-router";
import { useUser } from "@clerk/clerk-react";
import { 
  MessageSquare, 
  BarChart3, 
  Users, 
  Heart, 
  TrendingUp,
  Menu,
  X,
  Shield
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AdminLayoutProps {
  children: React.ReactNode;
  sidebarContent?: React.ReactNode;
}

export function AdminLayout({ children, sidebarContent }: AdminLayoutProps) {
  const { user } = useUser();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  const baseNavigationItems = [
    {
      to: "/admin",
      icon: BarChart3,
      label: "Admin",
      description: "Dashboard & Analytics"
    },
    {
      to: "/admin/monitor-threads",
      icon: MessageSquare,
      label: "Monitor Threads",
      description: "View all therapeutic threads"
    },
    {
      to: "/quality-analysis",
      icon: BarChart3,
      label: "Quality Analysis",
      description: "Thread analysis & insights"
    },
    {
      to: "/admin/counselor",
      icon: Heart,
      label: "Counselor",
      description: "Counseling requests & sessions"
    },
    {
      to: "/admin-management",
      icon: Users,
      label: "Admin Management",
      description: "User & role management"
    }
  ];

  // Conditionally show navigation items based on role
  const userRole = user?.publicMetadata?.role;
  let navigationItems = [...baseNavigationItems];

  // Filter navigation items based on role permissions
  if (userRole === 'admin') {
    // Admin users cannot access monitor threads
    navigationItems = navigationItems.filter(item => item.to !== '/admin/monitor-threads');
  } else if (userRole === 'observer') {
    // Observer users cannot access admin management
    navigationItems = navigationItems.filter(item => item.to !== '/admin-management');
  }

  // Add role management only for superadmin users
  if (userRole === 'superadmin') {
    navigationItems.push({
      to: "/admin/role-management",
      icon: Shield,
      label: "Role Management",
      description: "Assign user roles & permissions"
    });
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

      {/* Unified Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed md:static inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Admin Panel</h2>
                <p className="text-xs text-gray-500">Management System</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="p-3 border-b border-gray-200">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon size={16} />
                  <div className="flex-1">
                    <div>{item.label}</div>
                    <div className="text-xs opacity-70">{item.description}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Dynamic Content Section */}
        {sidebarContent && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-sm text-gray-800">Page Content</span>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3">
                {sidebarContent}
              </div>
            </ScrollArea>
          </>
        )}

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage 
                src={user?.imageUrl || undefined} 
                alt={user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.primaryEmailAddress?.emailAddress || 'User'
                } 
              />
              <AvatarFallback className="font-medium text-foreground">
                {user?.firstName && user?.lastName
                  ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                  : (user?.primaryEmailAddress?.emailAddress || 'User').substring(0, 1).toUpperCase()
                }
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.emailAddresses?.[0]?.emailAddress
                }
              </p>
              <p className="text-xs text-gray-500">
                {/* Display user's actual role from metadata instead of hardcoded "Administrator" */}
                {(user?.publicMetadata?.role as string) || 'Administrator'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
            <span className="ml-2">Menu</span>
          </Button>
          <h1 className="font-semibold text-gray-900">
            {navigationItems.find(item => item.to === location.pathname)?.label || "Admin"}
          </h1>
          <div className="w-8" /> {/* Spacer for alignment */}
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}