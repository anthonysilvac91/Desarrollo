"use client";

import React from "react";
import MasterSidebar from "@/components/layout/MasterSidebar";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-app-bg">
        <Loader2 className="w-10 h-10 text-brand animate-spin" />
      </div>
    );
  }

  // Doble seguridad en layout además del Middleware
  if (!user || user.role !== "SUPER_ADMIN") {
    return null; // El Middleware o AuthContext redirigirán
  }

  return (
    <div className="flex min-h-screen bg-app-bg">
      <MasterSidebar />
      <div className="flex-1 ml-[280px] flex flex-col">
        <Topbar />
        <main className="flex-1 p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
