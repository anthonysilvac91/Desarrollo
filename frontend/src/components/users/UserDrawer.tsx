"use client";

import React from "react";
import Drawer from "@/components/ui/Drawer";
import { Shield, Wrench, Ship, Calendar, Inbox, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { User } from "@/services/users.service";
import { servicesService } from "@/services/services.service";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/formatDate";

interface UserDrawerProps {
  user: User | null;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, { en: string; es: string }> = {
  SUPER_ADMIN: { en: "Super Admin", es: "Super Admin" },
  ADMIN:       { en: "Admin",       es: "Admin" },
  WORKER:      { en: "Worker",      es: "Operador" },
  EXTERNAL:    { en: "External",    es: "Externo" },
};

export default function UserDrawer({ user, onClose }: UserDrawerProps) {
  const { t, language } = useLanguage();

  const { data: servicesData, isLoading } = useQuery({
    queryKey: ["services", "by-worker", user?.id],
    queryFn: () => servicesService.findAll({ worker_id: user!.id, limit: 50 }),
    enabled: !!user?.id,
  });

  if (!user) return <Drawer isOpen={false} onClose={onClose}><div /></Drawer>;

  const services = Array.isArray(servicesData) ? servicesData : servicesData?.data || [];
  const initials = user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = ROLE_LABELS[user.role]?.[language] ?? user.role;

  return (
    <Drawer isOpen={!!user} onClose={onClose}>
      <div className="flex flex-col min-h-full">

        {/* Header */}
        <div className="p-10 pb-6 flex flex-col items-center text-center space-y-5 bg-linear-to-b from-gray-50/50 to-white pt-24">
          <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl bg-brand/5 flex items-center justify-center relative ring-1 ring-border-theme/20">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-3xl font-black text-brand tracking-tighter">{initials}</span>
            )}
            <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white ${user.is_active ? "bg-emerald-500" : "bg-rose-400"}`} />
          </div>
          <div className="flex flex-col space-y-1">
            <h2 className="text-3xl font-black text-title tracking-tight">{user.name}</h2>
            <div className="flex items-center justify-center text-brand font-black text-sm uppercase tracking-[0.2em]">
              <Shield className="w-3.5 h-3.5 mr-2" />
              {roleLabel}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="px-10 py-6 grid grid-cols-2 gap-4 border-y border-gray-50">
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">
              {t.users.table.status}
            </span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-rose-400"}`} />
              <span className="text-sm font-bold text-title">
                {user.is_active ? t.common.active : t.common.inactive}
              </span>
            </div>
          </div>
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">
              {t.users.table.owner}
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-title truncate">
                {user.owner?.name || user.organization?.name || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Services list */}
        <div className="px-10 py-8 space-y-4 flex-1">
          <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">
            {t.users.drawer.services_label}
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-border-theme/20 rounded-3xl flex flex-col items-center justify-center text-center space-y-2">
              <Inbox className="w-8 h-8 text-subtitle/20" />
              <p className="text-sm font-black text-subtitle/40 uppercase tracking-widest">
                {t.users.drawer.empty_title}
              </p>
              <p className="text-xs text-subtitle/30 font-medium max-w-50">
                {t.users.drawer.empty_subtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((svc: any) => (
                <div
                  key={svc.id}
                  className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50 space-y-2"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center text-brand shrink-0 mt-0.5">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-title leading-tight truncate">{svc.title}</p>
                      {svc.asset?.name && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Ship className="w-3 h-3 text-subtitle/40 shrink-0" />
                          <span className="text-xs font-semibold text-subtitle/60 truncate">{svc.asset.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 text-subtitle/40">
                      <Calendar className="w-3 h-3" />
                      <span className="text-xs font-semibold">{formatDate(svc.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Drawer>
  );
}
