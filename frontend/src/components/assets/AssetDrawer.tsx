"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Drawer from "@/components/ui/Drawer";
import { useRouter } from "next/navigation";
import { MapPin, Ship, Calendar, Camera, Loader2, Maximize2, Wrench, ChevronDown, X, Search, ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Asset, assetsService } from "@/services/assets.service";
import { formatDate } from "@/lib/formatDate";
import ServiceDetailView from "@/components/services/ServiceDetailView";
import ImageCropModal from "@/components/ui/ImageCropModal";
import NewServiceForm from "@/components/assets/NewServiceForm";
import { useToast } from "@/lib/ToastContext";
import { ASSET_IMAGE_MAX_BYTES, compressImageFile } from "@/lib/imageCompression";
import type { Service as DrawerService } from "@/services/services.service";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";

interface AssetDrawerProps {
  asset: Asset | null;
  onClose: () => void;
}

// Fallback image component for thumbnails/cards
const JobThumbnail = ({ src }: { src?: string | null }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className="w-full h-full bg-gray-50 flex items-center justify-center border border-gray-100 rounded-lg">
        <Camera className="w-5 h-5 text-subtitle/20" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt="Job proof" 
      className="w-full h-full object-cover rounded-lg" 
      onError={() => setError(true)}
    />
  );
};

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

