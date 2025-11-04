import HeaderUser from "@/integrations/clerk/header-user";
import { useUser } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";

export default function Header() {
  const { user } = useUser();
  console.log("User metadata:", user?.publicMetadata);
  const isAdmin = user?.publicMetadata?.role === "admin";
  console.log("Is admin:", isAdmin);
  return (
    <header className="p-2 flex gap-2 bg-white text-black justify-between">
      <nav className="flex flex-row">
        <div className="px-2 font-bold">
          <Link to="/">Home</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/persona-library">Persona Library</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/podcast">Podcast</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/counselor">Counselor</Link>
        </div>

        {isAdmin && (
          <>
            <div className="px-2 font-bold">
              <Link to="/admin">Admin</Link>
            </div>
            <div className="px-2 font-bold">
              <Link to="/quality-analysis">Quality Analysis</Link>
            </div>
            <div className="px-2 font-bold">
              <Link to="/admin-management">Admin Management</Link>
            </div>
          </>
        )}
      </nav>

      <div>
        <HeaderUser />
      </div>
    </header>
  );
}

