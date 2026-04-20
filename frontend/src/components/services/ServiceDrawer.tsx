"use client";

import React from "react";
import Drawer from "@/components/ui/Drawer";
import { Ship, Calendar, User, MapPin, Camera } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

import { Service } from "@/services/services.service";

interface ServiceDrawerProps {
  service: Service | null;
  onClose: () => void;
}

export default function ServiceDrawer({ service, onClose }: ServiceDrawerProps) {
  const { t } = useLanguage();

  if (!service) return <Drawer isOpen={false} onClose={onClose}><div /></Drawer>;

  return (
    <Drawer isOpen={!!service} onClose={onClose}>
      <div className="flex flex-col min-h-full">
        
        {/* Header Section */}
        <div className="p-10 pb-8 flex flex-col items-center text-center space-y-5 bg-gradient-to-b from-gray-50/50 to-white pt-24 border-b border-gray-50">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gray-50 flex items-center justify-center relative ring-1 ring-border-theme/20">
            <div className="w-full h-full bg-brand/5 flex items-center justify-center text-brand/30">
              <Ship className="w-10 h-10" />
            </div>
          </div>
          <div className="flex flex-col space-y-1">
            <h2 className="text-3xl font-black text-title tracking-tight">{service.asset?.name || "---"}</h2>
            <div className="flex items-center justify-center text-brand font-black text-sm uppercase tracking-[0.2em]">
              <MapPin className="w-3.5 h-3.5 mr-2" />
              {service.asset?.location || "N/A"}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="px-10 py-6 grid grid-cols-2 gap-4 border-b border-gray-50">
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Responsable</span>
            <div className="flex items-center space-x-2">
              <User className="w-3.5 h-3.5 text-brand" />
              <span className="text-sm font-bold text-title">{service.worker?.name || "---"}</span>
            </div>
          </div>
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Realizado el</span>
            <div className="flex items-center space-x-2">
              <Calendar className="w-3.5 h-3.5 text-brand" />
              <span className="text-sm font-bold text-title">{new Date(service.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Work Description */}
        <div className="px-10 py-8 space-y-4">
          <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">Reporte de Trabajo</h3>
          <div className="p-6 bg-app-bg rounded-3xl border border-border-theme/40">
            <h4 className="text-lg font-black text-brand mb-3">{service.title}</h4>
            <p className="text-sm text-subtitle/80 leading-relaxed font-medium">
              {service.description}
            </p>
          </div>
        </div>

        {/* Photos Gallery */}
        <div className="px-10 py-4 space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">Evidencia Visual</h3>
          </div>
          
          {service.attachments && service.attachments.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {service.attachments.map((att, idx) => (
                <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-border-theme/20 shadow-sm hover:scale-[1.02] transition-transform group relative cursor-pointer">
                  <img src={att.file_url} alt="Work proof" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 border-2 border-dashed border-border-theme/20 rounded-3xl flex flex-col items-center justify-center text-subtitle/30">
              <Camera className="w-8 h-8 mb-2 opacity-20" />
              <span className="text-xs font-bold uppercase tracking-widest">Sin fotos adjuntas</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-10 pt-4">
          <button 
            onClick={onClose}
            className="w-full py-4 text-sm font-black text-title border-2 border-border-theme/40 hover:bg-app-bg rounded-2xl transition-all active:scale-[0.98]"
          >
            Cerrar Reporte
          </button>
        </div>

      </div>
    </Drawer>
  );
}
