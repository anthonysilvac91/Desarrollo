"use client";

import React, { useRef, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { Wrench, Calendar, Inbox, Loader2, Mail, Pencil, X, Trash2, KeyRound, MoreVertical } from "lucide-react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import ServiceHistoryCard from "@/components/services/ServiceHistoryCard";
import ServiceDetailView from "@/components/services/ServiceDetailView";
import type { Service as DrawerService } from "@/services/services.service";
import { useLanguage } from "@/lib/LanguageContext";
import { User, usersService } from "@/services/users.service";
import { servicesService } from "@/services/services.service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/ToastContext";
import { compressImageFile } from "@/lib/imageCompression";
import ImageCropModal from "@/components/ui/ImageCropModal";

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

const formatCompactDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const year = String(d.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
};

const getRoleStyle = (role: string) => {
  const styles: Record<string, string> = {
    SUPER_ADMIN: "bg-indigo-50 text-indigo-600 border-indigo-100",
    ADMIN:       "bg-indigo-50 text-indigo-600 border-indigo-100",
    WORKER:      "bg-amber-50 text-amber-600 border-amber-100",
    EXTERNAL:    "bg-slate-100 text-slate-600 border-slate-200",
  };
  return styles[role] || "bg-gray-50 text-gray-600 border-gray-100";
};

export default function UserDrawer({ user, onClose }: UserDrawerProps) {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [dateFilter, setDateFilter] = useState<"custom" | null>(null);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isPhotoUpdating, setIsPhotoUpdating] = useState(false);
  const [view, setView] = useState<"history" | "service-detail">("history");
  const [selectedService, setSelectedService] = useState<DrawerService | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setView("history");
    setSelectedService(null);
  }, [user?.id]);

  React.useEffect(() => {
    if (!isDatePickerOpen) return;
    const handle = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node))
        setIsDatePickerOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isDatePickerOpen]);

  React.useEffect(() => {
    if (!isActionsMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node))
        setIsActionsMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isActionsMenuOpen]);

  const { data: servicesData, isLoading } = useQuery({
    queryKey: ["services", "by-worker", user?.id],
    queryFn: () => servicesService.findAll({ worker_id: user!.id, limit: 50 }),
    enabled: !!user?.id,
  });

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsPhotoUpdating(true);
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 800,
        quality: 0.85,
        maxBytes: 2 * 1024 * 1024,
        fileNamePrefix: "avatar-source",
      });
      const reader = new FileReader();
      reader.onloadend = () => setCropSrc(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.image_process_error, "error");
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  const handleCropConfirm = async (croppedFile: File) => {
    if (!user?.id || isPhotoUpdating) return;
    setIsPhotoUpdating(true);
    try {
      const formData = new FormData();
      formData.append("avatar", croppedFile);
      await usersService.update(user.id, formData);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast(t.assets.drawer.photo_updated, "success");
      setCropSrc(null);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      showToast(Array.isArray(msg) ? msg[0] : msg || t.assets.drawer.photo_update_error, "error");
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  if (!user) return <Drawer isOpen={false} onClose={onClose}><div /></Drawer>;

  const services = Array.isArray(servicesData) ? servicesData : servicesData?.data || [];

  const selectedDateLabel =
    dateFilter === "custom" && customRange?.from
      ? `${customRange.from.toLocaleDateString("es", { day: "2-digit", month: "short" })}${
          customRange.to
            ? ` - ${customRange.to.toLocaleDateString("es", { day: "2-digit", month: "short" })}`
            : " - ..."
        }`
      : t.date_filters.date;

  const filteredServices = dateFilter === "custom" && customRange?.from
    ? services.filter((s: any) => {
        const d = new Date(s.created_at);
        const from = new Date(customRange.from!); from.setHours(0, 0, 0, 0);
        const to = customRange.to ? new Date(customRange.to) : new Date(customRange.from!);
        to.setHours(23, 59, 59, 999);
        return d >= from && d <= to;
      })
    : services;
  const initials = user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = ROLE_LABELS[user.role]?.[language] ?? user.role;
  const lastServiceDate = services.length > 0
    ? services.reduce((a: any, b: any) => new Date(a.created_at) > new Date(b.created_at) ? a : b).created_at
    : null;

  return (
    <>
      <Drawer
        isOpen={!!user}
        onClose={onClose}
        panelClassName="bg-app-bg"
        closeButtonClassName="p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all shrink-0"
        leftAction={
          <div ref={actionsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsActionsMenuOpen(v => !v)}
              className="p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {isActionsMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-50 overflow-hidden py-1">
                <button
                  type="button"
                  onClick={() => setIsActionsMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-bg transition-colors text-left"
                >
                  <Pencil className="w-4 h-4 text-subtitle/50 shrink-0" />
                  <span className="text-sm font-semibold text-title">Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsActionsMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-bg transition-colors text-left"
                >
                  <KeyRound className="w-4 h-4 text-subtitle/50 shrink-0" />
                  <span className="text-sm font-semibold text-title">Restablecer contraseña</span>
                </button>
                <div className="mx-3 my-1 border-t border-border-theme/20" />
                <button
                  type="button"
                  onClick={() => setIsActionsMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-error/5 transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4 text-error/60 shrink-0" />
                  <span className="text-sm font-semibold text-error/80">Eliminar</span>
                </button>
              </div>
            )}
          </div>
        }
      >
        <div className="flex flex-col min-h-full">

          {/* Header */}
          <div className="p-10 pb-6 flex flex-col items-center text-center space-y-5 pt-16 lg:pt-24">
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-brand/5 flex items-center justify-center ring-1 ring-border-theme/20">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-brand tracking-tighter">{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => !isPhotoUpdating && fileInputRef.current?.click()}
                disabled={isPhotoUpdating}
                className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-brand text-white shadow-lg shadow-brand/25 flex items-center justify-center active:scale-95 transition-all disabled:opacity-60"
              >
                {isPhotoUpdating
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Pencil className="w-4 h-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>

            <div className="flex flex-col items-center space-y-1">
              <h2 className="text-3xl font-black text-title tracking-tight">{user.name}</h2>
              <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${getRoleStyle(user.role)}`}>
                {roleLabel}
              </span>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-subtitle/40 shrink-0" />
                  <span className="text-sm text-subtitle/60 font-medium">{user.email}</span>
                </div>
                <div className="w-px h-4 bg-subtitle/20" />
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-green-500" : "bg-red-500"}`} />
                  {user.is_active ? t.common.active : t.common.inactive}
                </span>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 px-6 py-4">
            <div className="bg-surface rounded-2xl p-4 border border-border-theme/40 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-subtitle/40 uppercase tracking-widest block">
                  {t.assets.table.last_service}
                </span>
                <span className="text-[13px] font-bold text-title truncate block">
                  {isLoading ? "—" : lastServiceDate ? formatCompactDate(lastServiceDate) : "---"}
                </span>
              </div>
            </div>
            <div className="bg-surface rounded-2xl p-4 border border-border-theme/40 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-subtitle/40 uppercase tracking-widest block">
                  {t.assets.drawer.total_label}
                </span>
                <span className="text-sm font-bold text-title block">
                  {isLoading ? "—" : `${services.length} ${t.assets.table.services}`}
                </span>
              </div>
            </div>
          </div>

          {/* Historial o detalle de servicio */}
          {view === "service-detail" && selectedService ? (
            <ServiceDetailView
              service={selectedService}
              onClose={() => { setView("history"); setSelectedService(null); }}
              hideWorker
            />
          ) : (
          <div className="px-6 py-8 space-y-4 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">
                {t.assets.detail.activity_history}
              </h3>
              <div ref={datePickerRef} className="relative">
                <button
                  onClick={() => { setDateFilter("custom"); setIsDatePickerOpen(v => !v); }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border flex items-center gap-2 ${
                    dateFilter === "custom" && customRange?.from
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-surface border-border-theme/40 text-subtitle/60 hover:border-brand/30"
                  }`}
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  {selectedDateLabel}
                  {dateFilter === "custom" && customRange?.from && (
                    <X className="w-3 h-3 shrink-0" onClick={(e) => { e.stopPropagation(); setDateFilter(null); setCustomRange(undefined); }} />
                  )}
                </button>
                {isDatePickerOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 w-[min(330px,calc(100vw-3rem))] p-4">
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-app-bg px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-subtitle/35">{t.date_filters.from}</span>
                        <span className="block truncate text-xs font-bold text-title">
                          {customRange?.from ? customRange.from.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "--"}
                        </span>
                      </div>
                      <div className="rounded-xl bg-app-bg px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-subtitle/35">{t.date_filters.to}</span>
                        <span className="block truncate text-xs font-bold text-title">
                          {customRange?.to ? customRange.to.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "--"}
                        </span>
                      </div>
                    </div>
                    <DayPicker
                      mode="range"
                      selected={customRange}
                      onSelect={(range) => { setCustomRange(range); if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) setIsDatePickerOpen(false); }}
                      classNames={{
                        caption_label: "text-sm font-black text-title",
                        nav: "absolute inset-x-0 top-0 flex justify-between",
                        button_previous: "p-1.5 rounded-full hover:bg-app-bg text-subtitle/40 hover:text-brand transition-all",
                        button_next: "p-1.5 rounded-full hover:bg-app-bg text-subtitle/40 hover:text-brand transition-all",
                        month_grid: "w-full border-collapse mt-1",
                        weekday: "text-center text-[10px] font-black text-subtitle/30 uppercase pb-2 w-9",
                        day: "p-0 text-center",
                        day_button: "w-9 h-9 rounded-full text-xs font-semibold flex items-center justify-center transition-all hover:bg-brand/10 hover:text-brand mx-auto",
                        selected: "!bg-brand !text-white rounded-full",
                        today: "text-brand font-black",
                        range_start: "!bg-brand !text-white rounded-full",
                        range_end: "!bg-brand !text-white rounded-full",
                        range_middle: "bg-brand/10 !text-brand rounded-none",
                        outside: "opacity-20",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

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
            ) : filteredServices.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/8 text-brand/40 ring-8 ring-brand/5">
                  <Calendar className="h-7 w-7" strokeWidth={1.75} />
                </div>
                <h4 className="text-xl font-black tracking-tight text-title">
                  {t.assets.detail.no_results}
                </h4>
                <p className="text-sm font-medium leading-relaxed text-subtitle/60">
                  {t.mobile.asset_detail.no_results_subtitle}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredServices.map((svc: any) => (
                  <ServiceHistoryCard
                    key={svc.id}
                    service={svc}
                    secondaryBadge="owner"
                    viewDetailsLabel={t.assets.drawer.view_details}
                    onViewDetails={() => { setSelectedService(svc as DrawerService); setView("service-detail"); }}
                  />
                ))}
              </div>
            )}
          </div>
          )}

        </div>
      </Drawer>

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

    </>
  );
}
