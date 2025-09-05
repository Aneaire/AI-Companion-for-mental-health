import HeaderUser from "@/integrations/clerk/header-user";
import { useUser } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";

export default function Header() {
  const { user } = useUser();
  console.log("User metadata:", user?.privateMetadata);
  const isAdmin = user?.privateMetadata?.role === "admin";
  console.log("Is admin:", isAdmin);
  return (
    <header className="p-2 flex gap-2 bg-white text-black justify-between">
      <nav className="flex flex-row">
        <div className="px-2 font-bold">
          <Link to="/">Home</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/demo/clerk">Clerk</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/demo/form/simple">Simple Form</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/demo/form/address">Address Form</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/demo/tanstack-query">TanStack Query</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/demo/store">Store</Link>
        </div>
        {isAdmin && (
          <div className="px-2 font-bold">
            <Link to="/admin">Admin</Link>
          </div>
        )}
      </nav>

      <div>
        <HeaderUser />
      </div>
    </header>
  );
}
