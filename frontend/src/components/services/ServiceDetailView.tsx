"use client";

import React, { useState, useEffect } from "react";
import { usePinchZoom } from "@/hooks/usePinchZoom";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Calendar, Camera, FileText, Loader2, Info, Share2, Download } from "lucide-react";
import ShareModal from "@/components/ui/ShareModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useQuery } from "@tanstack/react-query";
import { Service, servicesService } from "@/services/services.service";
import { TranslatedDescription } from "@/components/services/TranslatedDescription";
import { useLanguage } from "@/lib/LanguageContext";
import { formatDate } from "@/lib/formatDate";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";

const DESCRIPTION_CLAMP_THRESHOLD = 160;

interface ServiceDetailViewProps {
  service: Service;
  onClose: () => void;
  hideWorker?: boolean;
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

export default function ServiceDetailView({ service, onClose, hideWorker = false }: ServiceDetailViewProps) {
  const { t, language } = useLanguage();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; text: string } | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const pinch = usePinchZoom();

  useEffect(() => {
    pinch.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImageIndex]);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["service", service.id, language],
    queryFn: () => servicesService.findOne(service.id, language),
    enabled: !!service.id,
    staleTime: 1000 * 60 * 5,
    refetchInterval: AUTO_REFETCH_INTERVALS.detail,
    ...AUTO_REFETCH_OPTIONS,
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

  const handleLightboxSwipeEnd = (x: number) => {
    if (touchStartX === null || selectedImageIndex === null) return;

    const deltaX = x - touchStartX;
    const swipeThreshold = 48;

    if (Math.abs(deltaX) < swipeThreshold) {
      setTouchStartX(null);
      return;
    }

    if (deltaX < 0 && selectedImageIndex < imageAttachments.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }

    if (deltaX > 0 && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }

    setTouchStartX(null);
  };

  const handleShareService = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const shareLink = await servicesService.getOrCreateShareLink(current.id);
      const shareUrl = `${window.location.origin}/share/services/${shareLink.token}`;
      const shareText = `${current.title} - ${formatDate(current.created_at)}\n${shareUrl}`;
      setShareData({ url: shareUrl, text: shareText });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadCurrent = async () => {
    const att = imageAttachments[selectedImageIndex ?? 0];
    if (!att?.file_url) return;
    const res = await fetch(att.file_url);
    const blob = await res.blob();
    const ext = att.file_type?.split("/")[1] || "jpg";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `foto-${(selectedImageIndex ?? 0) + 1}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDownloadAll = async () => {
    if (isDownloadingAll) return;
    setIsDownloadingAll(true);
    try {
      const items = await Promise.all(
        imageAttachments.map(async (att) => {
          if (!att.file_url) return null;
          const res = await fetch(att.file_url);
          const blob = await res.blob();
          const ext = att.file_type?.split("/")[1] || "jpg";
          return { blob, ext };
        })
      );
      const files = items
        .map((item, i) => item ? new File([item.blob], `foto-${i + 1}.${item.ext}`, { type: `image/${item.ext}` }) : null)
        .filter((f): f is File => f !== null);

      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile && navigator.canShare?.({ files })) {
        await navigator.share({ files });
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        files.forEach((file) => zip.file(file.name, file));
        const content = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(content);
        a.download = `${current.title.replace(/\s+/g, "-")}-fotos.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") console.error(error);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="flex flex-col pb-10 animate-in fade-in duration-200">

      {/* Back */}
      <div className="px-6 pt-8 pb-5 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="active:scale-90 transition-all shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-brand stroke-[2.5px]" />
            </button>
            <span className="text-[13px] font-black text-title uppercase tracking-[0.15em]">
              {t.mobile.service_detail.title}
            </span>
          </div>
          <button
            onClick={handleShareService}
            disabled={isSharing}
            className="p-2.5 rounded-full bg-brand/10 text-brand active:scale-90 transition-all disabled:opacity-50 shrink-0"
            aria-label="Compartir servicio"
          >
            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Badges: fecha + operador */}
      <div className="px-6 pb-4 lg:px-10 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-brand/10 border border-brand/15 px-3 py-1.5 rounded-full">
          <Calendar className="w-3 h-3 text-brand shrink-0" />
          <span className="text-[10px] font-black text-brand uppercase tracking-wider whitespace-nowrap">
            {formatDate(current.created_at)}
          </span>
        </div>

