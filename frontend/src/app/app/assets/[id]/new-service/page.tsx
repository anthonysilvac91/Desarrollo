"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { X, Camera, Ship, Calendar, Check, Loader2, AlertCircle } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";
import { assetsService } from "@/services/assets.service";
import { useToast } from "@/lib/ToastContext";
import { useLanguage } from "@/lib/LanguageContext";

export default function WorkerNewServicePage() {
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const { t } = useLanguage();
  
  const [assetName, setAssetName] = useState("");
  const [assetError, setAssetError] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.id) {
      assetsService.findOne(params.id as string)
        .then(a => {
          setAssetName(a.name);
          setAssetError(false);
        })
        .catch(() => {
          setAssetName(t.mobile.new_service.loading_asset);
          setAssetError(true);
          showToast(t.mobile.new_service.error_asset, "error");
        });
    }
  }, [params.id, showToast, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        url: URL.createObjectURL(file),
        file
      }));
      setImages(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].url);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const isFormValid = title.trim().length > 0 && !assetError;

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("asset_id", params.id as string);
      
      images.forEach((img) => {
        formData.append("files", img.file);
      });

      await assetsService.createService(formData);
      showToast(t.mobile.new_service.success, "success");
      router.back();
    } catch (err: any) {
      console.error("Error creating service:", err);
      const serverMessage = err.response?.data?.message;
      if (serverMessage) {
        showToast(Array.isArray(serverMessage) ? serverMessage[0] : serverMessage, "error");
      } else {
        showToast(t.mobile.new_service.error_save, "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg">
      <MobileHeader title={t.mobile.new_service.header_title} showBack={true} />
      
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-28 flex flex-col">
        {/* Context Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
           {/* Asset Card */}
           <div className={`rounded-2xl p-4 border transition-all ${assetError ? "bg-error/5 border-error/20" : "bg-surface border-border-theme/20 shadow-sm"}`}>
              <span className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest mb-1 block">{t.mobile.new_service.asset_label}</span>
              <div className={`flex items-center space-x-2 ${assetError ? "text-error" : "text-title"}`}>
                 {assetError ? <AlertCircle className="w-3.5 h-3.5" /> : <Ship className="w-3.5 h-3.5 text-brand" />}
                 <span className="text-sm font-black truncate">{assetName || t.mobile.new_service.loading_asset}</span>
              </div>
           </div>

           {/* Date Card */}
           <div className="bg-surface rounded-2xl p-4 border border-border-theme/20 shadow-sm text-center sm:text-left">
              <span className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest mb-1 block">{t.mobile.new_service.date_label}</span>
              <div className="flex items-center justify-center sm:justify-start space-x-2 text-title">
                 <Calendar className="w-3.5 h-3.5 text-brand" />
                 <span className="text-sm font-bold">
                   {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                 </span>
              </div>
           </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6 flex-1">
          {/* Title Input */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest ml-1">{t.mobile.new_service.title_label}</span>
            <input 
              type="text"
              placeholder={t.mobile.new_service.title_placeholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface border border-border-theme/40 rounded-3xl px-6 py-4 text-base font-bold text-title placeholder:text-subtitle/30 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 shadow-soft transition-all disabled:opacity-50"
            />
          </div>

          {/* Service Description */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest ml-1">{t.mobile.new_service.description_label}</span>
            <textarea 
              placeholder={t.mobile.new_service.description_placeholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface border border-border-theme/40 rounded-3xl p-6 min-h-[140px] text-sm font-semibold text-subtitle leading-relaxed focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 shadow-soft transition-all resize-none outline-none disabled:opacity-50"
            />
          </div>

          {/* Photos Carousel */}
          <div>
            <h3 className="text-[11px] font-black text-subtitle/50 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>{t.mobile.new_service.evidence_label}</span>
              {images.length > 0 && <span className="bg-brand/10 text-brand px-2 py-0.5 rounded-full">{images.length}</span>}
            </h3>
            
            <div className="flex overflow-x-auto pb-4 -mx-5 px-5 space-x-3 custom-scroll">
               <button 
                  onClick={() => !isSubmitting && fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="w-[90px] h-[90px] flex-shrink-0 bg-surface border-2 border-dashed border-brand/50 rounded-2xl flex flex-col items-center justify-center text-brand active:scale-95 transition-transform disabled:opacity-30"
               >
                 <Camera className="w-6 h-6 mb-1 opacity-80" />
                 <span className="text-[10px] font-black uppercase">{t.mobile.new_service.evidence_add}</span>
                 <input 
                   type="file" 
                   accept="image/*" 
                   capture="environment" 
                   multiple 
                   className="hidden" 
                   ref={fileInputRef}
                   onChange={handleFileChange}
                 />
               </button>

               {images.map((img, idx) => (
                 <div key={idx} className="w-[90px] h-[90px] flex-shrink-0 relative rounded-2xl overflow-hidden border border-border-theme/40">
                   <img src={img.url} alt="Evidencia" className="w-full h-full object-cover" />
                   <button 
                     onClick={() => !isSubmitting && removeImage(idx)}
                     disabled={isSubmitting}
                     className="absolute top-1 right-1 w-6 h-6 bg-app-bg/80 backdrop-blur-sm rounded-full flex items-center justify-center text-title shadow-sm disabled:opacity-0"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 </div>
               ))}

               {[...Array(Math.max(0, 3 - images.length))].map((_, i) => (
                 <div 
                   key={`slot-${i}`}
                   className="w-[90px] h-[90px] flex-shrink-0 bg-surface/30 border border-dashed border-border-theme rounded-2xl flex items-center justify-center text-subtitle/20"
                 >
                   <Camera className="w-5 h-5 opacity-40" />
                 </div>
               ))}
            </div>
          </div>
        </div>
      </main>

      {/* Persistent Save Button Container */}
      <div className="fixed bottom-0 w-full p-5 bg-gradient-to-t from-app-bg via-app-bg to-transparent pb-[calc(1.25rem+env(safe-area-inset-bottom))] z-10">
        <button 
          disabled={!isFormValid || isSubmitting}
          onClick={handleSubmit}
          className={`w-full flex items-center justify-center space-x-2 py-4 rounded-full font-black text-base transition-all shadow-xl bg-brand text-white shadow-brand/30 active:scale-95 disabled:opacity-50`}
        >
          {isSubmitting ? (
             <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
             <>
               <Check className="w-6 h-6 stroke-[3px]" />
               <span>{t.mobile.new_service.save}</span>
             </>
          )}
        </button>
      </div>
    </div>
  );
}
