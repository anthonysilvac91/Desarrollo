"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, X, Calendar, Camera, FileText, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Service, servicesService } from "@/services/services.service";
import { useLanguage } from "@/lib/LanguageContext";
import { formatDate } from "@/lib/formatDate";

const DESCRIPTION_CLAMP_THRESHOLD = 160;

interface ServiceDetailViewProps {
  service: Service;
  onClose: () => void;
}

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

function AttachmentThumb({
  attachment,
  onClick,
}: {
  attachment: { file_url?: string | null; file_type?: string };
  onClick: () => void;
}) {
  const [error, setError] = useState(false);
  const isImage = attachment.file_type?.startsWith("image/") && !error;

  if (!isImage) {
    return (
      <div className="aspect-square rounded-2xl border border-border-theme/40 bg-app-bg flex flex-col items-center justify-center gap-1.5">
        <FileText className="w-5 h-5 text-subtitle/30" />
        <span className="text-[9px] font-black uppercase tracking-wider text-subtitle/30">
          {attachment.file_type?.split("/")[1] || "archivo"}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-square rounded-2xl overflow-hidden border border-border-theme/40 active:scale-95 transition-transform group relative"
    >
      <img
        src={attachment.file_url ?? ""}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera className="w-5 h-5 text-white" />
      </div>
    </button>
  );
}

export default function ServiceDetailView({ service, onClose }: ServiceDetailViewProps) {
  const { t } = useLanguage();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["service", service.id],
    queryFn: () => servicesService.findOne(service.id),
    enabled: !!service.id,
    staleTime: 1000 * 60 * 5,
  });

  const current = detail ?? service;
  const attachments = current.attachments ?? [];
  const imageAttachments = attachments.filter(
    a => a.file_url && a.file_type?.startsWith("image/"),
  );
  const descriptionIsLong = (current.description?.length ?? 0) > DESCRIPTION_CLAMP_THRESHOLD;

  const handleImageClick = (att: { file_url?: string | null; file_type?: string }) => {
    const idx = imageAttachments.findIndex(a => a.file_url === att.file_url);
    if (idx !== -1) setSelectedImageIndex(idx);
  };

  return (
    <div className="flex flex-col pb-10 animate-in fade-in duration-200">

      {/* Back */}
      <div className="px-6 pt-8 pb-5 lg:px-10">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-subtitle/50 hover:text-brand transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5px] group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">
            {t.assets.drawer.maintenance_history}
          </span>
        </button>
      </div>

      {/* Badges: fecha + operador */}
      <div className="px-6 pb-4 lg:px-10 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-brand/10 border border-brand/15 px-3 py-1.5 rounded-full">
          <Calendar className="w-3 h-3 text-brand shrink-0" />
          <span className="text-[10px] font-black text-brand uppercase tracking-wider whitespace-nowrap">
            {formatDate(current.created_at)}
          </span>
        </div>

        {current.worker && (
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full pl-1 pr-2.5 py-1">
            <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
              <span className="text-[9px] font-black text-white">
                {getInitials(current.worker.name)}
              </span>
            </div>
            <span className="text-xs font-bold text-brand truncate max-w-24">
              {current.worker.name}
            </span>
          </div>
        )}
      </div>

      {/* Título */}
      <div className="px-6 pb-3 lg:px-10">
        <div className="bg-surface rounded-2xl border border-border-theme/40 px-5 py-4">
          <h2 className="text-base font-black text-title leading-snug">{current.title}</h2>
        </div>
      </div>

      {/* Descripción */}
      <div className="px-6 pb-5 lg:px-10">
        <div className="bg-surface rounded-2xl border border-border-theme/40 px-5 py-4 space-y-3">
          <p className={`text-sm text-subtitle/70 leading-relaxed font-medium whitespace-pre-wrap ${
            !descriptionExpanded && descriptionIsLong
              ? "overflow-hidden [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical]"
              : ""
          }`}>
            {current.description || <span className="italic text-subtitle/30">Sin descripción</span>}
          </p>
          {descriptionIsLong && (
            <button
              onClick={() => setDescriptionExpanded(v => !v)}
              className="text-[10px] font-black text-brand uppercase tracking-widest hover:text-brand/70 transition-colors"
            >
              {descriptionExpanded ? "Ver menos" : "Ver más"}
            </button>
          )}
        </div>
      </div>

      {/* Evidencia */}
      <div className="px-6 lg:px-10">
        <div className="bg-surface rounded-3xl border border-border-theme/40 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-border-theme/20 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
              {t.services.drawer.evidence_label}
            </h3>
            {attachments.length > 0 && (
              <span className="bg-brand/10 text-brand text-[10px] font-black px-2 py-0.5 rounded-full">
                {attachments.length}
              </span>
            )}
          </div>

          {isLoading && attachments.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-brand/20" />
            </div>
          ) : attachments.length > 0 ? (
            <div className="p-4 grid grid-cols-3 gap-2.5">
              {attachments.map((att, idx) => (
                <AttachmentThumb
                  key={idx}
                  attachment={att}
                  onClick={() => handleImageClick(att)}
                />
              ))}
            </div>
          ) : (
            <div className="py-10 flex flex-col items-center justify-center text-subtitle/30">
              <Camera className="w-7 h-7 mb-2 opacity-20" />
              <span className="text-xs font-bold uppercase tracking-widest">
                {t.services.drawer.no_photos}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {selectedImageIndex !== null && imageAttachments.length > 0 && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-app-bg/70 backdrop-blur-2xl animate-in fade-in duration-200"
            onClick={() => setSelectedImageIndex(null)}
          />
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-10 right-5 z-10 p-3 rounded-full bg-surface shadow-xl border border-border-theme/20 active:scale-90 transition-all"
          >
            <X className="w-5 h-5 text-brand" />
          </button>
          {selectedImageIndex > 0 && (
            <button
              onClick={() => setSelectedImageIndex(i => (i ?? 0) - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-surface shadow-xl border border-border-theme/20 active:scale-90 transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-brand" />
            </button>
          )}
          {selectedImageIndex < imageAttachments.length - 1 && (
            <button
              onClick={() => setSelectedImageIndex(i => (i ?? 0) + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-surface shadow-xl border border-border-theme/20 active:scale-90 transition-all"
            >
              <ChevronRight className="w-5 h-5 text-brand" />
            </button>
          )}
          <div className="relative w-full max-w-sm aspect-square rounded-[32px] overflow-hidden border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <img
              src={imageAttachments[selectedImageIndex]?.file_url ?? ""}
              className="w-full h-full object-cover"
              alt="Evidencia"
            />
          </div>
          {imageAttachments.length > 1 && (
            <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
              <span className="text-xs font-black text-title/50 bg-surface/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border-theme/20">
                {selectedImageIndex + 1} / {imageAttachments.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
