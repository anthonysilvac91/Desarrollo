"use client";

import React, { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Calendar, User as UserIcon, Camera, X, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";
import { assetsService, Service } from "@/services/assets.service";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import ServiceAttachmentCard from "@/components/services/ServiceAttachmentCard";
import { formatDate } from "@/lib/formatDate";

export default function WorkerServiceViewPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const { data: job, isLoading, isError, refetch } = useQuery({
    queryKey: ["service", params.id],
    queryFn: () => assetsService.getService(params.id as string),
    enabled: !!params.id
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-app-bg text-center p-10">
        <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
        <p className="text-xs font-black text-subtitle/40 uppercase tracking-widest">{t.mobile.service_detail.loading}</p>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 bg-error/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <p className="text-title font-bold text-lg">{t.mobile.service_detail.not_found}</p>
        <button onClick={() => router.back()} className="mt-2 text-brand font-black text-sm uppercase">{t.mobile.service_detail.go_back}</button>
      </div>
    );
  }

  return (
    <>
      <MobileHeader title={job.asset?.name || ""} showBack={true} />
      
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-12">
        {/* Job Details */}
        <article className="space-y-8">
           {/* Info Cards - Same style as Asset Detail / Service Drawer */}
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface rounded-2xl p-4 border border-border-theme/20 shadow-sm text-left">
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">{t.mobile.service_detail.worker_label}</span>
                <div className="flex items-center space-x-2">
                  <UserIcon className="w-3.5 h-3.5 text-brand" />
                  <span className="text-sm font-bold text-title truncate">{job.worker.name}</span>
                </div>
              </div>
              <div className="bg-surface rounded-2xl p-4 border border-border-theme/20 shadow-sm text-left">
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">{t.mobile.service_detail.date_label}</span>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-3.5 h-3.5 text-brand" />
                  <span className="text-sm font-bold text-title">{formatDate(job.created_at)}</span>
                </div>
              </div>
           </div>

           <div>
              <h1 className="text-2xl font-black text-title leading-tight mb-6">{job.title}</h1>

              <div className="prose prose-sm max-w-none text-subtitle/80 leading-relaxed font-medium whitespace-pre-wrap">
                 <p>{job.description}</p>
              </div>
           </div>

           {/* Attachments Section */}
           {job.attachments && job.attachments.length > 0 && (
             <div className="pt-6 border-t border-border-theme/20">
               <h3 className="text-[11px] font-black text-subtitle/50 uppercase tracking-widest mb-4 flex items-center">
                 <Camera className="w-4 h-4 mr-2" />
                 {t.mobile.service_detail.evidence_label} ({job.attachments.length})
               </h3>
               
               <div className="flex overflow-x-auto space-x-3 pb-2 -mx-5 px-5 no-scrollbar">
                  {job.attachments.map((att, idx) => (
                    <div key={idx} className="flex-shrink-0" onClick={() => setSelectedIndex(idx)}>
                      <ServiceAttachmentCard
                        attachment={att}
                        alt={`Evidencia ${idx + 1}`}
                        size="md"
                      />
                    </div>
                  ))}
               </div>
             </div>
           )}
        </article>
      </main>

      {/* Image Gallery Modal */}
      {selectedIndex !== null && job.attachments && (
        <div
          className="absolute inset-0 z-100 flex items-center justify-center"
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null || selectedIndex === null || !job.attachments) return;
            const delta = touchStartX.current - e.changedTouches[0].clientX;
            touchStartX.current = null;
            if (Math.abs(delta) < 40) return;
            if (delta > 0 && selectedIndex < job.attachments.length - 1) setSelectedIndex(selectedIndex + 1);
            if (delta < 0 && selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
          }}
        >
          {/* Blur Backdrop */}
          <div
            className="absolute inset-0 bg-app-bg/70 backdrop-blur-2xl animate-in fade-in duration-300"
            onClick={() => setSelectedIndex(null)}
          />

          {/* Close Button */}
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-12 right-6 z-110 p-3 rounded-full bg-surface shadow-2xl border border-border-theme/20 active:scale-90 transition-all"
          >
            <X className="w-5 h-5 text-brand" />
          </button>

          {/* Counter */}
          <div className="absolute top-14 left-0 right-0 flex justify-center z-110">
            <span className="text-xs font-black text-subtitle/60 uppercase tracking-widest">
              {selectedIndex + 1} / {job.attachments.length}
            </span>
          </div>

          {/* Image */}
          <div className="relative w-full px-16 z-105 animate-in zoom-in-95 duration-300">
            <div className="aspect-square rounded-4xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src={job.attachments[selectedIndex].file_url ?? ""}
                className="w-full h-full object-cover"
                alt={`Evidencia ${selectedIndex + 1}`}
              />
            </div>
          </div>

          {/* Left Arrow */}
          {selectedIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex - 1); }}
              className="absolute left-4 z-110 p-3 rounded-full bg-surface/80 backdrop-blur-sm shadow-xl border border-border-theme/20 active:scale-90 transition-all"
            >
              <ChevronLeft className="w-6 h-6 text-title" />
            </button>
          )}

          {/* Right Arrow */}
          {selectedIndex < job.attachments.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex + 1); }}
              className="absolute right-4 z-110 p-3 rounded-full bg-surface/80 backdrop-blur-sm shadow-xl border border-border-theme/20 active:scale-90 transition-all"
            >
              <ChevronRight className="w-6 h-6 text-title" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
