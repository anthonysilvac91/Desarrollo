"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import {
  Building2,
  ShieldCheck,
  LogOut
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function MasterSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { logout } = useAuth();

  const links = [
    { href: "/master", label: t.sidebar.organizations, icon: Building2 },
  ];

  return (
    <aside className="w-[280px] bg-surface border-r border-border-theme h-screen flex flex-col fixed left-0 top-0 z-20">
      {/* Brand area */}
      <div className="h-24 flex items-center px-8 mb-6">
        <div className="w-12 h-12 bg-title rounded-2xl flex items-center justify-center mr-4 shadow-xl shadow-title/20">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-lg text-title tracking-tight leading-none mb-1">RECALL</span>
          <span className="text-[10px] font-black text-brand uppercase tracking-widest">{t.sidebar.master_console}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scroll">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${
                isActive
                  ? "bg-brand/5 text-brand shadow-sm border border-brand/10"
                  : "text-subtitle hover:bg-app-bg hover:text-title border border-transparent"
              }`}
            >
              <Icon
                className={`flex-shrink-0 w-5 h-5 mr-4 transition-colors ${
                  isActive ? "text-brand" : "text-subtitle opacity-40"
                }`}
              />
              {link.label}
            </Link>
          );
        })}
      </nav>
      
      {/* Footer / Logout */}
      <div className="p-6 border-t border-border-theme/50">
        <button
          onClick={logout}
          className="flex items-center w-full px-5 py-4 rounded-2xl text-sm font-bold text-error hover:bg-error/5 transition-all group"
        >
          <LogOut className="w-5 h-5 mr-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
