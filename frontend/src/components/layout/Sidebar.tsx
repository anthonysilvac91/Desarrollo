"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { 
  Box, 
  LayoutGrid, 
  Briefcase, 
  Users, 
  Settings,
  LayoutDashboard
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { canAccess, user } = useAuth();

  const links = [
    { href: "/dashboard", label: t.sidebar.dashboard, icon: LayoutGrid },
    { href: "/assets", label: t.sidebar.assets, icon: Box },
    { href: "/service", label: t.sidebar.services, icon: Briefcase },
    { href: "/users", label: t.sidebar.users, icon: Users },
    { href: "/settings", label: t.sidebar.settings, icon: Settings },
  ];

  const visibleLinks = links.filter(link => canAccess(link.href));

  return (
    <aside className="w-[260px] bg-surface border-r border-border-theme h-screen flex flex-col fixed left-0 top-0 z-20 transition-colors">
      {/* Brand area */}
      <div className="h-20 flex items-center px-8 mb-4">
        {user?.organization?.logo_url ? (
          <div className="w-full max-h-12 flex items-center justify-start overflow-hidden">
            <img 
              src={user.organization.logo_url} 
              alt={user.organization.name || "Logo"} 
              className="max-h-10 w-auto object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-brand/20">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-title tracking-tight leading-none">{t.sidebar.admin_console}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scroll">
        {visibleLinks.map((link) => {
          const isActive = pathname.startsWith(link.href);
          const Icon = link.icon;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-brand/10 text-brand shadow-sm"
                  : "text-subtitle hover:bg-app-bg hover:text-title"
              }`}
            >
              <Icon
                className={`flex-shrink-0 w-5 h-5 mr-3 transition-colors ${
                  isActive ? "text-brand" : "text-subtitle opacity-50"
                }`}
              />
              {link.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-6 border-t border-border-theme/50">
      </div>
    </aside>
  );
}
