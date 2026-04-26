"use client";

import React, { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  MapPin, 
  Plus, 
  Calendar, 
  Camera, 
  Ship, 
  Briefcase, 
  Loader2, 
  AlertCircle, 
  Inbox
} from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";
import { assetsService, Service } from "@/services/assets.service";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/LanguageContext";

const AssetImage = ({ src, alt }: { src?: string; alt: string }) => {
  const [error, setError] = useState(false);

  React.useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
    return (
      <div className="w-full h-full bg-brand/5 flex items-center justify-center text-brand/30">
        <Ship className="w-12 h-12" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className="w-full h-full object-cover" 
      onError={() => setError(true)} 
    />
  );
};

const JobGallery = ({ images }: { images: string[] }) => {
  if (!images || images.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mt-4">
      {images.slice(0, 3).map((img, i) => (
        <div key={i} className="w-12 h-12 rounded-xl bg-app-bg border border-border-theme/20 flex items-center justify-center shadow-sm overflow-hidden">
           {img ? (
             <img src={img} alt="Evidence" className="w-full h-full object-cover" />
           ) : (
             <Camera className="w-5 h-5 text-subtitle opacity-30" />
           )}
        </div>
      ))}
      {images.length > 3 && (
        <div className="w-12 h-12 rounded-xl bg-surface border border-border-theme/20 flex items-center justify-center shadow-sm text-[10px] font-black text-subtitle opacity-40">
          +{images.length - 3}
        </div>
      )}
    </div>
  );
};

const JobDescription = ({ description }: { description: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const { t } = useLanguage();
  const textRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (textRef.current) {
      const el = textRef.current;
      if (el.scrollHeight > el.clientHeight) {
        setShowButton(true);
      }
    }
  }, [description]);

  return (
    <div className="mb-3">
      <p 
        ref={textRef}
        className={`text-xs font-semibold text-subtitle/70 leading-relaxed ${isExpanded ? "" : "line-clamp-3"}`}
      >
        {description}
      </p>
      {showButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="mt-2 text-[9px] font-black uppercase text-brand tracking-widest hover:opacity-70 transition-opacity"
        >
          {isExpanded ? t.assets.detail.see_less : t.assets.detail.see_more}
        </button>
      )}
    </div>
  );
};

export default function WorkerAssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = params.id as string;
  const { t } = useLanguage();

  const { data: asset, isLoading, isError, refetch } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsService.findOne(assetId),
    enabled: !!assetId
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-app-bg p-10 text-center animate-pulse">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="text-sm font-black text-subtitle/40 uppercase tracking-widest">{t.mobile.asset_detail.loading}</p>
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-app-bg p-8 text-center space-y-5">
        <div className="p-4 bg-error/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div>
          <h3 className="text-xl font-black text-title">{t.mobile.asset_detail.error_title}</h3>
          <p className="text-sm font-medium text-subtitle/60">{t.mobile.asset_detail.error_subtitle}</p>
        </div>
        <div className="w-full space-y-3">
          <button 
            onClick={() => refetch()}
            className="w-full py-4 bg-title text-white rounded-2xl font-black text-sm shadow-xl shadow-title/20"
          >
            {t.mobile.asset_detail.retry}
          </button>
          <button 
            onClick={() => router.back()}
            className="w-full py-4 text-subtitle/60 font-black text-sm uppercase tracking-widest"
          >
            {t.mobile.asset_detail.go_back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app-bg">
      <MobileHeader title={asset.name} showBack={true} />
      
      <main className="flex-1 overflow-y-auto px-5 pt-2 pb-28">
        {/* Asset Quick Summary */}
        <div className="flex flex-col items-center justify-center pt-2 pb-8">
           <div className="w-28 h-28 rounded-full bg-surface border-4 border-white shadow-xl flex items-center justify-center mb-6 overflow-hidden ring-1 ring-border-theme/20">
              <AssetImage src={asset.thumbnail_url} alt={asset.name} />
           </div>

           <div className="text-center px-4 mb-8">
              <h1 className="text-3xl font-black text-title tracking-tight mb-2">{asset.name}</h1>
              <div className="flex items-center justify-center text-[11px] font-black text-brand uppercase tracking-[0.2em]">
                  <MapPin className="w-3.5 h-3.5 mr-2" />
                  <span>{asset.location}</span>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4 w-full px-4 max-w-sm">
                <div className="bg-surface rounded-2xl p-4 border border-border-theme/20 text-left shadow-sm">
                   <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">{t.mobile.asset_detail.client_label}</span>
                   <span className="text-sm font-bold text-title truncate block">{asset.company?.name || asset.customer?.name || t.common.unassigned}</span>
                </div>
                <div className="bg-surface rounded-2xl p-4 border border-border-theme/20 text-left shadow-sm">
                  <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">{t.mobile.asset_detail.total_services}</span>
                  <div className="flex items-center space-x-2">
                    <Briefcase className="w-3.5 h-3.5 text-brand" />
                    <span className="text-sm font-bold text-title">{asset.services?.length || 0}</span>
                  </div>
                </div>
           </div>
        </div>

        {/* Timeline Header */}
        <div className="mb-8 border-b border-border-theme/10 pb-4">
           <h3 className="text-xs font-black text-title uppercase tracking-[0.3em] text-center opacity-40">{t.mobile.asset_detail.history_title}</h3>
        </div>

        {/* Timeline Cards */}
        {asset.services && asset.services.length > 0 ? (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[23px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border-theme/40 before:to-transparent">
             {asset.services.map((job) => (
               <div 
                  key={job.id} 
                  className="relative flex items-center gap-4 transition-transform active:scale-[0.98] cursor-pointer"
                  onClick={() => router.push(`/app/service/${job.id}`)}
               >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-app-bg bg-brand/10 text-brand shadow-sm z-10 flex-shrink-0">
                     <div className="w-3 h-3 bg-brand rounded-full"></div>
                  </div>

                  <div className="w-[calc(100%-4rem)] p-5 rounded-2xl bg-surface border border-border-theme/40 shadow-sm">
                     <div className="flex items-center bg-brand/5 rounded-full px-3 py-1 w-fit mb-3 border border-brand/5">
                        <Calendar className="w-3 h-3 mr-2 text-brand" />
                        <span className="text-[10px] font-black uppercase text-brand tracking-widest">
                           {new Date(job.created_at).toLocaleDateString("es-ES", { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                     </div>

                     <h4 className="text-lg font-bold text-title mb-1 leading-tight">{job.title}</h4>
                      
                     <JobDescription description={job.description || ""} />

                     <JobGallery images={job.attachments?.map(a => a.file_url) || []} />
                  </div>
               </div>
             ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-surface/30 rounded-[32px] border-2 border-dashed border-border-theme/10">
            <Inbox className="w-10 h-10 text-subtitle/20 mx-auto mb-4" />
            <p className="text-sm font-black text-subtitle/40 uppercase tracking-widest">{t.mobile.asset_detail.no_history_title}</p>
          </div>
        )}
      </main>

      {/* FAB - Fixed Bottom Area */}
      <div className="fixed bottom-0 w-full p-5 bg-gradient-to-t from-app-bg via-app-bg to-transparent pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <button 
          onClick={() => router.push(`/app/assets/${asset.id}/new-service`)}
          className="w-full flex items-center justify-center space-x-2 bg-brand text-white py-4 rounded-full font-black text-base shadow-xl shadow-brand/30 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6 stroke-[3px]" />
          <span>{t.mobile.asset_detail.add_service}</span>
        </button>
      </div>
    </div>
  );
}
