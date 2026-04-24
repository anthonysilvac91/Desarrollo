import React, { useState } from "react";
import { Bell, Menu, LogOut, User, ChevronDown } from "lucide-react";
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
        <div className="flex items-center space-x-4">
          
          {/* Language Switcher */}
          <div className="flex items-center bg-app-bg/80 p-0.5 rounded-full border border-border-theme/50">
            <button 
              onClick={() => setLanguage("en")}
              className={`px-2.5 py-1 text-[9px] font-black rounded-full transition-all ${
                language === "en" ? "bg-surface text-brand shadow-sm" : "text-subtitle/40 hover:text-subtitle"
              }`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage("es")}
              className={`px-2.5 py-1 text-[9px] font-black rounded-full transition-all ${
                language === "es" ? "bg-surface text-brand shadow-sm" : "text-subtitle/40 hover:text-subtitle"
              }`}
            >
              ES
            </button>
          </div>

          <button className="p-2 text-subtitle opacity-40 hover:opacity-100 rounded-xl hover:bg-app-bg transition-all">
            <span className="sr-only">{t.topbar.notifications}</span>
            <Bell className="w-5 h-5" />
          </button>

          {/* User Profile Dropdown */}
          <div className="relative ml-2">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`flex items-center space-x-3 p-1.5 pl-3 rounded-2xl transition-all border border-transparent ${
                isProfileOpen ? "bg-app-bg border-border-theme/40" : "hover:bg-app-bg"
              }`}
            >
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-black text-title leading-tight">{user?.name || "User"}</span>
                <span className="text-[9px] text-subtitle/40 font-bold uppercase tracking-widest">{user?.role || "Admin"}</span>
              </div>
              
              <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center border border-brand/20 overflow-hidden shadow-inner">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-brand text-xs font-black">{user?.name?.charAt(0) || "U"}</span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-subtitle/30 transition-transform duration-300 ${isProfileOpen ? "rotate-180" : ""}`} />
            </button>

            {isProfileOpen && (
              <>
                {/* Overlay for closing */}
                <div className="fixed inset-0 z-30" onClick={() => setIsProfileOpen(false)} />
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-3 w-56 bg-white border border-border-theme/30 rounded-3xl shadow-2xl shadow-title/10 z-40 py-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-gray-50 mb-1">
                    <p className="text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em] mb-1">Cuenta</p>
                    <p className="text-xs font-bold text-title truncate">{user?.email}</p>
                  </div>
                  
                  <button className="w-full flex items-center space-x-3 px-4 py-3 text-subtitle/70 hover:text-brand hover:bg-brand/5 transition-all text-sm font-bold group">
                    <User className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                    <span>Mi Perfil</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-error/60 hover:text-error hover:bg-error/5 transition-all text-sm font-black group mt-1"
                  >
                    <LogOut className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                    <span>{t.auth.login.submit === "Sign In" ? "Logout" : "Cerrar Sesión"}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
