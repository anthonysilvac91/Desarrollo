"use client";

import React, { useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsService, Service, ServiceAttachment } from "@/services/assets.service";
import { Loader2, AlertCircle, Info, ChevronLeft, MapPin, History, Filter, Users, Calendar, User as UserIcon, Plus, Pencil, X, Wrench, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import ServiceDrawer from "@/components/services/ServiceDrawer";
import ServiceAttachmentCard from "@/components/services/ServiceAttachmentCard";
import ImageCropModal from "@/components/ui/ImageCropModal";
import { formatDate } from "@/lib/formatDate";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/lib/ToastContext";
import { ASSET_IMAGE_MAX_BYTES, compressImageFile } from "@/lib/imageCompression";
import type { Service as DrawerService } from "@/services/services.service";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";
import AssetIcon from "@/components/ui/AssetIcon";

const StatusBadge = ({ status }: { status: "OPERATIVO" | "ATENCIÓN" | "PENDIENTE" }) => {
  const styles = {
    OPERATIVO: "bg-green-100 text-green-700 border-green-200",
    ATENCIÓN: "bg-amber-100 text-amber-700 border-amber-200",
    PENDIENTE: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
};

const JobCard = ({ job, onClick }: { job: Service, onClick?: () => void }) => {
  const { t, language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (textRef.current) {
      const { scrollHeight, clientHeight } = textRef.current;
      setIsTruncated(scrollHeight > clientHeight);
    }
  }, [job.description]);

  return (
    <div 
      onClick={onClick}
      className="group flex flex-col bg-surface rounded-4xl border border-border-theme/40 overflow-hidden hover:border-brand/40 hover:shadow-2xl transition-all duration-300 cursor-pointer"
    >
      <div className="flex-1 p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-brand/5 px-3 py-1.5 rounded-full flex items-center border border-brand/5">
              <Calendar className="w-3.5 h-3.5 text-brand mr-2" />
              <span className="text-[10px] font-black text-brand uppercase tracking-wider">
                {formatDate(job.created_at)}
              </span>
            </div>
            <div className="bg-app-bg px-3 py-1.5 rounded-full flex items-center border border-border-theme/60">
              <UserIcon className="w-3.5 h-3.5 text-subtitle/40 mr-2" />
              <span className="text-[10px] font-black text-subtitle/60 uppercase tracking-wider">{job.worker.name}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-xl font-bold text-title group-hover:text-brand transition-colors tracking-tight">{job.title}</h4>
        </div>
        
        <div className="relative">
          <p 
            ref={textRef}
            className={`text-[15px] text-subtitle/70 leading-relaxed font-bold transition-all duration-300 whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-3"}`}
          >
            {job.description}
          </p>
          {(isTruncated || isExpanded) && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-[11px] font-black text-brand uppercase tracking-widest hover:underline"
            >
              {isExpanded ? t.assets.detail.see_less : t.assets.detail.see_more}
            </button>
          )}
        </div>
        
        {job.attachments?.length > 0 && (
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border-theme/10">
            {job.attachments.map((img: ServiceAttachment, idx: number) => (
              <ServiceAttachmentCard
                key={idx}
                attachment={img}
                alt="Evidence"
                size="sm"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = params.id as string;
  const { t } = useLanguage();
  const { user } = useAuth();
  const assetIconId = user?.organization?.default_asset_icon;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const canCreateService = user?.role === "ADMIN" || user?.role === "WORKER" || user?.role === "SUPER_ADMIN";

  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedService, setSelectedService] = useState<DrawerService | null>(null);
  const [mobileDateRange, setMobileDateRange] = useState<DateRange | undefined>(undefined);
  const [isMobileDateOpen, setIsMobileDateOpen] = useState(false);
  const mobileDateRef = useRef<HTMLDivElement>(null);
  const [isMobileUserOpen, setIsMobileUserOpen] = useState(false);
  const mobileUserRef = useRef<HTMLDivElement>(null);

  // Photo edit
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isPhotoUpdating, setIsPhotoUpdating] = useState(false);

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
      showToast(err instanceof Error ? err.message : t.common.image_process_error, "error");
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  const handleCropConfirm = async (croppedFile: File) => {
    if (!asset || isPhotoUpdating) return;
    setIsPhotoUpdating(true);
    try {
      const formData = new FormData();
      formData.append("photo", croppedFile);
      await assetsService.update(asset.id, formData);
      await queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      showToast(t.assets.drawer.photo_updated, "success");
      setCropSrc(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      showToast(Array.isArray(msg) ? msg[0] : msg || t.assets.drawer.photo_update_error, "error");
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  React.useEffect(() => {
    if (!isMobileDateOpen) return;
    const handle = (e: MouseEvent) => {
      if (mobileDateRef.current && !mobileDateRef.current.contains(e.target as Node))
        setIsMobileDateOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isMobileDateOpen]);

  React.useEffect(() => {
    if (!isMobileUserOpen) return;
    const handle = (e: MouseEvent) => {
      if (mobileUserRef.current && !mobileUserRef.current.contains(e.target as Node))
        setIsMobileUserOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isMobileUserOpen]);

  const { data: asset, isLoading, isError, refetch } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsService.findOne(assetId),
    enabled: !!assetId,
    refetchInterval: AUTO_REFETCH_INTERVALS.detail,
    ...AUTO_REFETCH_OPTIONS,
  });

  const mobileDateLabel = mobileDateRange?.from
    ? `${mobileDateRange.from.toLocaleDateString("es", { day: "2-digit", month: "short" })}${
        mobileDateRange.to
          ? ` - ${mobileDateRange.to.toLocaleDateString("es", { day: "2-digit", month: "short" })}`
          : " - ..."
      }`
    : t.date_filters.date;

  const filteredJobs = useMemo(() => {
    if (!asset?.services) return [];
    let jobs = asset.services;

    if (selectedWorkers.length > 0) {
      jobs = jobs.filter(j => selectedWorkers.includes(j.worker.name));
    }

    // Mobile: DayPicker range
    if (mobileDateRange?.from) {
      jobs = jobs.filter(j => {
        const d = new Date(j.created_at);
        const from = new Date(mobileDateRange.from!); from.setHours(0, 0, 0, 0);
        const to = mobileDateRange.to ? new Date(mobileDateRange.to) : new Date(mobileDateRange.from!);
        to.setHours(23, 59, 59, 999);
        return d >= from && d <= to;
      });
    } else if (datePreset) {
      // Desktop sidebar presets
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      jobs = jobs.filter(j => {
        const diffDays = (now.getTime() - new Date(j.created_at).getTime()) / oneDay;
        if (datePreset === "Hoy") return diffDays <= 1;
        if (datePreset === "Semana") return diffDays <= 7;
        if (datePreset === "Mes") return diffDays <= 30;
        if (datePreset === "Año") return diffDays <= 365;
        return true;
      });
    } else if (startDate || endDate) {
      jobs = jobs.filter(j => {
        const jobDate = new Date(j.created_at);
        if (startDate && jobDate < new Date(startDate)) return false;
        if (endDate && jobDate > new Date(endDate)) return false;
        return true;
      });
    }

    return jobs;
  }, [selectedWorkers, mobileDateRange, datePreset, startDate, endDate, asset?.services]);
  const hasServiceHistory = (asset?.services?.length ?? 0) > 0;

  const toggleWorker = (workerName: string) => {
    setSelectedWorkers(prev => 
      prev.includes(workerName) 
        ? prev.filter(w => w !== workerName) 
        : [...prev, workerName]
    );
  };

  const clearFilters = () => {
    setSelectedWorkers([]);
    setDatePreset(null);
    setStartDate("");
    setEndDate("");
    setMobileDateRange(undefined);
  };

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
        <p className="font-black text-subtitle/40 tracking-widest text-xs uppercase">{t.mobile.asset_detail.loading}</p>
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-40 space-y-4">
        <div className="p-4 bg-error/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div className="text-center">
          <p className="font-black text-title text-xl">{t.mobile.asset_detail.error_title}</p>
          <p className="text-subtitle font-medium">{t.mobile.asset_detail.error_subtitle}</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="px-8 py-3 bg-title text-white rounded-2xl font-black text-sm"
        >
          {t.mobile.asset_detail.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 lg:space-y-8 pb-24 lg:pb-20 animate-in fade-in duration-500">

      {/* 1. HERO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center space-x-4 sm:space-x-6">
          <button onClick={() => router.back()} className="p-3 sm:p-3.5 rounded-full bg-surface border border-border-theme/60 hover:bg-app-bg transition-all shadow-sm shrink-0">
            <ChevronLeft className="w-5 h-5 stroke-[2.5px]" />
          </button>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-title tracking-tight leading-none">{asset.name}</h1>
        </div>
        {canCreateService && (
          <button
            onClick={() => router.push(`/assets/${asset.id}/new-service`)}
            className="hidden sm:flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25"
          >
            <Plus className="w-5 h-5 stroke-[4px]" />
            <span>{t.services.add_new}</span>
          </button>
        )}
      </div>

      {/* 2. ASSET SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 bg-surface p-5 sm:p-8 rounded-3xl lg:rounded-[40px] border border-border-theme/40 shadow-soft">
        <div className="flex items-center space-x-5 lg:col-span-2 lg:border-r border-border-theme/20 lg:pr-6">
          {/* Thumbnail con botón de editar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-app-bg shadow-lg bg-app-bg flex items-center justify-center">
              {asset.thumbnail_url ? (
                <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <AssetIcon iconId={assetIconId} className="w-10 h-10 sm:w-12 sm:h-12 text-brand" strokeWidth={1.5} />
              )}
            </div>
            <button
              type="button"
              onClick={() => !isPhotoUpdating && fileInputRef.current?.click()}
              disabled={isPhotoUpdating}
              className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-brand text-white shadow-lg shadow-brand/25 flex items-center justify-center active:scale-95 transition-all disabled:opacity-60"
              aria-label={t.assets.drawer.change_photo}
            >
              {isPhotoUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>
          <div>
            <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em] mb-1 block">{t.assets.detail.owner}</span>
            <h4 className="text-[22px] font-black text-title leading-tight">{asset.owner?.name || t.common.unassigned}</h4>
            <div className="mt-2 flex items-center space-x-6">
              <div className="text-[12px] font-bold text-subtitle/60 flex items-center">
                 <MapPin className="w-3.5 h-3.5 text-brand mr-1.5" />
                 <span className="font-black text-title mr-1">{t.assets.table.location}:</span> {asset.location || t.common.not_available}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col justify-center items-center lg:items-start space-y-1">
           <span className="text-[10px] font-black text-subtitle/30 uppercase tracking-widest">{t.assets.detail.total_services}</span>
           <div className="flex items-center space-x-3">
              <span className="text-2xl font-black text-title">{asset.services?.length || 0} {t.assets.detail.total_services}</span>
           </div>
        </div>

        <div className="flex flex-col justify-center items-center lg:items-start space-y-1">
           <span className="text-[10px] font-black text-subtitle/30 uppercase tracking-widest">{t.assets.detail.last_service}</span>
           <span className="text-2xl font-black text-title">
             {asset.last_service?.date ? formatDate(asset.last_service.date) : "---"}
           </span>
        </div>
      </div>

      {/* 3. SECTION TITLE */}
      <div className="flex items-center justify-between gap-3 pt-2 lg:pt-4">
        <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em] flex items-center shrink-0">
          <History className="w-4 h-4 mr-3 text-brand" />
          {t.assets.detail.activity_history}
        </h3>
        <div className="flex items-center gap-2">

          {/* USER filter — mobile inline */}
          <div ref={mobileUserRef} className="relative lg:hidden">
            <button
              onClick={() => setIsMobileUserOpen(v => !v)}
              className={`px-3 py-2 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                selectedWorkers.length > 0
                  ? "bg-brand text-white border-brand shadow-sm"
                  : "bg-surface border-border-theme/40 text-subtitle/60 hover:border-brand/30"
              }`}
            >
              <UserIcon className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-18">
                {selectedWorkers.length > 0 ? selectedWorkers[0] : "User"}
              </span>
              {selectedWorkers.length > 0
                ? <X className="w-3 h-3 shrink-0" onClick={(e) => { e.stopPropagation(); setSelectedWorkers([]); }} />
                : <ChevronDown className="w-3 h-3 shrink-0" />
              }
            </button>
            {isMobileUserOpen && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 min-w-[160px] overflow-hidden">
                {Array.from(new Set(asset.services?.map(s => s.worker.name) ?? [])).map(name => (
                  <button
                    key={name}
                    onClick={() => { setSelectedWorkers(selectedWorkers[0] === name ? [] : [name]); setIsMobileUserOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                      selectedWorkers.includes(name) ? "bg-brand/10 text-brand" : "text-title hover:bg-app-bg"
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center text-[9px] font-black text-brand shrink-0">
                      {name.split(" ").slice(0,2).map(w => w[0]).join("")}
                    </span>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DATE filter — mobile inline */}
          <div ref={mobileDateRef} className="relative lg:hidden">
            <button
              onClick={() => setIsMobileDateOpen(v => !v)}
              className={`px-3 py-2 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                mobileDateRange?.from
                  ? "bg-brand text-white border-brand shadow-sm"
                  : "bg-surface border-border-theme/40 text-subtitle/60 hover:border-brand/30"
              }`}
            >
              <Calendar className="w-3 h-3 shrink-0" />
              {mobileDateLabel}
              {mobileDateRange?.from && (
                <X className="w-3 h-3 shrink-0" onClick={(e) => { e.stopPropagation(); setMobileDateRange(undefined); }} />
              )}
            </button>
            {isMobileDateOpen && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 w-[min(330px,calc(100vw-3rem))] p-4">
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-app-bg px-3 py-2">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-subtitle/35">{t.date_filters.from}</span>
                    <span className="block truncate text-xs font-bold text-title">
                      {mobileDateRange?.from ? mobileDateRange.from.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "--"}
                    </span>
                  </div>
                  <div className="rounded-xl bg-app-bg px-3 py-2">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-subtitle/35">{t.date_filters.to}</span>
                    <span className="block truncate text-xs font-bold text-title">
                      {mobileDateRange?.to ? mobileDateRange.to.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "--"}
                    </span>
                  </div>
                </div>
                <DayPicker
                  mode="range"
                  selected={mobileDateRange}
                  onSelect={(range) => { setMobileDateRange(range); if (range?.from && range?.to) setIsMobileDateOpen(false); }}
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

          {/* Worker filter — desktop sidebar (círculo de iniciales, sin cambios) */}
          {canCreateService && user && (
            <button
              onClick={() => toggleWorker(user.name)}
              title={t.assets.detail.filter_me}
              className={`hidden lg:flex w-8 h-8 rounded-full items-center justify-center text-[10px] font-black transition-all ${
                selectedWorkers.includes(user.name)
                  ? "bg-brand text-white shadow-lg shadow-brand/25 ring-2 ring-brand/30"
                  : "bg-app-bg border border-border-theme/40 text-subtitle/60 hover:border-brand/40 hover:text-brand"
              }`}
            >
              {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </button>
          )}

          {(selectedWorkers.length > 0 || datePreset || startDate || endDate || mobileDateRange?.from) && (
            <button onClick={clearFilters} className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">
              {t.assets.detail.clear_filters}
            </button>
          )}
        </div>
      </div>

      {/* 4. MAIN GRID (Timeline + Advanced Filters Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">

        {/* Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-4 lg:space-y-6">
            {!hasServiceHistory ? (
              <div className="relative overflow-hidden rounded-[32px] border border-brand/15 bg-surface px-6 py-10 text-center shadow-soft sm:px-10 sm:py-14">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/10 text-brand ring-8 ring-brand/5">
                  <Wrench className="h-9 w-9" strokeWidth={1.75} />
                </div>
                <div className="mx-auto max-w-md space-y-2">
                  <h4 className="text-2xl font-black tracking-tight text-title">
                    {t.assets.detail.no_history}
                  </h4>
                  <p className="text-sm font-medium leading-relaxed text-subtitle/60">
                    {t.mobile.asset_detail.no_history_subtitle}
                  </p>
                </div>
              </div>
            ) : filteredJobs.map((job) => (
              <JobCard 
                key={job.id} 
                job={job} 
                onClick={() => setSelectedService(job as unknown as DrawerService)}
              />
            ))}
            
            {hasServiceHistory && filteredJobs.length === 0 && (
              <div className="py-24 text-center bg-app-bg/10 border-2 border-dashed border-border-theme/50 rounded-[40px]">
                 <Info className="w-12 h-12 text-subtitle/20 mx-auto mb-4" />
                 <p className="text-subtitle/40 font-black uppercase tracking-widest text-sm">{t.assets.detail.no_results}</p>
                 <button 
                  onClick={clearFilters}
                  className="mt-4 text-[10px] font-black text-brand uppercase tracking-widest"
                 >
                   {t.assets.detail.view_all}
                 </button>
              </div>
            )}
          </div>

        {/* Filters Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-10">
           <div className="bg-surface p-8 rounded-[40px] border border-border-theme/40 shadow-soft space-y-10">
              <div className="flex items-center space-x-3 text-title pb-2 border-b border-border-theme/20">
                 <Filter className="w-5 h-5 text-brand" />
                 <h4 className="text-sm font-black uppercase tracking-widest">{t.assets.detail.filter_title}</h4>
              </div>

              {/* Workers Filter */}
              <div className="space-y-5">
                 <label className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest">{t.assets.detail.responsible}</label>
                 <div className="space-y-2">
                    <button 
                      onClick={() => setSelectedWorkers([])}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${selectedWorkers.length === 0 ? "bg-brand text-white border-transparent shadow-lg shadow-brand/20" : "bg-app-bg/5 border-border-theme/10 text-subtitle/80"}`}
                    >
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-3" />
                        <span className="text-sm font-black">{t.assets.detail.all_workers}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 ${selectedWorkers.length === 0 ? "border-white/40 bg-white/20" : "border-border-theme/40"}`}></div>
                    </button>
                    {/* Extraemos trabajadores únicos de los servicios reales */}
                    {Array.from(new Set(asset.services?.map(s => s.worker.name) || [])).map(worker => {
                      const isActive = selectedWorkers.includes(worker);
                      return (
                        <button 
                          key={worker} 
                          onClick={() => toggleWorker(worker)}
                          className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${isActive ? "bg-brand text-white border-transparent shadow-lg shadow-brand/20" : "bg-app-bg/5 border-border-theme/10 text-subtitle/80 hover:border-brand/20 hover:text-brand"}`}
                        >
                          <div className="flex items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 font-black text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-brand/10 text-brand"}`}>
                               {worker.split(" ").map(n => n[0]).join("")}
                            </div>
                            <span className="text-sm font-bold">{worker}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 ${isActive ? "border-white/40 bg-white/20" : "border-border-theme/40"}`}></div>
                        </button>
                      );
                    })}
                 </div>
              </div>

              {/* Date Filter */}
              <div className="space-y-5">
                 <label className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest">{t.assets.detail.temporality}</label>
                 
                 {/* Custom Range */}
                 <div className="grid grid-cols-2 gap-3 pb-2 border-b border-border-theme/10 mb-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-subtitle/30 uppercase pl-1">{t.assets.detail.since}</span>
                      <div className="relative">
                        <input 
                          type="date" 
                          value={startDate}
                          onChange={(e) => { setStartDate(e.target.value); setDatePreset(null); }}
                          className="w-full px-3 py-2 bg-app-bg/10 border border-border-theme/10 rounded-xl text-[11px] font-bold text-subtitle focus:outline-none focus:border-brand/40"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-subtitle/30 uppercase pl-1">{t.assets.detail.until}</span>
                      <div className="relative">
                        <input 
                          type="date" 
                          value={endDate}
                          onChange={(e) => { setEndDate(e.target.value); setDatePreset(null); }}
                          className="w-full px-3 py-2 bg-app-bg/10 border border-border-theme/10 rounded-xl text-[11px] font-bold text-subtitle focus:outline-none focus:border-brand/40"
                        />
                      </div>
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-2">
                    {[
                      { key: "Hoy", trans: t.assets.detail.today },
                      { key: "Semana", trans: t.assets.detail.week },
                      { key: "Mes", trans: t.assets.detail.month },
                      { key: "Año", trans: t.assets.detail.year }
                    ].map(preset => (
                      <button 
                        key={preset.key} 
                        onClick={() => {
                          setDatePreset(prev => prev === preset.key ? null : preset.key);
                          setStartDate("");
                          setEndDate("");
                        }}
                        className={`px-5 py-2.5 rounded-full border text-[10px] font-black transition-all uppercase tracking-wider ${datePreset === preset.key ? "bg-brand text-white border-transparent shadow-md shadow-brand/20" : "bg-app-bg/5 border-border-theme/20 text-subtitle/40 hover:text-brand hover:border-brand/20"}`}
                      >
                        {preset.trans}
                      </button>
                    ))}
                 </div>
              </div>
           </div>
           
           <button className="w-full py-5 bg-app-bg border-2 border-dashed border-border-theme/60 rounded-4xl text-xs font-black text-subtitle/40 uppercase tracking-[0.2em] hover:bg-app-bg/80 transition-all">
              {t.assets.detail.export_pdf}
           </button>
        </div>

      </div>

      {/* FAB móvil para agregar servicio */}
      {canCreateService && (
        <button
          onClick={() => router.push(`/assets/${asset.id}/new-service`)}
          className="fixed bottom-6 right-6 sm:hidden z-20 w-14 h-14 bg-brand text-white rounded-full shadow-xl shadow-brand/30 flex items-center justify-center active:scale-95 transition-all"
          aria-label={t.services.add_new}
        >
          <Plus className="w-6 h-6 stroke-[3px]" />
        </button>
      )}

      <ServiceDrawer
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
          onError={(msg) => showToast(msg, "error")}
        />
      )}
    </div>
  );
}
