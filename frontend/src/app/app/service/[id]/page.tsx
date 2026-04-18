"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Calendar, User as UserIcon, Camera, Ship, X, Loader2 } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";
import { assetsService, Service } from "@/services/assets.service";

export default function WorkerServiceViewPage() {
  const router = useRouter();
  const params = useParams();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [job, setJob] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchService = async () => {
      try {
        const data = await assetsService.getService(params.id as string);
        setJob(data);
      } catch (err) {
        console.error("Error fetching service:", err);
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchService();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-app-bg text-brand">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-title font-bold text-lg">Service not found</p>
        <button onClick={() => router.back()} className="mt-4 text-brand font-black text-sm uppercase">Go Back</button>
      </div>
    );
  }

  return (
    <>
      <MobileHeader title={job.asset.name} showBack={true} />
      
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-12">
        {/* Job Details */}
        <article className="space-y-8">
           {/* Info Cards - Same style as Asset Detail / Service Drawer */}
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Worker</span>
                <div className="flex items-center space-x-2">
                  <UserIcon className="w-3.5 h-3.5 text-brand" />
                  <span className="text-sm font-bold text-title truncate">{job.worker.name}</span>
                </div>
              </div>
              <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Completed on</span>
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
                 Attached Evidence ({job.attachments.length})
               </h3>
               
               <div className="flex overflow-x-auto space-x-3 pb-2 -mx-5 px-5 no-scrollbar">
                 {job.attachments.map((att, idx) => (
                   <div 
                    key={(att as any).id || idx} 
                    onClick={() => setSelectedImage((att as any).file_url)}
                    className="w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden border border-border-theme/40 bg-surface active:scale-95 transition-transform"
                   >
                     <img src={(att as any).file_url} className="w-full h-full object-cover" alt={`Evidencia ${idx + 1}`} />
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
