"use client";

import React, { useState, useEffect } from "react";
import { usePinchZoom } from "@/hooks/usePinchZoom";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Calendar, Camera, FileText, FileSpreadsheet, Loader2, Info, Share2, Download, Eye, Play, Video } from "lucide-react";
import ShareModal from "@/components/ui/ShareModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useQuery } from "@tanstack/react-query";
import { Service, servicesService } from "@/services/services.service";
import { useToast } from "@/lib/ToastContext";
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

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return null;
  const mm = Math.floor(seconds / 60);
  const ss = Math.round(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function VideoThumb({
  attachment,
  onClick,
  isLoading,
}: {
  attachment: { thumbnail_url?: string | null; duration_seconds?: number | null };
  onClick: () => void;
  isLoading?: boolean;
}) {
  const [error, setError] = useState(false);
  const hasThumbnail = !!attachment.thumbnail_url && !error;
  const duration = formatDuration(attachment.duration_seconds);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="aspect-square rounded-2xl overflow-hidden border border-border-theme/40 active:scale-95 transition-transform group relative bg-title/80 disabled:opacity-60"
    >
      {hasThumbnail ? (
        <img
          src={attachment.thumbnail_url ?? ""}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-title/90 to-title/70">
          <Video className="w-6 h-6 text-white/30" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 text-title fill-title ml-0.5" />
          </div>
        )}
      </div>
      {duration && (
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold tracking-wide">
          {duration}
        </span>
      )}
    </button>
  );
}

