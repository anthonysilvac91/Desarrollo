"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plus, X, Camera, Ship, Calendar, Check, Loader2 } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";
import { assetsService, Asset } from "@/services/assets.service";

export default function WorkerNewServicePage() {
  const router = useRouter();
  const params = useParams();
  
  const [assetName, setAssetName] = useState("Loading...");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.id) {
      assetsService.findOne(params.id as string)
        .then(a => setAssetName(a.name))
        .catch(() => setAssetName("Asset not found"));
    }
  }, [params.id]);

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

  const isFormValid = title.trim().length > 0;

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("asset_id", params.id as string);
      formData.append("is_public", "true"); // Por defecto público en mobile para visibilidad cliente
      
      images.forEach((img) => {
        formData.append("files", img.file);
      });

      await assetsService.createService(formData);
      router.back();
    } catch (err) {
      console.error("Error creating service:", err);
      alert("Error saving service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <MobileHeader title="New Service" showBack={true} />
      
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-28 flex flex-col">
        {/* Context Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
           {/* Asset Card */}
           <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50">
              <span className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest mb-1 block">Asset</span>
              <div className="flex items-center space-x-2 text-title">
                 <Ship className="w-3.5 h-3.5 text-brand" />
                 <span className="text-sm font-black truncate">{assetName}</span>
              </div>
           </div>

           {/* Date Card */}
           <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50">
              <span className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest mb-1 block">Completed</span>
              <div className="flex items-center space-x-2 text-title">
                 <Calendar className="w-3.5 h-3.5 text-brand" />
                 <span className="text-sm font-bold">
                   {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}
                 </span>
              </div>
           </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6 flex-1">
          {/* Title Input */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest ml-1">Title</span>
            <input 
              type="text"
              placeholder="What work did you perform?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface border border-border-theme/40 rounded-3xl px-6 py-4 text-base font-bold text-title placeholder:text-subtitle/30 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 hover:border-brand/20 shadow-soft transition-all"
            />
          </div>

          {/* Service Description */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest ml-1">Service</span>
            <textarea 
              placeholder="Describe the service perform..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface border border-border-theme/40 rounded-3xl p-6 min-h-[140px] text-sm font-semibold text-subtitle leading-relaxed focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 hover:border-brand/20 shadow-soft transition-all resize-none outline-none"
            />
          </div>

          {/* Photos Carousel */}
          <div>
            <h3 className="text-[11px] font-black text-subtitle/50 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>Visual Evidence</span>
              {images.length > 0 && <span className="bg-brand/10 text-brand px-2 py-0.5 rounded-full">{images.length}</span>}
            </h3>
            
            <div className="flex overflow-x-auto pb-4 -mx-5 px-5 space-x-3 custom-scroll">
               {/* Add Image Button */}
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-[90px] h-[90px] flex-shrink-0 bg-surface border-2 border-dashed border-brand/50 rounded-2xl flex flex-col items-center justify-center text-brand active:scale-95 transition-transform"
               >
                 <Camera className="w-6 h-6 mb-1 opacity-80" />
                 <span className="text-[10px] font-black uppercase">Add</span>
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

               {/* Render Selected Images */}
               {images.map((img, idx) => (
                 <div key={idx} className="w-[90px] h-[90px] flex-shrink-0 relative rounded-2xl overflow-hidden border border-border-theme/40">
                   <img src={img.url} alt="Evidencia" className="w-full h-full object-cover" />
                   <button 
                     onClick={() => removeImage(idx)}
                     className="absolute top-1 right-1 w-6 h-6 bg-app-bg/80 backdrop-blur-sm rounded-full flex items-center justify-center text-title shadow-sm"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 </div>
               ))}

               {/* Empty Slots/Placeholders */}
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
      <div className="absolute flex justify-center bottom-0 w-full p-5 bg-gradient-to-t from-app-bg via-app-bg/90 to-transparent pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <button 
          disabled={!isFormValid || isSubmitting}
          onClick={handleSubmit}
          className={`w-full flex items-center justify-center space-x-2 py-4 rounded-full font-black text-base transition-all shadow-xl bg-brand text-white shadow-brand/30 active:scale-95 disabled:opacity-50`}
        >
          {isSubmitting ? (
             <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
             <>
               <Check className="w-6 h-6 stroke-[3px]" />
               <span>Save Service</span>
             </>
          )}
        </button>
      </div>
    </>
  );
}