        {!hideWorker && current.worker && (
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
      <div className="px-6 pb-3 lg:px-10 space-y-1.5">
        <span className="block px-1 text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
          {t.mobile.new_service.title_label}
        </span>
        <div className="bg-surface rounded-2xl border border-border-theme/40 px-5 py-4">
          <h2 className="text-base font-black text-title leading-snug">{current.title}</h2>
        </div>
      </div>

      {/* Descripción */}
      <div className="px-6 pb-5 lg:px-10 space-y-1.5">
        <span className="block px-1 text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
          {t.mobile.new_service.description_label}
        </span>
        <div className="bg-surface rounded-2xl border border-border-theme/40 px-5 py-4 space-y-3">
          <TranslatedDescription
            description={current.description}
            originalDescription={current.original_description}
            isTranslated={current.is_translated}
            emptyText={t.mobile.service_detail.no_description}
            className="min-h-22 text-sm text-subtitle/70 leading-relaxed font-medium whitespace-pre-wrap"
            clampClassName={!descriptionExpanded && descriptionIsLong
              ? "overflow-hidden [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical]"
              : ""}
          />
          {descriptionIsLong && (
            <button
              onClick={() => setDescriptionExpanded(v => !v)}
              className="flex items-center gap-1 text-[10px] font-black text-brand uppercase tracking-widest hover:text-brand/70 transition-colors"
            >
              <span>{descriptionExpanded ? "Ver menos" : "Ver más"}</span>
              {descriptionExpanded
                ? <ChevronUp className="w-3 h-3 stroke-[2.5px]" />
                : <ChevronDown className="w-3 h-3 stroke-[2.5px]" />
              }
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
        <div className="absolute inset-0 z-100 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="fixed inset-0 bg-app-bg/70 backdrop-blur-2xl animate-in fade-in duration-200"
            onClick={() => setSelectedImageIndex(null)}
          />
          <div className="relative z-10 flex flex-col items-center gap-4 px-6 pt-10 pb-10 min-h-full animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="w-full max-w-sm flex items-center justify-between">
              <p className="text-lg font-black text-title">{t.mobile.service_detail.lightbox.title}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedImageIndex(null)}
                  className="p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5 text-brand" />
                </button>
              </div>
            </div>

            {/* Image with navigation */}
            <div className="relative w-full max-w-sm">
              {selectedImageIndex > 0 && (
                <button
                  onClick={() => setSelectedImageIndex(i => (i ?? 0) - 1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-110 p-3 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 text-brand" />
                </button>
              )}
              {selectedImageIndex < imageAttachments.length - 1 && (
                <button
                  onClick={() => setSelectedImageIndex(i => (i ?? 0) + 1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-110 p-3 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all"
                >
                  <ChevronRight className="w-5 h-5 text-brand" />
                </button>
              )}
              <div
                ref={pinch.ref}
                className="w-full aspect-square rounded-4xl overflow-hidden border border-white/10 shadow-2xl"
                onTouchStart={(e) => {
                  pinch.onTouchStart(e);
                  if (e.touches.length === 1 && !pinch.isZoomed) {
                    setTouchStartX(e.touches[0]?.clientX ?? null);
                  } else {
                    setTouchStartX(null);
                  }
                }}
                onTouchEnd={(e) => {
                  pinch.onTouchEnd(e);
                  if (!pinch.isZoomed) {
                    handleLightboxSwipeEnd(e.changedTouches[0]?.clientX ?? 0);
                  } else {
                    setTouchStartX(null);
                  }
                }}
                onTouchCancel={() => setTouchStartX(null)}
              >
                <img
                  src={imageAttachments[selectedImageIndex]?.file_url ?? ""}
                  className="w-full h-full object-cover"
                  style={pinch.imgStyle}
                  draggable={false}
                  alt="Evidencia"
                />
              </div>
              <button
                onClick={handleDownloadCurrent}
                className="absolute bottom-3 right-3 z-110 p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white active:scale-90 transition-all"
                aria-label="Descargar foto"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Counter */}
            {imageAttachments.length > 1 && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-black text-title/50">
                  {selectedImageIndex + 1} / {imageAttachments.length}
                </span>
                <span className="text-[10px] text-subtitle/50">{t.mobile.service_detail.lightbox.counter_hint}</span>
              </div>
            )}

            {/* Thumbnails */}
            {imageAttachments.length > 1 && (
              <div className="w-full max-w-sm overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max min-w-full justify-center gap-2 px-1">
                  {imageAttachments.map((att, index) => {
                    const isSelected = index === selectedImageIndex;
                    return (
                      <button
                        key={`${att.file_url}-${index}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        aria-label={`Ver foto ${index + 1}`}
                        aria-current={isSelected ? "true" : undefined}
                        className={`h-14 w-14 shrink-0 overflow-hidden rounded-2xl border bg-surface shadow-lg transition-all active:scale-95 ${
                          isSelected
                            ? "border-brand ring-2 ring-brand/30 opacity-100"
                            : "border-white/20 opacity-60"
                        }`}
                      >
                        <img src={att.file_url ?? ""} className="h-full w-full object-cover" alt="" loading="lazy" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {imageAttachments.length > 1 && (
              <div className="w-full max-w-sm flex justify-end">
                <button
                  onClick={() => setShowDownloadConfirm(true)}
                  disabled={isDownloadingAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface/80 backdrop-blur-sm border border-border-theme/20 shadow-lg text-xs font-black text-subtitle/70 hover:text-brand active:scale-95 transition-all disabled:opacity-50"
                >
                  {isDownloadingAll
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                    : <Download className="w-3.5 h-3.5" />
                  }
                  {isDownloadingAll ? "Descargando..." : "Descargar todo"}
                </button>
              </div>
            )}

            {/* Detail section */}
            <div className="w-full max-w-sm">
              <div className="flex items-start gap-3 bg-surface/60 backdrop-blur-sm rounded-2xl p-4 border border-border-theme/20">
                <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-3 h-3 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-title mb-1">{t.mobile.service_detail.lightbox.detail_label}</p>
                  <p className="text-xs text-subtitle leading-relaxed mb-2 whitespace-pre-wrap">
                    {current.description || t.mobile.service_detail.no_description}
                  </p>
                  <p className="text-xs text-subtitle/70 font-medium">
                    {current.worker?.name} · {formatDate(current.created_at)} · {imageAttachments.length} {imageAttachments.length === 1 ? t.mobile.service_detail.lightbox.photo : t.mobile.service_detail.lightbox.photos}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      <ShareModal
        isOpen={!!shareData}
        onClose={() => setShareData(null)}
        shareUrl={shareData?.url ?? ""}
        shareText={shareData?.text ?? ""}
        serviceTitle={current.title}
      />
      <ConfirmModal
        isOpen={showDownloadConfirm}
        onClose={() => setShowDownloadConfirm(false)}
        onConfirm={handleDownloadAll}
        title="Descargar fotos"
        description={`Se ${imageAttachments.length === 1 ? "descargará 1 foto" : `descargarán ${imageAttachments.length} fotos`} de este servicio.`}
        confirmText="Descargar"
        cancelText="Cancelar"
        variant="brand"
      />
    </div>
  );
}