function getDocIcon(mime: string | undefined) {
  if (mime === "application/pdf") return { Icon: FileText, color: "text-red-500" };
  if (mime?.includes("spreadsheet") || mime?.includes("ms-excel")) return { Icon: FileSpreadsheet, color: "text-green-600" };
  if (mime?.includes("word") || mime?.includes("msword")) return { Icon: FileText, color: "text-blue-500" };
  return { Icon: FileText, color: "text-subtitle/50" };
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentUploadSummary({ service }: { service: Service }) {
  const { t } = useLanguage();
  const summary = service.attachmentUploadSummary;
  const pending = service.pendingAttachments ?? [];
  if (!summary || summary.status === "NONE" || summary.status === "READY") return null;
  const total = Math.max(summary.expected, 1);
  const percent = Math.round((summary.ready / total) * 100);

  return (
    <div className="px-6 pb-5 lg:px-10">
      <div className="rounded-2xl border border-border-theme/40 bg-surface px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-title">{t.mobile.upload_queue.service_files}</p>
            <p className="text-xs font-semibold text-subtitle/50">
              {t.mobile.upload_queue.available_count
                .replace("{ready}", String(summary.ready))
                .replace("{expected}", String(summary.expected))}
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">
            {summary.status === "FAILED" ? t.mobile.upload_queue.status_failed : t.mobile.upload_queue.status_loading}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-app-bg">
          <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
        </div>
        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.map((item) => (
              <div key={item.uploadId} className="flex items-center justify-between gap-3 rounded-xl bg-app-bg/60 px-3 py-2">
                <p className="min-w-0 truncate text-xs font-bold text-title">{item.name}</p>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-subtitle/50">
                  {item.status === "FAILED" || item.status === "EXPIRED" ? "Error" : `${item.progress}%`}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] font-semibold text-subtitle/50">
          {t.mobile.upload_queue.continues_open}
        </p>
      </div>
    </div>
  );
}

export default function ServiceDetailView({ service, onClose, hideWorker = false }: ServiceDetailViewProps) {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [mediaTab, setMediaTab] = useState<"all" | "photos" | "videos">("all");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; text: string } | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [videoPlayback, setVideoPlayback] = useState<{ id: string; url?: string; embedUrl?: string } | null>(null);
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null);
  const [cfDownload, setCfDownload] = useState<{ status: string; url: string | null } | null>(null);
  const [isRequestingDownload, setIsRequestingDownload] = useState(false);
  const pinch = usePinchZoom();

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
  const videoAttachments = attachments.filter(
    a => a.media_type === "VIDEO" || a.file_type?.startsWith("video/"),
  );
  const documentAttachments = attachments.filter(
    a => a.file_type && !a.file_type.startsWith("image/") && !a.file_type.startsWith("video/"),
  );
  const mediaAttachments = attachments.filter(a => imageAttachments.includes(a) || videoAttachments.includes(a));
  const visibleMediaAttachments =
    mediaTab === "photos" ? imageAttachments : mediaTab === "videos" ? videoAttachments : mediaAttachments;
  const descriptionIsLong = (current.description?.length ?? 0) > DESCRIPTION_CLAMP_THRESHOLD;
  const selectedMedia = selectedMediaIndex !== null ? mediaAttachments[selectedMediaIndex] : null;
  const selectedIsVideo =
    !!selectedMedia && (selectedMedia.media_type === "VIDEO" || selectedMedia.file_type?.startsWith("video/"));

  useEffect(() => {
    pinch.reset();
    setCfDownload(null);
    if (selectedIsVideo && selectedMedia?.id) {
      const attId = selectedMedia.id;
      setVideoPlayback(null);
      setLoadingVideoId(attId);
      servicesService.getVideoPlaybackUrl(current.id, attId)
        .then((data) => setVideoPlayback({ id: attId, url: data.url, embedUrl: data.embedUrl }))
        .catch(() => showToast(t.feedback.generic_error, "error"))
        .finally(() => setLoadingVideoId((prev) => (prev === attId ? null : prev)));
    } else {
      setVideoPlayback(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMediaIndex]);

  const handleMediaClick = (att: (typeof mediaAttachments)[number]) => {
    const idx = mediaAttachments.indexOf(att);
    if (idx !== -1) setSelectedMediaIndex(idx);
  };

  const handleLightboxSwipeEnd = (x: number) => {
    if (touchStartX === null || selectedMediaIndex === null) return;

    const deltaX = x - touchStartX;
    const swipeThreshold = 48;

    if (Math.abs(deltaX) < swipeThreshold) {
      setTouchStartX(null);
      return;
    }

    if (deltaX < 0 && selectedMediaIndex < mediaAttachments.length - 1) {
      setSelectedMediaIndex(selectedMediaIndex + 1);
    }

    if (deltaX > 0 && selectedMediaIndex > 0) {
      setSelectedMediaIndex(selectedMediaIndex - 1);
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
    const att = mediaAttachments[selectedMediaIndex ?? 0];
    const isVideo = att?.media_type === "VIDEO" || att?.file_type?.startsWith("video/");
    // El video solo es descargable en el path directo (sin Cloudflare Stream),
    // donde getVideoPlaybackUrl devuelve un `url` de archivo real en vez de un
    // `embedUrl` de streaming.
    const sourceUrl = isVideo ? (videoPlayback?.embedUrl ? null : videoPlayback?.url) : att?.file_url;
    if (!sourceUrl) return;
    const res = await fetch(sourceUrl);
    const blob = await res.blob();
    const ext = att.file_type?.split("/")[1] || (isVideo ? "mp4" : "jpg");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${isVideo ? "video" : "foto"}-${(selectedMediaIndex ?? 0) + 1}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleRequestCfDownload = async () => {
    if (!selectedMedia?.id || isRequestingDownload) return;
    setIsRequestingDownload(true);
    try {
      const data = await servicesService.getVideoDownloadUrl(current.id, selectedMedia.id);
      setCfDownload(data);
      if (data.status === "ready" && data.url) {
        // Descarga directa vía navegación del navegador: la URL es de
        // Cloudflare (cross-origin), así que fetch+blob chocaría con CORS.
        const a = document.createElement("a");
        a.href = data.url;
        a.download = `video-${(selectedMediaIndex ?? 0) + 1}.mp4`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      } else if (data.status === "inprogress") {
        showToast(t.common.video_download_preparing, "success");
      } else if (data.status === "error") {
        showToast(t.feedback.generic_error, "error");
      }
    } catch {
      showToast(t.feedback.generic_error, "error");
    } finally {
      setIsRequestingDownload(false);
    }
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

  const handlePdfPreview = async (att: { id?: string; file_name?: string | null }) => {
    if (!att.id || isPdfLoading) return;
    setIsPdfLoading(true);
    try {
      const { url } = await servicesService.getAttachmentDownloadUrl(current.id, att.id);
      // Open the direct URL instead of embedding it in an <iframe> via a blob:
      // WebKit's inline PDF viewer only renders the first page for iframe/blob
      // sources on iOS. Opening it directly hands off to the full native PDF
      // viewer (all pages, search, zoom) on every platform.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      showToast(t.feedback.generic_error, "error");
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleDocumentDownload = async (att: { id?: string; file_name?: string | null; file_type?: string }) => {
    if (!att.id) return;
    try {
      const { url, file_name } = await servicesService.getAttachmentDownloadUrl(current.id, att.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = file_name || "document";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    } catch {
      showToast(t.feedback.generic_error, "error");
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
        <div className="bg-surface rounded-2xl border border-border-theme/40 px-5 py-4 space-y-2">
          <TranslatedDescription
            description={current.title}
            originalDescription={current.original_title}
            isTranslated={current.is_title_translated}
            emptyText=""
            className="text-base font-black text-title leading-snug"
          />
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

      <AttachmentUploadSummary service={current} />

      {/* Media evidence (fotos + videos) */}
      <div className="px-6 lg:px-10">
        <div className="bg-surface rounded-3xl border border-border-theme/40 overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
              {t.services.drawer.evidence_label}
            </h3>
            {mediaAttachments.length > 0 && (
              <span className="bg-brand/10 text-brand text-[10px] font-black px-2 py-0.5 rounded-full">
                {mediaAttachments.length}
              </span>
            )}
          </div>

          {videoAttachments.length > 0 && (
            <div className="px-5 pb-3 flex items-center gap-1.5">
              {([
                ["all", t.services.drawer.tab_all, mediaAttachments.length],
                ["photos", t.services.drawer.tab_photos, imageAttachments.length],
                ["videos", t.services.drawer.tab_videos, videoAttachments.length],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMediaTab(key)}
                  className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-black transition-colors ${
                    mediaTab === key
                      ? "bg-brand text-white"
                      : "bg-app-bg text-subtitle/60 hover:text-title"
                  }`}
                >
                  {label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      mediaTab === key ? "bg-white/20" : "bg-title/5"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border-theme/20">
            {isLoading && attachments.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-brand/20" />
              </div>
            ) : visibleMediaAttachments.length > 0 ? (
              <div className="p-4 grid grid-cols-3 gap-2.5">
                {visibleMediaAttachments.map((att, idx) => {
                  const isVideo = att.media_type === "VIDEO" || att.file_type?.startsWith("video/");
                  if (isVideo) {
                    return (
                      <VideoThumb
                        key={att.id ?? idx}
                        attachment={att}
                        isLoading={loadingVideoId === att.id}
                        onClick={() => handleMediaClick(att)}
                      />
                    );
                  }
                  return (
                    <AttachmentThumb key={att.id ?? idx} attachment={att} onClick={() => handleMediaClick(att)} />
                  );
                })}
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
      </div>

      {/* Documentos adjuntos */}
      {documentAttachments.length > 0 && (
        <div className="px-6 lg:px-10 mt-4">
          <div className="bg-surface rounded-3xl border border-border-theme/40 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-border-theme/20 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
                {t.services.drawer.documents_label}
              </h3>
              <span className="bg-brand/10 text-brand text-[10px] font-black px-2 py-0.5 rounded-full">
                {documentAttachments.length}
              </span>
            </div>
            <div className="p-4 space-y-2">
              {documentAttachments.map((doc) => {
                const { Icon, color } = getDocIcon(doc.file_type);
                const isPdf = doc.file_type === "application/pdf";
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-app-bg/60 border border-border-theme/30">
                    <Icon className={`w-5 h-5 ${color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-title truncate">{doc.file_name || "Document"}</p>
                      {doc.file_size_bytes != null && (
                        <p className="text-[10px] text-subtitle/50 font-medium">{formatBytes(doc.file_size_bytes)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isPdf && (
                        <button
                          onClick={() => handlePdfPreview(doc)}
                          className="p-2 rounded-full bg-brand/10 text-brand hover:bg-brand/20 active:scale-90 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDocumentDownload(doc)}
                        className="p-2 rounded-full bg-brand/10 text-brand hover:bg-brand/20 active:scale-90 transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selectedMediaIndex !== null && selectedMedia && (
        <div className="absolute inset-0 z-100 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="fixed inset-0 bg-app-bg/70 backdrop-blur-2xl animate-in fade-in duration-200"
            onClick={() => setSelectedMediaIndex(null)}
          />
          <div className="relative z-10 flex flex-col items-center gap-4 px-6 pt-10 pb-10 min-h-full animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="w-full max-w-sm flex items-center justify-between">
              <p className="text-lg font-black text-title">{t.mobile.service_detail.lightbox.title}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedMediaIndex(null)}
                  className="p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5 text-brand" />
                </button>
              </div>
            </div>

            {/* Media with navigation */}
            <div className="relative w-full max-w-sm">
              {selectedIsVideo ? (
                <>
                  <div className="w-full rounded-4xl overflow-hidden border border-white/10 shadow-2xl bg-title flex items-center justify-center min-h-64">
                    {loadingVideoId === selectedMedia.id || !videoPlayback || videoPlayback.id !== selectedMedia.id ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin my-16" />
                    ) : videoPlayback.embedUrl ? (
                      <iframe
                        src={videoPlayback.embedUrl}
                        className="aspect-video w-full bg-black"
                        style={{ border: "none" }}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={videoPlayback.url}
                        controls
                        autoPlay
                        preload="metadata"
                        className="max-h-[70vh] w-full object-contain bg-black"
                      />
                    )}
                  </div>
                  {videoPlayback && videoPlayback.id === selectedMedia.id && (
                    videoPlayback.embedUrl ? (
                      <button
                        onClick={handleRequestCfDownload}
                        disabled={isRequestingDownload}
                        className="absolute bottom-3 right-3 z-110 p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white active:scale-90 transition-all disabled:opacity-50"
                        aria-label={t.common.download}
                      >
                        {isRequestingDownload
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Download className="w-4 h-4" />
                        }
                      </button>
                    ) : videoPlayback.url ? (
                      <button
                        onClick={handleDownloadCurrent}
                        className="absolute bottom-3 right-3 z-110 p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white active:scale-90 transition-all"
                        aria-label={t.common.download}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    ) : null
                  )}
                </>
              ) : (
                <>
                  <div
                    ref={pinch.ref}
                    className="w-full aspect-square rounded-4xl overflow-hidden border border-white/10 shadow-2xl"
                    onMouseDown={pinch.onMouseDown}
                    onDoubleClick={pinch.onDoubleClick}
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
                      src={selectedMedia.file_url ?? ""}
                      className="w-full h-full object-cover"
                      style={pinch.imgStyle}
                      draggable={false}
                      alt="Evidencia"
                    />
                  </div>
                  <button
                    onClick={handleDownloadCurrent}
                    className="absolute bottom-3 right-3 z-110 p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white active:scale-90 transition-all"
                    aria-label={t.common.download_photo}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Counter */}
            {mediaAttachments.length > 1 && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-black text-title/50">
                  {selectedMediaIndex + 1} / {mediaAttachments.length}
                </span>
                <span className="text-[10px] text-subtitle/50">{t.mobile.service_detail.lightbox.counter_hint}</span>
              </div>
            )}

            {/* Thumbnails */}
            {mediaAttachments.length > 1 && (
              <div className="w-full max-w-sm flex items-center gap-2">
                <button
                  onClick={() => setSelectedMediaIndex(i => (i ?? 0) - 1)}
                  disabled={selectedMediaIndex === 0}
                  className="shrink-0 p-2 rounded-full bg-surface shadow-lg border border-border-theme/20 text-title active:scale-90 transition-all disabled:opacity-30"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-brand" />
                </button>
                <div className="flex-1 min-w-0 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-max min-w-full justify-center gap-2 px-1">
                    {mediaAttachments.map((att, index) => {
                      const isSelected = index === selectedMediaIndex;
                      const isVideo = att.media_type === "VIDEO" || att.file_type?.startsWith("video/");
                      return (
                        <button
                          key={att.id ?? index}
                          type="button"
                          onClick={() => setSelectedMediaIndex(index)}
                          aria-label={`Ver adjunto ${index + 1}`}
                          aria-current={isSelected ? "true" : undefined}
                          className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border bg-surface shadow-lg transition-all active:scale-95 ${
                            isSelected
                              ? "border-brand ring-2 ring-brand/30 opacity-100"
                              : "border-white/20 opacity-60"
                          }`}
                        >
                          <img src={att.thumbnail_url ?? att.file_url ?? ""} className="h-full w-full object-cover" alt="" loading="lazy" />
                          {isVideo && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                                <Play className="w-2.5 h-2.5 text-title fill-title ml-0.5" />
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMediaIndex(i => (i ?? 0) + 1)}
                  disabled={selectedMediaIndex === mediaAttachments.length - 1}
                  className="shrink-0 p-2 rounded-full bg-surface shadow-lg border border-border-theme/20 text-title active:scale-90 transition-all disabled:opacity-30"
                  aria-label="Siguiente"
                >
                  <ChevronRight className="w-4 h-4 text-brand" />
                </button>
              </div>
            )}

            {imageAttachments.length > 1 && !selectedIsVideo && (
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
                  {isDownloadingAll ? t.common.downloading : t.common.download_all}
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
                    {current.worker?.name} · {formatDate(current.created_at)}
                    {!selectedIsVideo && (
                      <> · {imageAttachments.length} {imageAttachments.length === 1 ? t.mobile.service_detail.lightbox.photo : t.mobile.service_detail.lightbox.photos}</>
                    )}
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
        title={t.common.download_photos_title}
        description={t.common.download_photos_description.replace("{count}", String(imageAttachments.length))}
        confirmText={t.common.download}
        cancelText={t.common.cancel}
        variant="brand"
      />
    </div>
  );
}
