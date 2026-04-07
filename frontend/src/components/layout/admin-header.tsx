"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { removeAuthToken } from "@/lib/auth";
import { Button } from "../ui/button";

export function AdminHeader() {
  const router = useRouter();

  const handleLogout = () => {
    removeAuthToken();
    router.push("/login");
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex-1">
        {/* Aquí podría ir un breadcrumb o título de página dinámico */}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600 hidden md:block">
          Admin User
        </span>
        <Button variant="ghost" className="p-2 w-auto h-auto text-gray-500 hover:text-gray-900" onClick={handleLogout} title="Cerrar sesión">
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
