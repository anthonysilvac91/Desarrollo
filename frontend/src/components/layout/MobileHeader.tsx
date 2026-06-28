"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export default function MobileHeader({ title, showBack = false, rightAction }: MobileHeaderProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 w-full bg-app-bg/80 backdrop-blur-md border-b border-border-theme/40 px-5 h-16 flex items-center justify-between">
      {/* Left Action (Back or Menu Placeholder) */}
      <div className="flex-shrink-0 w-10">
        {showBack ? (
          <button 
            onClick={() => router.back()} 
            className="p-2 -ml-2 rounded-full hover:bg-surface transition-colors active:scale-95"
          >
            <ChevronLeft className="w-6 h-6 text-title" />
          </button>
        ) : (
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-lg shadow-brand/20">
            <span className="text-white font-black text-xs">RC</span>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 text-center px-4 overflow-hidden">
        <h1 className="text-base font-bold text-title truncate tracking-tight">
          {title || "Fentri"}
        </h1>
      </div>

      {/* Right Action */}
      <div className="flex-shrink-0 w-10 flex justify-end">
        {rightAction || (
          <button
            type="button"
            onClick={logout}
            aria-label={t.common.logout}
            title={t.common.logout}
            className="p-2 -mr-2 rounded-full hover:bg-surface transition-colors active:scale-95"
          >
            <LogOut className="w-5 h-5 text-title" />
          </button>
        )}
      </div>
    </header>
  );
}
