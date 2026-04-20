"use client";

import { Bell, Menu, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const getTitle = () => {
    if (pathname === "/assets") return t.topbar.titles.assets;
    if (pathname === "/service") return t.topbar.titles.services;
    if (pathname === "/users") return t.topbar.titles.users;
    if (pathname === "/settings") return t.topbar.titles.settings;
    if (pathname === "/dashboard") return t.topbar.titles.dashboard;
    if (pathname.startsWith("/master")) return t.sidebar.master_console;
    return t.topbar.titles.dashboard;
  };

  return (
    <header className="h-20 bg-surface border-b border-border-theme/50 sticky top-0 z-20 w-full shrink-0 transition-colors">
      <div className="max-w-[1700px] w-full mx-auto h-full flex items-center justify-between px-6 sm:px-8 lg:px-14">
        
        {/* Mobile menu button & Title */}
        <div className="flex items-center space-x-4 lg:hidden">
          <button 
            onClick={onMenuClick}
            className="p-2 -ml-2 text-subtitle hover:text-title focus:outline-none bg-app-bg/50 rounded-xl active:scale-90 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-black text-title tracking-tight truncate max-w-[140px] lowercase first-letter:uppercase">{getTitle()}</h1>
        </div>

        {/* Page Title */}
        <div className="hidden lg:flex flex-1 items-center">
          <h1 className="text-2xl font-black text-title tracking-tight">{getTitle()}</h1>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-6">
          
          {/* Language Switcher */}
          <div className="flex items-center bg-app-bg/80 p-1 rounded-full border border-border-theme/50">
            <button 
              onClick={() => setLanguage("en")}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${
                language === "en" ? "bg-surface text-brand shadow-sm shadow-brand/5" : "text-subtitle/40 hover:text-subtitle"
              }`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage("es")}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${
                language === "es" ? "bg-surface text-brand shadow-sm shadow-brand/5" : "text-subtitle/40 hover:text-subtitle"
              }`}
            >
              ES
            </button>
          </div>

          <button className="p-2 text-subtitle opacity-60 hover:opacity-100 rounded-full hover:bg-app-bg transition-colors">
            <span className="sr-only">{t.topbar.notifications}</span>
            <Bell className="w-5 h-5 px-0.5" />
          </button>

          {/* User profile section */}
          <div className="flex items-center space-x-4 pl-4 border-l border-border-theme/40">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-bold text-title leading-tight">{user?.name || "User"}</span>
              <span className="text-[11px] text-subtitle/50 mt-1 font-semibold uppercase tracking-wider">{user?.role || t.topbar.account_manager}</span>
            </div>
            
            <div className="w-11 h-11 rounded-full bg-brand/10 flex items-center justify-center border-2 border-white ring-1 ring-border-theme/50 overflow-hidden shadow-sm transition-transform">
              {user?.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={user.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-brand font-black">
                  {user?.name?.charAt(0) || "U"}
                </div>
              )}
            </div>

            <button 
              onClick={logout}
              className="p-2.5 text-error/40 hover:text-error hover:bg-error/5 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
