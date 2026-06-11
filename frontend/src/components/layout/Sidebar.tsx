"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { ICON_MAP } from "@/components/ui/AssetIcon";
import {
  LayoutGrid,
  Wrench,
  Users,
  Settings,
  LayoutDashboard,
  Building2
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { canAccess, user } = useAuth();
  const AssetNavIcon = ICON_MAP[user?.organization?.default_asset_icon || ""] || ICON_MAP.ship;

  const links = [
    { href: "/dashboard", label: t.sidebar.dashboard, icon: LayoutGrid },
    { href: "/organizations", label: t.sidebar.organizations, icon: Building2 },
    { href: "/assets", label: t.sidebar.assets, icon: AssetNavIcon },
    { href: "/service", label: t.sidebar.services, icon: Wrench },
    { href: "/users", label: t.sidebar.users, icon: Users },
    { href: "/owners", label: t.sidebar.owners || "Propietarios", icon: Building2 },
    { href: "/settings", label: t.sidebar.settings, icon: Settings },
  ];

  const visibleLinks = links.filter(link => canAccess(link.href));

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-title/20 backdrop-blur-sm z-[40] lg:hidden animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed left-0 top-0 h-screen w-[260px] bg-surface border-r border-border-theme z-[50] flex flex-col transition-transform duration-300 ease-spring
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Brand area */}
        <div className="h-20 flex items-center px-8 mb-4">
          {user?.organization?.logo_url ? (
            <div className="flex items-center space-x-3 min-w-0">
              <img
                src={user.organization.logo_url}
                alt={user.organization.name || "Logo"}
                className="max-h-10 w-auto object-contain shrink-0"
              />
              <span className="min-w-0 max-w-[160px] whitespace-normal break-words font-bold text-sm text-title tracking-tight leading-tight">
                {user.organization.show_org_name ? user.organization.name : "Recall"}
              </span>
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
                onClick={onClose}
                className={`flex items-center px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-brand/10 text-brand shadow-sm"
                    : "text-subtitle hover:bg-app-bg hover:text-title"
                }`}
              >
                <Icon
                  className={`shrink-0 w-5 h-5 mr-3 transition-colors ${
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
    </>
  );
}
