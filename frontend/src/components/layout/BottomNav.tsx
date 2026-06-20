"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench, LayoutGrid, Users, Building2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ICON_MAP } from "@/components/ui/AssetIcon";

export default function BottomNav() {
  const pathname = usePathname();
  const { canAccess, user } = useAuth();
  const { t } = useLanguage();
  const AssetNavIcon = ICON_MAP[user?.organization?.default_asset_icon || ""] || ICON_MAP.ship;

  const links = [
    { href: "/dashboard", label: t.sidebar.dashboard, icon: LayoutGrid },
    { href: "/assets", label: t.sidebar.assets, icon: AssetNavIcon },
    { href: "/service", label: t.sidebar.services, icon: Wrench },
    { href: "/users", label: t.sidebar.users, icon: Users },
    { href: "/owners", label: t.sidebar.owners, icon: Building2 },
  ].filter((link) => canAccess(link.href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-theme/70 bg-white/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl md:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className="mx-auto grid max-w-md gap-1"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      >
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition-all ${
                isActive ? "bg-brand/10 text-brand" : "text-subtitle/45 active:bg-app-bg"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
