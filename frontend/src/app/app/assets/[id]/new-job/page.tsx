"use client";

import React, { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plus, X, Camera, Ship } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";

export default function WorkerNewJobPage() {
  const router = useRouter();
  const params = useParams();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        url: URL.createObjectURL(file),
        file
      }));
      setImages(prev => [...prev, ...newFiles]);
    }
    // reset input so the same file could be picked again if removed
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
    if (!isFormValid) return;
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      // Navigate back to listing after success
      router.back();
    }, 1500);
  };

  return (
    <>
      <MobileHeader title="Nuevo Trabajo" showBack={true} />
      
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-28 flex flex-col">
        {/* Context / Asset Ref */}
        <div className="flex items-center space-x-3 mb-6 opacity-60">
           <div className="w-8 h-8 rounded-lg bg-surface border border-border-theme/40 flex items-center justify-center">
              <Ship className="w-4 h-4 text-brand" />
           </div>
           <div>
             <span className="text-[10px] font-black uppercase tracking-widest block">Activo</span>
             <span className="text-sm font-bold text-title">Lady Nelly</span>
           </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6 flex-1">
          {/* Title */}
          <div>
            <input 
              type="text"
              placeholder="¿Qué trabajo realizaste?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-b-2 border-border-theme/40 focus:border-brand py-3 text-xl font-bold text-title placeholder:text-subtitle/30 focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <textarea 
              placeholder="Añade detalles sobre el servicio (opcional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface border border-border-theme/40 rounded-3xl p-4 min-h-[140px] text-sm font-semibold text-subtitle leading-relaxed focus:border-brand focus:ring-4 ring-brand/10 transition-all resize-none outline-none"
            />
          </div>

          {/* Photos Carousel */}
          <div>
            <h3 className="text-[11px] font-black text-subtitle/50 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>Evidencia Visual</span>
              {images.length > 0 && <span className="bg-brand/10 text-brand px-2 py-0.5 rounded-full">{images.length}</span>}
            </h3>
            
            <div className="flex overflow-x-auto pb-4 -mx-5 px-5 space-x-3 custom-scroll">
               {/* Add Image Button */}
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-[90px] h-[90px] flex-shrink-0 bg-surface border-2 border-dashed border-brand/50 rounded-2xl flex flex-col items-center justify-center text-brand active:scale-95 transition-transform"
               >
                 <Camera className="w-6 h-6 mb-1 opacity-80" />
                 <span className="text-[10px] font-black uppercase">Añadir</span>
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
            </div>
          </div>
        </div>
      </main>

      {/* Persistent Save Button Container */}
      <div className="absolute flex justify-center bottom-0 w-full p-5 bg-gradient-to-t from-app-bg via-app-bg/90 to-transparent pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <button 
          disabled={!isFormValid || isSubmitting}
          onClick={handleSubmit}
          className={`w-full flex items-center justify-center space-x-2 py-4 rounded-full font-black text-base transition-all shadow-xl ${
            isFormValid 
              ? "bg-brand text-white shadow-brand/30 active:scale-95" 
              : "bg-surface text-subtitle/30 shadow-none border border-border-theme/40"
          }`}
        >
          {isSubmitting ? (
             <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
             <span>Guardar Trabajo</span>
          )}
        </button>
      </div>
    </>
  );
}
