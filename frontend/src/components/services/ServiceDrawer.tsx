"use client";

import React, { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { Ship, Calendar, User, MapPin, Camera, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { Service, servicesService } from "@/services/services.service";
import ServiceAttachmentCard from "@/components/services/ServiceAttachmentCard";
import { useQuery } from "@tanstack/react-query";

interface ServiceDrawerProps {
  service: Service | null;
  onClose: () => void;
}

export default function ServiceDrawer({ service, onClose }: ServiceDrawerProps) {
  const { t } = useLanguage();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { data: detail } = useQuery({
    queryKey: ["service", service?.id],
    queryFn: () => servicesService.findOne(service!.id),
    enabled: !!service?.id,
  });

  if (!service) return <Drawer isOpen={false} onClose={onClose}><div /></Drawer>;
  const currentService = detail || service;

  return (
    <Drawer isOpen={!!service} onClose={onClose}>
      <div className="flex flex-col min-h-full">
        <div className="p-10 pb-8 flex flex-col items-center text-center space-y-5 bg-gradient-to-b from-gray-50/50 to-white pt-24 border-b border-gray-50">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gray-50 flex items-center justify-center relative ring-1 ring-border-theme/20">
            <div className="w-full h-full bg-brand/5 flex items-center justify-center text-brand/30">
              <Ship className="w-10 h-10" />
            </div>
          </div>
          <div className="flex flex-col space-y-1">
            <h2 className="text-3xl font-black text-title tracking-tight">{currentService.asset?.name || "---"}</h2>
            <div className="flex items-center justify-center text-brand font-black text-sm uppercase tracking-[0.2em]">
              <MapPin className="w-3.5 h-3.5 mr-2" />
              {currentService.asset?.location || "N/A"}
            </div>
          </div>
        </div>

        <div className="px-10 py-6 grid grid-cols-2 gap-4 border-b border-gray-50">
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Responsable</span>
            <div className="flex items-center space-x-2">
              <User className="w-3.5 h-3.5 text-brand" />
              <span className="text-sm font-bold text-title">{currentService.worker?.name || "---"}</span>
            </div>
          </div>
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Realizado el</span>
            <div className="flex items-center space-x-2">
              <Calendar className="w-3.5 h-3.5 text-brand" />
              <span className="text-sm font-bold text-title">{new Date(currentService.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 space-y-4">
          <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">Reporte de Trabajo</h3>
          <div className="p-6 bg-app-bg rounded-3xl border border-border-theme/40">
            <h4 className="text-lg font-black text-brand mb-3">{currentService.title}</h4>
            <p className="text-sm text-subtitle/80 leading-relaxed font-medium">
              {currentService.description}
            </p>
          </div>
        </div>

        <div className="px-10 py-4 space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">Evidencia Visual</h3>
          </div>

          {currentService.attachments && currentService.attachments.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {currentService.attachments.map((att, idx) => (
                <ServiceAttachmentCard
                  key={idx}
                  attachment={att}
                  alt="Work proof"
                  size="lg"
                  onImageClick={setSelectedImage}
                />
              ))}
            </div>
          ) : (
            <div className="p-12 border-2 border-dashed border-border-theme/20 rounded-3xl flex flex-col items-center justify-center text-subtitle/30">
              <Camera className="w-8 h-8 mb-2 opacity-20" />
              <span className="text-xs font-bold uppercase tracking-widest">Sin fotos adjuntas</span>
            </div>
          )}
        </div>

        <div className="p-10 pt-4">
          <button
            onClick={onClose}
            className="w-full py-4 text-sm font-black text-title border-2 border-border-theme/40 hover:bg-app-bg rounded-2xl transition-all active:scale-[0.98]"
          >
            Cerrar Reporte
          </button>
        </div>

        {selectedImage && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-app-bg/60 backdrop-blur-2xl animate-in fade-in duration-300"
              onClick={() => setSelectedImage(null)}
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-12 right-6 z-[110] p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all font-black text-xs"
            >
              <X className="w-5 h-5 text-brand" />
            </button>
            <div className="relative w-full max-w-sm aspect-square rounded-[40px] overflow-hidden border border-white/20 shadow-2xl animate-in zoom-in-95 duration-300">
              <img src={selectedImage} className="w-full h-full object-cover" alt="Preview" />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
