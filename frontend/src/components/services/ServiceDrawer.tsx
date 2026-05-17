"use client";

import React, { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { Ship, Calendar, User, MapPin, Camera, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { Service, servicesService } from "@/services/services.service";
import ServiceAttachmentCard from "@/components/services/ServiceAttachmentCard";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/formatDate";

interface ServiceDrawerProps {
  service: Service | null;
  onClose: () => void;
}

export default function ServiceDrawer({ service, onClose }: ServiceDrawerProps) {
  const { t } = useLanguage();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
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
        <div className="p-10 pb-6 flex flex-col items-center text-center space-y-5 bg-gradient-to-b from-gray-50/50 to-white pt-24">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gray-50 flex items-center justify-center relative ring-1 ring-border-theme/20">
            {currentService.asset?.thumbnail_url ? (
              <img src={currentService.asset.thumbnail_url} alt={currentService.asset.name} className="w-full h-full object-cover" />
            ) : (
              <Ship className="w-10 h-10 text-brand/30" />
            )}
          </div>
          <div className="flex flex-col space-y-1">
            <h2 className="text-3xl font-black text-title tracking-tight">{currentService.asset?.name || "---"}</h2>
            <div className="flex items-center justify-center text-brand font-black text-sm uppercase tracking-[0.2em]">
              <MapPin className="w-3.5 h-3.5 mr-2" />
              {currentService.asset?.location || "N/A"}
            </div>
          </div>
        </div>

        <div className="px-10 py-6 grid grid-cols-2 gap-4 border-y border-gray-50">
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">{t.mobile.service_detail.worker_label}</span>
            <div className="flex items-center space-x-2">
              <User className="w-3.5 h-3.5 text-brand" />
              <span className="text-sm font-bold text-title">{currentService.worker?.name || "---"}</span>
            </div>
          </div>
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">{t.services.table.date}</span>
            <div className="flex items-center space-x-2">
              <Calendar className="w-3.5 h-3.5 text-brand" />
              <span className="text-sm font-bold text-title">{formatDate(currentService.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 space-y-6">
          <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">{t.services.drawer.report_label}</h3>
          <div className="p-6 bg-app-bg rounded-3xl border border-border-theme/40">
            <h4 className="text-lg font-black text-brand mb-3">{currentService.title}</h4>
            <p className="text-sm text-subtitle/80 leading-relaxed font-medium">
              {currentService.description}
            </p>
          </div>
        </div>

        <div className="px-10 py-8 space-y-6 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">{t.services.drawer.evidence_label}</h3>
          </div>

          {currentService.attachments && currentService.attachments.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(showAllPhotos ? currentService.attachments : currentService.attachments.slice(0, 3)).map((att, idx) => (
                  <ServiceAttachmentCard
                    key={idx}
                    attachment={att}
                    alt="Work proof"
                    size="md"
                    onImageClick={() => setSelectedImageIndex(idx)}
                  />
                ))}
              </div>
              {currentService.attachments.length > 3 && (
                <button
                  onClick={() => setShowAllPhotos(prev => !prev)}
                  className="text-xs font-black text-brand uppercase tracking-widest hover:text-brand/70 transition-colors"
                >
                  {showAllPhotos ? t.assets.detail.see_less : t.assets.detail.see_more}
                </button>
              )}
            </div>
          ) : (
            <div className="p-12 border-2 border-dashed border-border-theme/20 rounded-3xl flex flex-col items-center justify-center text-subtitle/30">
              <Camera className="w-8 h-8 mb-2 opacity-20" />
              <span className="text-xs font-bold uppercase tracking-widest">{t.services.drawer.no_photos}</span>
            </div>
          )}
        </div>

        {selectedImageIndex !== null && currentService.attachments && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-app-bg/60 backdrop-blur-2xl animate-in fade-in duration-300"
              onClick={() => setSelectedImageIndex(null)}
            />
            <button
              onClick={() => setSelectedImageIndex(null)}
              className="absolute top-12 right-6 z-110 p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all"
            >
              <X className="w-5 h-5 text-brand" />
            </button>
            {selectedImageIndex > 0 && (
              <button
                onClick={() => setSelectedImageIndex(i => (i ?? 0) - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-110 p-3 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-brand" />
              </button>
            )}
            {selectedImageIndex < currentService.attachments.length - 1 && (
              <button
                onClick={() => setSelectedImageIndex(i => (i ?? 0) + 1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-110 p-3 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all"
              >
                <ChevronRight className="w-5 h-5 text-brand" />
              </button>
            )}
            <div className="relative w-full max-w-sm aspect-square rounded-[40px] overflow-hidden border border-white/20 shadow-2xl animate-in zoom-in-95 duration-300">
              <img
                src={currentService.attachments[selectedImageIndex]?.file_url ?? ""}
                className="w-full h-full object-cover"
                alt="Preview"
              />
            </div>
            {currentService.attachments.length > 1 && (
              <div className="absolute bottom-10 left-0 right-0 flex justify-center z-110">
                <span className="text-xs font-black text-title/60 bg-surface/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border-theme/20">
                  {selectedImageIndex + 1} / {currentService.attachments.length}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
