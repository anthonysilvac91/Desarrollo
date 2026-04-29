"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Calendar, User as UserIcon, Camera, X, Loader2, AlertCircle } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";
import { assetsService, Service } from "@/services/assets.service";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import ServiceAttachmentCard from "@/components/services/ServiceAttachmentCard";

export default function WorkerServiceViewPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useLanguage();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
                  <span className="text-sm font-bold text-title">{new Date(job.created_at).toLocaleDateString("en-GB", { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}</span>
                </div>
              </div>
           </div>

           <div>
              <h1 className="text-2xl font-black text-title leading-tight mb-6">{job.title}</h1>

              <div className="prose prose-sm max-w-none text-subtitle/80 leading-relaxed font-medium">
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
                   <div key={(att as any).id || idx} className="flex-shrink-0">
                     <ServiceAttachmentCard
                       attachment={att}
                       alt={`Evidencia ${idx + 1}`}
                       size="md"
                       onImageClick={setSelectedImage}
                     />
                   </div>
                 ))}
               </div>
             </div>
           )}
        </article>
      </main>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
          {/* Blur Backdrop */}
          <div 
            className="absolute inset-0 bg-app-bg/60 backdrop-blur-2xl animate-in fade-in duration-300"
            onClick={() => setSelectedImage(null)}
          />
          
          {/* Close Button */}
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-12 right-6 z-[110] p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all font-black text-xs"
          >
            <X className="w-5 h-5 text-brand" />
          </button>

          {/* Large Image */}
          <div className="relative w-full max-w-sm aspect-square rounded-[40px] overflow-hidden border border-white/20 shadow-2xl animate-in zoom-in-95 duration-300">
            <img src={selectedImage} className="w-full h-full object-cover" alt="Preview" />
          </div>
        </div>
      )}
    </>
  );
}
