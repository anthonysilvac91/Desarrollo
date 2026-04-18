"use client";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
          <p className="font-black text-subtitle/40 tracking-[0.2em] text-[10px] uppercase">
            Iniciando Recall
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans min-h-screen bg-app-bg transition-colors flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-[260px]">
        <Topbar />
        
        {/* Main Content Area - Scroll is now allowed on the page level if content is long */}
        <main className="flex-1 px-8 pb-8 lg:px-14 lg:pb-12 pt-10 max-w-[1700px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
