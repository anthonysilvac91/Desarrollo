"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { assetsService, Asset, Service } from "@/services/assets.service";
import { Loader2, AlertCircle, Info, ChevronLeft, MapPin, History, Filter, Users, Calendar, User as UserIcon, Camera, Building2, Ship } from "lucide-react";
import ServiceDrawer from "@/components/services/ServiceDrawer";
import ServiceAttachmentCard from "@/components/services/ServiceAttachmentCard";

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
      className="group flex flex-col bg-surface rounded-[32px] border border-border-theme/40 overflow-hidden hover:border-brand/40 hover:shadow-2xl transition-all duration-300 cursor-pointer"
    >
      <div className="flex-1 p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-brand/5 px-3 py-1.5 rounded-full flex items-center border border-brand/5">
              <Calendar className="w-3.5 h-3.5 text-brand mr-2" />
              <span className="text-[10px] font-black text-brand uppercase tracking-wider">
                {new Date(job.created_at).toLocaleDateString(language === "es" ? "es-ES" : "en-US", { day: "2-digit", month: "short", year: "numeric" })}
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
            className={`text-[15px] text-subtitle/70 leading-relaxed font-bold transition-all duration-300 ${isExpanded ? "" : "line-clamp-3"}`}
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
            {job.attachments.map((img: any, idx: number) => (
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
  
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedService, setSelectedService] = useState<any>(null);

  const { data: asset, isLoading, isError, refetch } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsService.findOne(assetId),
    enabled: !!assetId
  });

  const statusInfo = useMemo(() => {
    if (!asset || !asset.services || asset.services.length === 0) return { status: "PENDIENTE" as const, days: 999 };
    const lastJobDate = new Date(asset.services[0].created_at);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - lastJobDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 15) return { status: "OPERATIVO" as const, days: diffDays };
    if (diffDays <= 45) return { status: "ATENCIÓN" as const, days: diffDays };
    return { status: "PENDIENTE" as const, days: diffDays };
  }, [asset]);

  const filteredJobs = useMemo(() => {
    if (!asset?.services) return [];
    let jobs = asset.services;

    if (selectedWorkers.length > 0) {
      jobs = jobs.filter(j => selectedWorkers.includes(j.worker.name));
    }

    if (datePreset) {
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      jobs = jobs.filter(j => {
        const jobDate = new Date(j.created_at);
        const diffDays = (now.getTime() - jobDate.getTime()) / oneDay;
        if (datePreset === "Hoy") return diffDays <= 1;
        if (datePreset === "Semana") return diffDays <= 7;
        if (datePreset === "Mes") return diffDays <= 30;
        if (datePreset === "Año") return diffDays <= 365;
        return true;
      });
    } else if (startDate || endDate) {
      jobs = jobs.filter(j => {
        const jobDate = new Date(j.created_at);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start && jobDate < start) return false;
        if (end && jobDate > end) return false;
        return true;
      });
    }

    return jobs;
  }, [selectedWorkers, datePreset, startDate, endDate, asset?.services]);

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
  };

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
        <p className="font-black text-subtitle/40 tracking-widest text-xs uppercase">Sincronizando bitácora...</p>
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
          <p className="font-black text-title text-xl">Recurso no disponible</p>
          <p className="text-subtitle font-medium">No pudimos cargar la información de este activo.</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="px-8 py-3 bg-title text-white rounded-2xl font-black text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* 1. HERO - Identidad Simple */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center space-x-6">
          <button onClick={() => router.back()} className="p-3.5 rounded-full bg-surface border border-border-theme/60 hover:bg-app-bg transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5 stroke-[2.5px]" />
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-title tracking-tight leading-none mb-2">{asset.name}</h1>
          </div>
        </div>
      </div>

      {/* 2. ASSET SUMMARY (Mantenimiento de Barco ARRIBA) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-surface p-8 rounded-[40px] border border-border-theme/40 shadow-soft">
        <div className="flex items-center space-x-6 lg:col-span-2 border-r border-border-theme/20 pr-6">
          <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-app-bg shadow-lg flex-shrink-0 bg-app-bg flex items-center justify-center">
            {asset.thumbnail_url ? (
              <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover" />
            ) : (
              <Ship className="w-10 h-10 text-brand/20" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em] mb-1 block">{t.assets.detail.owner}</span>
            <h4 className="text-[22px] font-black text-title leading-tight">{asset.company?.name || asset.customer?.name || "Sin asignar"}</h4>
            <div className="mt-2 flex items-center space-x-6">
              <div className="text-[12px] font-bold text-subtitle/60 flex items-center">
                 <MapPin className="w-3.5 h-3.5 text-brand mr-1.5" />
                 <span className="font-black text-title mr-1">{t.assets.table.location}:</span> {asset.location || "N/A"}
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
             {statusInfo.days === 0 
               ? t.assets.detail.today 
               : statusInfo.days > 365 
                 ? "---" 
                 : `${t.assets.pagination.of === "de" ? "Hace" : ""} ${statusInfo.days} ${t.assets.detail.days_ago}`
             }
           </span>
        </div>
      </div>

      {/* 3. SECTION TITLE */}
      <div className="flex items-center justify-between pt-4">
        <h3 className="text-[14px] font-black text-title uppercase tracking-[0.2em] flex items-center">
           <History className="w-4 h-4 mr-3 text-brand" />
           {t.assets.detail.activity_history}
        </h3>
        {(selectedWorkers.length > 0 || datePreset || startDate || endDate) && (
          <button 
            onClick={clearFilters}
            className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline"
          >
            {t.assets.detail.clear_filters}
          </button>
        )}
      </div>

      {/* 4. MAIN GRID (Timeline + Advanced Filters Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
            {filteredJobs.map((job) => (
              <JobCard 
                key={job.id} 
                job={job} 
                onClick={() => setSelectedService(job)}
              />
            ))}
            
            {filteredJobs.length === 0 && (
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
           
           <button className="w-full py-5 bg-app-bg border-2 border-dashed border-border-theme/60 rounded-[32px] text-xs font-black text-subtitle/40 uppercase tracking-[0.2em] hover:bg-app-bg/80 transition-all">
              {t.assets.detail.export_pdf}
           </button>
        </div>

      </div>

      <ServiceDrawer 
        service={selectedService} 
        onClose={() => setSelectedService(null)} 
      />
    </div>
  );
}
