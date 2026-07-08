import React, { useState } from "react";
import { Bell, LogOut, User, ChevronDown, Menu, KeyRound, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { user, logout, canAccess } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const getTitle = () => {
    if (pathname === "/assets") return t.topbar.titles.assets;
    if (pathname === "/service") return t.topbar.titles.services;
    if (pathname === "/users") return t.topbar.titles.users;
    if (pathname === "/settings") return t.topbar.titles.settings;
    if (pathname === "/dashboard") return t.topbar.titles.dashboard;
    if (pathname.startsWith("/organizations")) return t.sidebar.organizations;
    if (pathname.startsWith("/email-templates")) return t.sidebar.email_templates;
    return t.topbar.titles.dashboard;
  };

  const userInitial = user?.name?.charAt(0) || user?.email?.charAt(0) || "U";
  const organizationName = user?.organization?.show_org_name ? user.organization.name : "Fentri";

  return (
    <header className="h-[92px] lg:h-20 bg-surface border-b border-border-theme/50 sticky top-0 z-20 w-full shrink-0 transition-colors">
      <div className="max-w-[1700px] w-full mx-auto h-full flex items-center justify-between px-4 sm:px-8 lg:px-14">
        
        {/* Mobile app header */}
        <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl flex items-center justify-center">
            {user?.organization?.logo_url ? (
              <img
                src={user.organization.logo_url}
                alt={user.organization.name || "Logo"}
                className="h-full w-full object-cover rounded-xl"
              />
            ) : (
              <img
                src="/brand/isotipo.png"
                alt="Fentri"
                className="h-8 w-auto object-contain"
                draggable={false}
              />
            )}
          </div>
          <p className="min-w-0 max-w-[11rem] whitespace-normal break-words text-sm font-black leading-tight text-title">
            {organizationName}
          </p>
        </div>

        {/* Tablet menu button and title */}
        <div className="hidden min-w-0 flex-1 items-center space-x-4 md:flex lg:hidden">
          <button 
            onClick={onMenuClick}
            className="p-2 -ml-2 text-subtitle hover:text-title focus:outline-none bg-app-bg/50 rounded-xl active:scale-90 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-black text-title tracking-tight truncate max-w-[280px]">{getTitle()}</h1>
        </div>

        {/* Page Title */}
        <div className="hidden lg:flex flex-1 items-center">
          <h1 className="text-2xl font-black text-title tracking-tight">{getTitle()}</h1>
        </div>

        {/* Right side actions */}
        <div className="flex shrink-0 items-center space-x-2 sm:space-x-4">
          
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

          <button className="p-2 text-subtitle opacity-50 hover:opacity-100 rounded-xl hover:bg-app-bg transition-all">
            <span className="sr-only">{t.topbar.notifications}</span>
            <Bell className="w-5 h-5" />
          </button>

          {/* User Profile Dropdown */}
          <div className="relative lg:ml-2">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`flex items-center space-x-2 lg:space-x-3 p-1.5 lg:pl-3 rounded-2xl transition-all border border-transparent ${
                isProfileOpen ? "bg-app-bg border-border-theme/40" : "hover:bg-app-bg"
              }`}
            >
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-black text-title leading-tight">{user?.name || "User"}</span>
                <span className="text-[9px] text-subtitle/40 font-bold uppercase tracking-widest">{user?.role || "Admin"}</span>
              </div>
              
              <div className="w-10 h-10 lg:w-9 lg:h-9 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 overflow-hidden shadow-inner">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-brand text-xs font-black">{userInitial}</span>
                )}
              </div>
              <ChevronDown className={`hidden lg:block w-4 h-4 text-subtitle/30 transition-transform duration-300 ${isProfileOpen ? "rotate-180" : ""}`} />
            </button>

            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsProfileOpen(false)} />

                <div className="absolute right-0 mt-2 w-60 bg-surface border border-border-theme/40 rounded-2xl shadow-xl shadow-title/10 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                  {/* User card */}
                  <div className="p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-brand text-sm font-black">{userInitial}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-title truncate leading-tight">{user?.name || "Usuario"}</p>
                      <span className="inline-block mt-0.5 px-1.5 py-px rounded-full bg-brand/10 text-[8px] font-black text-brand uppercase tracking-widest">
                        {user?.role || "Admin"}
                      </span>
                      <p className="text-[9px] font-semibold text-subtitle/40 truncate mt-0.5">{user?.email}</p>
                    </div>
                  </div>

                  <div className="mx-3 h-px bg-border-theme/30" />

                  {/* Actions */}
                  <div className="p-1.5">
                    <button
                      onClick={() => { setIsProfileOpen(false); router.push("/settings?tab=my_profile"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-subtitle/70 hover:text-brand hover:bg-brand/5 transition-all group"
                    >
                      <div className="w-6 h-6 rounded-full bg-app-bg flex items-center justify-center shrink-0 group-hover:bg-brand/10 transition-colors">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold">{t.common.my_profile}</span>
                    </button>

                    <button
                      onClick={() => { setIsProfileOpen(false); router.push("/settings?tab=security"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-subtitle/70 hover:text-brand hover:bg-brand/5 transition-all group"
                    >
                      <div className="w-6 h-6 rounded-full bg-app-bg flex items-center justify-center shrink-0 group-hover:bg-brand/10 transition-colors">
                        <KeyRound className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold">{t.common.change_password}</span>
                    </button>

                    {canAccess("/settings") && (
                      <button
                        onClick={() => { setIsProfileOpen(false); router.push("/settings"); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-subtitle/70 hover:text-brand hover:bg-brand/5 transition-all group md:hidden"
                      >
                        <div className="w-6 h-6 rounded-full bg-app-bg flex items-center justify-center shrink-0 group-hover:bg-brand/10 transition-colors">
                          <Settings className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold">{t.sidebar.settings}</span>
                      </button>
                    )}

                    <button
                      onClick={() => { setIsProfileOpen(false); logout(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-error/60 hover:text-error hover:bg-error/5 transition-all group"
                    >
                      <div className="w-6 h-6 rounded-full bg-app-bg flex items-center justify-center shrink-0 group-hover:bg-error/10 transition-colors">
                        <LogOut className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-black">{t.common.logout}</span>
                    </button>
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
