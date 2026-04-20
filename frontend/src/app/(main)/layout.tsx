"use client";

import React, { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import { Loader2 } from "lucide-react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();
  const { t } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
          <p className="font-black text-subtitle/40 tracking-[0.2em] text-[10px] uppercase">
            {t.feedback.loading_app}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans min-h-screen bg-app-bg transition-colors flex overflow-x-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px] transition-all duration-300">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        {/* Main Content Area */}
        <main className="flex-1 px-4 pb-8 sm:px-8 lg:px-14 lg:pb-12 pt-6 sm:pt-10 max-w-[1700px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
