"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Calendar, User as UserIcon, Camera, Ship, X } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";

// --- MOCK DATA ---
const MOCK_JOB = {
  id: "j1",
  title: "Limpieza de Casco y Tratamiento Anti-fouling Completo",
  description: "Limpieza exterior completa del casco utilizando técnicas de hidro-presión controlada para eliminar incrustaciones calcáreas y depósitos de salitre. Se aplicó una capa de tratamiento anti-incrustante (anti-fouling) de alta calidad en todas las secciones sumergidas, asegurando una protección óptima para la próxima temporada. Durante el proceso, el equipo técnico realizó una inspección visual exhaustiva de todo el casco, verificando la ausencia de grietas, ampollas de ósmosis o cualquier signo de fatiga estructural en la línea de flotación y en la pala del timón. El acabado final fue sellado con un polímero protector UV para mantener el brillo de la obra muerta.",
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  worker: "Alex Thompson",
  asset: { id: "1", name: "Lady Nelly" },
  attachments: [
    "https://images.unsplash.com/photo-1563299284-f7486d3967a6?auto=format&fit=crop&q=80&w=600&h=600",
    "https://images.unsplash.com/photo-1589139225-33ec7c8ec19d?auto=format&fit=crop&q=80&w=600&h=600"
  ]
};

export default function WorkerJobViewPage() {
  const router = useRouter();
  const params = useParams();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const job = MOCK_JOB;

  return (
    <>
      <MobileHeader title={job.asset.name} showBack={true} />
      
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-12">
        {/* Job Details */}
        <article className="space-y-8">
           {/* Info Cards - Same style as Asset Detail / Service Drawer */}
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Responsable</span>
                <div className="flex items-center space-x-2">
                  <UserIcon className="w-3.5 h-3.5 text-brand" />
                  <span className="text-sm font-bold text-title truncate">{job.worker}</span>
                </div>
              </div>
              <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Realizado el</span>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-3.5 h-3.5 text-brand" />
                  <span className="text-sm font-bold text-title">{new Date(job.created_at).toLocaleDateString("es-ES", { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '').toUpperCase()}</span>
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
                 Evidencia Adjunta ({job.attachments.length})
               </h3>
               
               <div className="flex overflow-x-auto space-x-3 pb-2 -mx-5 px-5 no-scrollbar">
                 {job.attachments.map((url, idx) => (
                   <div 
                    key={idx} 
                    onClick={() => setSelectedImage(url)}
                    className="w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden border border-border-theme/40 bg-surface active:scale-95 transition-transform"
                   >
                     <img src={url} className="w-full h-full object-cover" alt={`Evidencia ${idx + 1}`} />
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