export default function AssetDrawer({ asset: initialAsset, onClose }: AssetDrawerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<DrawerService | null>(null);
  const [view, setView] = useState<"history" | "new-service" | "service-detail">("history");
  const [visibleCount, setVisibleCount] = useState(4);
  const [workerFilter, setWorkerFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"custom" | null>(null);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [workerSearch, setWorkerSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerDropdownRef = useRef<HTMLDivElement>(null);
  const customPickerRef = useRef<HTMLDivElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isPhotoUpdating, setIsPhotoUpdating] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const canCreateService = user?.role === "ADMIN" || user?.role === "WORKER" || user?.role === "SUPER_ADMIN";

  const {
    data: fullAsset,
    isFetching: isFetchingAsset,
    refetch: refetchAsset,
  } = useQuery({
    queryKey: ["asset", initialAsset?.id],
    queryFn: () => assetsService.findOne(initialAsset!.id),
    enabled: !!initialAsset?.id,
    refetchInterval: AUTO_REFETCH_INTERVALS.fast,
    ...AUTO_REFETCH_OPTIONS,
  });

  const selectedDateLabel =
    dateFilter === "custom" && customRange?.from
      ? `${customRange.from.toLocaleDateString("es", { day: "2-digit", month: "short" })}${
          customRange.to
            ? ` - ${customRange.to.toLocaleDateString("es", { day: "2-digit", month: "short" })}`
            : " - ..."
        }`
      : "Date";

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsPhotoUpdating(true);

    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 2400,
        quality: 0.85,
        maxBytes: ASSET_IMAGE_MAX_BYTES,
        fileNamePrefix: "asset-photo-source",
      });
      const reader = new FileReader();
      reader.onloadend = () => setCropSrc(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo procesar la imagen.", "error");
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  const handleCropConfirm = async (croppedFile: File) => {
    if (!initialAsset?.id || isPhotoUpdating) return;
    setIsPhotoUpdating(true);

    try {
      const formData = new FormData();
      formData.append("photo", croppedFile);
      await assetsService.update(initialAsset.id, formData);
      await queryClient.invalidateQueries({ queryKey: ["asset", initialAsset.id] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      showToast("Foto actualizada.", "success");
      setCropSrc(null);
    } catch (err: unknown) {
      const maybeError = err as { response?: { data?: { message?: string | string[] } } };
      const message = maybeError.response?.data?.message;
      showToast(
        Array.isArray(message) ? message[0] : message || "No se pudo actualizar la foto.",
        "error",
      );
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  useEffect(() => {
    if (initialAsset?.id) {
      setView("history");
      setSelectedService(null);
      setVisibleCount(4);
      setWorkerFilter(null);
      setDateFilter(null);
      setCustomRange(undefined);
      setIsCustomPickerOpen(false);
    }
  }, [initialAsset?.id]);

  // Hooks antes del early return — obligatorio por Rules of Hooks
  const allHistory = (fullAsset || initialAsset)?.services || [];

  const uniqueWorkers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    allHistory.forEach(s => { if (s.worker?.id && !map.has(s.worker.id)) map.set(s.worker.id, s.worker); });
    return Array.from(map.values());
  }, [allHistory]);

  useEffect(() => {
    if (!isWorkerDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (workerDropdownRef.current && !workerDropdownRef.current.contains(e.target as Node)) {
        setIsWorkerDropdownOpen(false);
        setWorkerSearch("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isWorkerDropdownOpen]);

  useEffect(() => {
    if (!isCustomPickerOpen) return;
    const handle = (e: MouseEvent) => {
      if (customPickerRef.current && !customPickerRef.current.contains(e.target as Node))
        setIsCustomPickerOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isCustomPickerOpen]);

  const handleServiceCreated = async () => {
    setView("history");
    if (initialAsset?.id) {
      await refetchAsset();
    }
  };

  if (!initialAsset) return <Drawer isOpen={false} onClose={onClose}><div /></Drawer>;

  const currentAsset = fullAsset || initialAsset;

  const history = allHistory.filter(s => {
    if (workerFilter && s.worker?.id !== workerFilter) return false;
    if (dateFilter === "custom" && customRange?.from) {
      const d = new Date(s.created_at);
      const from = new Date(customRange.from); from.setHours(0, 0, 0, 0);
      const to = customRange.to ? new Date(customRange.to) : new Date(customRange.from);
      to.setHours(23, 59, 59, 999);
      return d >= from && d <= to;
    }
    return true;
  });

  // Left action for the drawer (Expand icon)
  const ExpandAction = (
    <button 
      onClick={() => {
        onClose();
        router.push(`/assets/${initialAsset.id}`);
      }}
      className="hidden lg:flex p-2.5 rounded-full hover:bg-app-bg text-subtitle/40 hover:text-brand transition-all group"
    >
      <Maximize2 className="w-6 h-6" />
    </button>
  );

  return (
    <Drawer isOpen={!!initialAsset} onClose={onClose} leftAction={ExpandAction} panelClassName="bg-app-bg">
      <div className="flex flex-col min-h-full">
        
        {/* Header Section */}
        <div className="p-10 pb-6 flex flex-col items-center text-center space-y-5 pt-16 lg:pt-24">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gray-50 flex items-center justify-center ring-1 ring-border-theme/20">
              {currentAsset.thumbnail_url ? (
                <img src={currentAsset.thumbnail_url} alt={currentAsset.name} className="w-full h-full object-cover" />
              ) : (
                <Ship className="w-12 h-12 text-brand" strokeWidth={1.5} />
              )}
            </div>
            <button
              type="button"
              onClick={() => !isPhotoUpdating && fileInputRef.current?.click()}
              disabled={isPhotoUpdating}
              className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-brand text-white shadow-lg shadow-brand/25 flex items-center justify-center active:scale-95 transition-all disabled:opacity-60"
              aria-label="Cambiar foto"
            >
              {isPhotoUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
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
            <h2 className="text-3xl font-black text-title tracking-tight">{currentAsset.name}</h2>
            <span className="text-brand font-black text-sm uppercase tracking-[0.2em]">
              {currentAsset.owner?.name || t.common.unassigned}
            </span>
            {/* Mobile: location + status inline */}
            <div className="lg:hidden flex items-center gap-3 pt-2">
              {currentAsset.location && (
                <>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-subtitle/40 shrink-0" />
                    <span className="text-sm text-subtitle/60 font-medium">{currentAsset.location}</span>
                  </div>
                  <div className="w-px h-4 bg-subtitle/20" />
                </>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                currentAsset.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${currentAsset.is_active ? "bg-green-500" : "bg-red-500"}`} />
                {currentAsset.is_active ? t.common.active : t.common.inactive}
              </span>
            </div>
          </div>
        </div>

        {/* Action Info Summary — desktop only */}
        <div className="hidden lg:grid px-10 py-6 grid-cols-2 gap-4 border-y border-border-theme/30">
          <div className="bg-surface rounded-2xl p-4 border border-border-theme/40">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">
              {t.assets.drawer.location}
            </span>
            <span className="text-sm font-bold text-title">{currentAsset.location}</span>
          </div>
          <div className="bg-surface rounded-2xl p-4 border border-border-theme/40">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">
              {t.assets.drawer.services}
            </span>
            <span className="text-sm font-bold text-title">{currentAsset.services?.length || 0} {t.assets.drawer.total}</span>
          </div>
        </div>

        {/* Mobile stat cards */}
        <div className="lg:hidden grid grid-cols-2 gap-3 px-6 py-4">
          <div className="bg-surface rounded-2xl p-4 border border-border-theme/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-brand" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black text-subtitle/40 uppercase tracking-widest block">
                {t.assets.table.last_service}
              </span>
              <span className="text-sm font-bold text-title truncate block">
                {currentAsset.last_service?.date ? formatDate(currentAsset.last_service.date) : "---"}
              </span>
            </div>
          </div>
          <div className="bg-surface rounded-2xl p-4 border border-border-theme/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4 text-brand" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black text-subtitle/40 uppercase tracking-widest block">
                Total
              </span>
              <span className="text-sm font-bold text-title block">
                {currentAsset.services?.length || 0} {t.assets.table.services}
              </span>
            </div>
          </div>
        </div>

        {/* Service detail view */}
        {view === "service-detail" && selectedService && (
          <div className="flex-1">
            <ServiceDetailView
              service={selectedService}
              onClose={() => { setView("history"); setSelectedService(null); }}
            />
          </div>
        )}

        {/* New service form view */}
        {view === "new-service" && (
          <div className="px-6 py-8 flex-1 lg:px-10">
            <NewServiceForm
              asset={currentAsset}
              onSuccess={handleServiceCreated}
              onCancel={() => setView("history")}
              inline
            />
          </div>
        )}

        {/* Maintenance History */}
        {view === "history" && (
        <>
        <div className="px-6 py-8 flex-1 lg:px-10">
          <h3 className="text-2xl font-black text-title tracking-tight leading-none text-center mb-10">
            {t.assets.drawer.maintenance_history}
          </h3>

          <div className="space-y-4">
          <div className="flex items-center gap-2">
            {/* Date filter */}
            <div className="flex items-center gap-2">
              <div ref={customPickerRef} className="relative">
                <button
                  onClick={() => { setDateFilter("custom"); setIsCustomPickerOpen(v => !v); setVisibleCount(4); }}
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

                {isCustomPickerOpen && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 w-[min(330px,calc(100vw-3rem))] p-4">
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-app-bg px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-subtitle/35">
                          {t.date_filters.from}
                        </span>
                        <span className="block truncate text-xs font-bold text-title">
                          {customRange?.from
                            ? customRange.from.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })
                            : "--"}
                        </span>
                      </div>
                      <div className="rounded-xl bg-app-bg px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-subtitle/35">
                          {t.date_filters.to}
                        </span>
                        <span className="block truncate text-xs font-bold text-title">
                          {customRange?.to
                            ? customRange.to.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })
                            : "--"}
                        </span>
                      </div>
                    </div>
                    <DayPicker
                      mode="range"
                      selected={customRange}
                      onSelect={(range) => {
                        setCustomRange(range);
                        if (range?.from && range?.to) setIsCustomPickerOpen(false);
                      }}
                      classNames={{
                        root: "text-sm",
                        month_caption: "flex justify-center items-center mb-3 relative h-8",
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
                      components={{
                        Chevron: ({ orientation }) => orientation === "left"
                          ? <ChevronLeft className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {uniqueWorkers.length > 0 && (
              <div ref={workerDropdownRef} className="relative">
                {workerFilter ? (
                  <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full pl-1 pr-2.5 py-1">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-white">
                        {getInitials(uniqueWorkers.find(w => w.id === workerFilter)?.name ?? "")}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-brand truncate max-w-24">
                      {uniqueWorkers.find(w => w.id === workerFilter)?.name}
                    </span>
                    <button onClick={() => { setWorkerFilter(null); setVisibleCount(4); }} className="text-brand/50 hover:text-brand transition-colors shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsWorkerDropdownOpen(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-theme/50 bg-surface text-subtitle/60 text-sm font-semibold transition-colors hover:border-brand/30"
                  >
                    <span>Worker</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                )}

                {isWorkerDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-20 w-56 overflow-hidden">
                    <div className="p-2.5 border-b border-border-theme/20">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-subtitle/40" />
                        <input
                          autoFocus
                          type="text"
                          value={workerSearch}
                          onChange={e => setWorkerSearch(e.target.value)}
                          placeholder="Buscar worker..."
                          className="w-full pl-7 pr-3 py-1.5 text-sm bg-app-bg rounded-xl border border-border-theme/30 focus:outline-none focus:border-brand/40 font-medium text-title placeholder:text-subtitle/30"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {uniqueWorkers
                        .filter(w => !workerSearch.trim() || w.name.toLowerCase().includes(workerSearch.toLowerCase()))
                        .map(worker => (
                          <button
                            key={worker.id}
                            onClick={() => { setWorkerFilter(worker.id); setVisibleCount(4); setIsWorkerDropdownOpen(false); setWorkerSearch(""); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-app-bg transition-colors text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-black text-brand">{getInitials(worker.name)}</span>
                            </div>
                            <span className="text-sm font-semibold text-title">{worker.name}</span>
                          </button>
                        ))}
                      {uniqueWorkers.filter(w => !workerSearch.trim() || w.name.toLowerCase().includes(workerSearch.toLowerCase())).length === 0 && (
                        <p className="px-4 py-3 text-sm text-subtitle/50 text-center font-medium">{t.common.no_results}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {isFetchingAsset && !fullAsset ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-brand/20" /></div>
            ) : history.slice(0, visibleCount).map((service, idx) => (
              <div
                key={service.id ?? `service-${idx}`}
                className="group bg-surface border border-border-theme/40 rounded-2xl hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 transition-all min-h-35 flex flex-col overflow-hidden"
              >
                <div className="p-5 flex flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="bg-brand/10 px-3 py-1 rounded-full flex shrink-0 items-center">
                      <Calendar className="w-3 h-3 text-brand mr-2" />
                      <span className="text-[10px] font-black text-brand uppercase tracking-wider">
                        {formatDate(service.created_at)}
                      </span>
                    </div>
                    {service.worker?.name && (
                      <div className="bg-app-bg px-3 py-1 rounded-full flex min-w-0 max-w-[52%] items-center border border-border-theme/40">
                        <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[7px] font-black text-brand">
                          {getInitials(service.worker.name)}
                        </span>
                        <span className="truncate text-[10px] font-black text-subtitle/60 uppercase tracking-wider">
                          {service.worker.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-title mb-2 group-hover:text-brand transition-colors truncate">{service.title}</h4>
                  <p className="text-sm text-subtitle/70 leading-relaxed mb-4 font-medium overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                    {service.description}
                  </p>
                  {/* Image Thumbnails */}
                  {service.attachments && service.attachments.length > 0 && (
                    <div className="flex items-center gap-2.5 mt-auto">
                      {service.attachments.slice(0, 4).map((att, idx) => (
                        <div key={idx} className="w-12 h-12 rounded-lg border border-border-theme/20 overflow-hidden shadow-sm hover:scale-110 transition-transform bg-white">
                          <JobThumbnail src={att.file_url} />
                        </div>
                      ))}
                      {service.attachments.length > 4 && (
                        <div className="text-[10px] font-black text-subtitle opacity-30">+{service.attachments.length - 4}</div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedService(service as unknown as DrawerService); setView("service-detail"); }}
                  className="flex min-h-13 w-full items-center justify-between border-t border-border-theme/30 px-5 py-3 text-brand transition-all hover:bg-brand/5 active:bg-brand/10 cursor-pointer"
                >
                  <span className="text-sm font-black">Ver detalles</span>
                  <ChevronRight className="w-5 h-5 shrink-0" />
                </button>
              </div>
            ))}
          </div>
          </div>
        </div>

        <div className="p-10 pt-4">
          {history.length > visibleCount ? (
            visibleCount < 8 ? (
              <button
                onClick={() => setVisibleCount(8)}
                className="w-full py-4 text-center text-xs font-black text-brand uppercase tracking-widest border-2 border-brand/20 rounded-2xl hover:bg-brand/5 transition-all"
              >
                {t.assets.drawer.see_more_services}
              </button>
            ) : (
              <button
                onClick={() => { onClose(); router.push(`/assets/${initialAsset.id}`); }}
                className="w-full py-4 text-center text-xs font-black text-brand uppercase tracking-widest border-2 border-brand/20 rounded-2xl hover:bg-brand/5 transition-all"
              >
                {t.assets.drawer.view_full_history}
              </button>
            )
          ) : (
            <div className="w-full py-4 text-center text-xs font-bold text-subtitle/30 border-2 border-dashed border-border-theme/40 rounded-2xl">
              {t.assets.drawer.all_loaded}
            </div>
          )}
        </div>
        </>
        )}

      </div>

      {canCreateService && view === "history" && (
        <button
          onClick={() => setView("new-service")}
          className="fixed bottom-24 right-6 lg:hidden z-60 w-14 h-14 bg-brand text-white rounded-full shadow-xl shadow-brand/30 flex items-center justify-center active:scale-95 transition-all"
          aria-label={t.services.add_new}
        >
          <Plus className="w-6 h-6 stroke-[3px]" />
        </button>
      )}

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
          onError={(msg) => showToast(msg, "error")}
        />
      )}
    </Drawer>
  );
}
