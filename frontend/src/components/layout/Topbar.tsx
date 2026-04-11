"use client";

import { Bell, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";

export default function Topbar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();

  const getTitle = () => {
    if (pathname === "/assets") return t.topbar.titles.assets;
    if (pathname === "/jobs") return t.topbar.titles.jobs;
    if (pathname === "/users") return t.topbar.titles.users;
    if (pathname === "/settings") return t.topbar.titles.settings;
    if (pathname === "/dashboard") return t.topbar.titles.dashboard;
    return t.topbar.titles.dashboard;
  };

  return (
    <header className="h-20 bg-surface border-b border-border-theme/50 sticky top-0 z-10 w-full shrink-0 transition-colors">
      {/* Container matching the main area max-width and padding */}
      <div className="max-w-[1700px] w-full mx-auto h-full flex items-center justify-between px-8 lg:px-14">
        
        {/* Mobile menu button */}
        <div className="flex items-center lg:hidden">
          <button className="text-subtitle hover:text-title focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Page Title - Perfectly aligned with page content using matching margins */}
        <div className="hidden lg:flex flex-1 items-center">
          <h1 className="text-2xl font-black text-title tracking-tight">{getTitle()}</h1>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-6">
          
          {/* Language Switcher */}
          <div className="flex items-center bg-gray-50/80 p-1 rounded-full border border-border-theme/50">
            <button 
              onClick={() => setLanguage("en")}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${
                language === "en" ? "bg-white text-brand shadow-sm shadow-brand/5" : "text-subtitle/40 hover:text-subtitle"
              }`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage("es")}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${
                language === "es" ? "bg-white text-brand shadow-sm shadow-brand/5" : "text-subtitle/40 hover:text-subtitle"
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
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-bold text-title leading-tight">Alex Thompson</span>
              <span className="text-[11px] text-subtitle/50 mt-1 font-semibold uppercase tracking-wider">{t.topbar.account_manager}</span>
            </div>
            <button className="flex items-center group relative cursor-default">
              <div className="w-11 h-11 rounded-full bg-brand/10 flex items-center justify-center border-2 border-white ring-1 ring-border-theme/50 overflow-hidden shadow-sm transition-transform">
                <img 
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=100&h=100&q=80" 
                  alt="Alex Thompson profile" 
                  className="w-full h-full object-cover"
                />
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
