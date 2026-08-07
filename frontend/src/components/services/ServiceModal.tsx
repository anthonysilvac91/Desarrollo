"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Loader2, FileText, FileSpreadsheet, Package, Layers,
  Image as ImageIcon, Video, Paperclip, UploadCloud, Inbox, Lightbulb,
} from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { servicesService } from "@/services/services.service";
import { Asset, assetsService } from "@/services/assets.service";
import { SERVICE_IMAGE_MAX_BYTES, compressImageFile } from "@/lib/imageCompression";
import { uploadService } from "@/services/uploadService";
import { useUploadQueue } from "@/providers/UploadQueueProvider";
import { AttachmentConfig } from "@/types/uploads";

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 400;
const MAX_PHOTOS = 20;
const MAX_DOCUMENTS = 10;
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx";
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

type EvidenceTab = "images" | "videos" | "documents";

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function getDocIcon(name: string) {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return { Icon: FileText, color: "text-red-500" };
  if (ext === "xls" || ext === "xlsx") return { Icon: FileSpreadsheet, color: "text-green-600" };
  return { Icon: FileText, color: "text-blue-500" };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ServiceModal({ isOpen, onClose, onSuccess }: ServiceModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { enqueueVideos } = useUploadQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [attachmentConfig, setAttachmentConfig] = useState<AttachmentConfig | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [activeTab, setActiveTab] = useState<EvidenceTab>("images");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    uploadService.getAttachmentConfig()
      .then(setAttachmentConfig)
      .catch(() => setAttachmentConfig(null));
  }, [isOpen]);

  const { data: assetsData = [], isLoading: isLoadingAssets } = useQuery<Asset[] | { data: Asset[] }>({
    queryKey: ["assets"],
    queryFn: () => assetsService.findAll(),
    enabled: isOpen,
  });

  const assets = Array.isArray(assetsData) ? assetsData : assetsData.data || [];
  const hasNoAssets = isOpen && !isLoadingAssets && assets.length === 0;

  const resetForm = () => {
    setAssetId("");
    setTitle("");
    setDescription("");
    setImages([]);
    setDocuments([]);
    setVideos([]);
    setActiveTab("images");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleGoToAssets = () => {
    handleClose();
    router.push("/assets");
  };

  const processImageFiles = async (fileArray: File[]) => {
    if (!fileArray.length) return;
    const remaining = MAX_PHOTOS - images.length;
    const toProcess = fileArray.slice(0, remaining);
    if (!toProcess.length) return;

    setIsProcessingImages(true);
    try {
      const compressed = await Promise.all(
        toProcess.map((file, i) =>
          compressImageFile(file, {
            maxDimension: 2400,
            quality: 0.82,
            maxBytes: SERVICE_IMAGE_MAX_BYTES,
            fileNamePrefix: `service-${Date.now()}-${i}`,
          }),
        ),
      );
      setImages(prev => [
        ...prev,
        ...compressed.map(file => ({ url: URL.createObjectURL(file), file })),
      ]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.image_process_error, "error");
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileArray = Array.from(e.target.files ?? []);
    e.target.value = "";
    processImageFiles(fileArray);
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const processDocumentFiles = (fileArray: File[]) => {
    if (!fileArray.length) return;
    const remaining = MAX_DOCUMENTS - documents.length;
    const toAdd = fileArray.slice(0, remaining);
    const valid = toAdd.filter(f => {
      if (f.size > DOCUMENT_MAX_BYTES) {
        showToast(`${f.name}: ${t.mobile.new_service.document_too_large}`, "error");
        return false;
      }
      return true;
    });
    if (valid.length) setDocuments(prev => [...prev, ...valid]);
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileArray = Array.from(e.target.files ?? []);
    e.target.value = "";
    processDocumentFiles(fileArray);
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const canAddVideo = !!attachmentConfig?.videoUploadsEnabled && videos.length < (attachmentConfig?.maxBatchSize || 20);

  const processVideoFiles = (fileArray: File[]) => {
    if (!fileArray.length) return;
    if (!attachmentConfig?.videoUploadsEnabled) {
      showToast(t.mobile.upload_queue.video_disabled, "error");
      return;
    }
    const maxBatch = attachmentConfig.maxBatchSize || 20;
    const remaining = maxBatch - videos.length;
    const maxBytes = Number(attachmentConfig.maxVideoFileBytes || 0);
    const allowed = new Set(attachmentConfig.allowedVideoMimeTypes ?? []);
    const valid = fileArray.slice(0, Math.max(remaining, 0)).filter((file) => {
      if (maxBytes > 0 && file.size > maxBytes) {
        showToast(t.mobile.upload_queue.video_too_large.replace("{name}", file.name), "error");
        return false;
      }
      if (allowed.size > 0 && !allowed.has(file.type)) {
        showToast(t.mobile.upload_queue.video_bad_format.replace("{name}", file.name), "error");
        return false;
      }
      return true;
    });
    if (valid.length) setVideos(prev => [...prev, ...valid]);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileArray = Array.from(e.target.files ?? []);
    e.target.value = "";
    processVideoFiles(fileArray);
  };

  const removeVideo = (index: number) => {
    setVideos(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleDropzoneClick = () => {
    if (activeTab === "images") fileInputRef.current?.click();
    else if (activeTab === "documents") docInputRef.current?.click();
    else if (canAddVideo) videoInputRef.current?.click();
    else showToast(t.mobile.upload_queue.video_disabled, "error");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const fileArray = Array.from(e.dataTransfer.files ?? []);
    if (!fileArray.length) return;
    if (activeTab === "images") processImageFiles(fileArray);
    else if (activeTab === "documents") processDocumentFiles(fileArray);
    else processVideoFiles(fileArray);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId) { showToast(t.services.modal.asset_required, "error"); return; }
    if (!title.trim()) { showToast(t.services.modal.title_required, "error"); return; }
    if (isProcessingImages) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("asset_id", assetId);
      formData.append("title", title.trim());
      formData.append("description", description);
      images.forEach(img => formData.append("files", img.file));
      documents.forEach(doc => formData.append("files", doc));

      const createdService = await servicesService.create(formData);

      if (videos.length > 0) {
        const intents = await Promise.all(videos.map((video) => uploadService.createIntent(createdService.id, {
          originalName: video.name,
          mimeType: video.type,
          sizeBytes: String(video.size),
          mediaType: "VIDEO",
        })));
        enqueueVideos({ serviceId: createdService.id, files: videos, intents });
        showToast(t.mobile.upload_queue.uploading_count
          .replace("{count}", String(videos.length))
          .replace("{plural}", videos.length === 1 ? "" : "s")
          .replace("{percent}", "0"), "success");
      } else {
        showToast(t.services.modal.success, "success");
      }

      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["services-mobile"] });
      onSuccess();
      handleClose();
    } catch {
      showToast(t.services.modal.error, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (hasNoAssets) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300" onClick={handleClose} />
        <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
          <div className="px-8 pt-10 pb-6 flex justify-between items-center border-b border-gray-50">
            <h2 className="text-2xl font-black text-title tracking-tight">{t.services.modal.title_create}</h2>
            <button onClick={handleClose} className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-col items-center text-center gap-3 py-10 px-8">
            <div className="w-14 h-14 rounded-2xl bg-brand/5 flex items-center justify-center">
              <Package className="w-6 h-6 text-brand/30" />
            </div>
            <p className="text-base font-black text-title">{t.services.modal.no_assets_title}</p>
            <p className="text-sm text-subtitle/50 font-medium max-w-xs">{t.services.modal.no_assets_subtitle}</p>
            <button
              type="button"
              onClick={handleGoToAssets}
              className="mt-3 py-3 px-6 rounded-2xl text-sm font-black text-white bg-brand shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              {t.services.modal.no_assets_cta}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const uploadedCount = images.length + videos.length + documents.length;

  const tabs: { key: EvidenceTab; label: string; Icon: typeof ImageIcon }[] = [
    { key: "images", label: t.services.modal.tab_images, Icon: ImageIcon },
    { key: "videos", label: t.services.modal.tab_videos, Icon: Video },
    { key: "documents", label: t.services.modal.tab_documents, Icon: Paperclip },
  ];

  const dropCopy = activeTab === "images"
    ? { title: t.services.modal.drop_images, hint: t.services.modal.images_hint }
    : activeTab === "videos"
    ? { title: t.services.modal.drop_videos, hint: attachmentConfig?.videoUploadsEnabled ? t.services.modal.videos_hint : t.services.modal.videos_disabled_hint }
    : { title: t.services.modal.drop_documents, hint: t.services.modal.documents_hint };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300" onClick={handleClose} />

      <div className="relative bg-white w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-8 pt-10 pb-6 flex justify-between items-center border-b border-gray-50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-title tracking-tight">{t.services.modal.title_create}</h2>
              <p className="text-subtitle/50 text-sm font-medium mt-1">{t.services.modal.subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scroll flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
            {/* LEFT COLUMN */}
            <div className="flex flex-col space-y-6">
              {/* Section 1: Asset */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-white text-[11px] font-black shrink-0">1</span>
                  <h3 className="text-xs font-black text-subtitle/70 uppercase tracking-[0.15em]">{t.services.modal.asset_section}</h3>
                </div>
                <p className="text-xs text-subtitle/50 pl-8 -mt-1.5">{t.services.modal.asset_section_subtitle}</p>
                <div className="pl-8">
                  <Combobox
                    label=""
                    options={assets}
                    value={assetId}
                    onChange={setAssetId}
                    placeholder={t.services.modal.asset_placeholder}
                    icon={<Layers className="h-5 w-5" />}
                  />
                </div>
              </div>

              <div className="border-t border-gray-50" />

              {/* Section 2: Service Details */}
              <div className="flex flex-1 flex-col space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-white text-[11px] font-black shrink-0">2</span>
                  <h3 className="text-xs font-black text-subtitle/70 uppercase tracking-[0.15em]">{t.services.modal.details_section}</h3>
                </div>

                <div className="space-y-2 pl-8">
                  <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.services.modal.title_label}</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    maxLength={TITLE_MAX_LENGTH}
                    placeholder={t.services.modal.title_placeholder}
                    className="block w-full px-5 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm"
                  />
                  <p className="text-right text-[10px] font-black text-subtitle/30 tracking-widest pr-1">
                    {title.length}/{TITLE_MAX_LENGTH}
                  </p>
                </div>

                <div className="flex flex-1 flex-col space-y-2 pl-8">
                  <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.services.modal.description_label}</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    placeholder={t.services.modal.description_placeholder}
                    className="block w-full flex-1 min-h-30 px-5 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm resize-none"
                  />
                  <p className="text-right text-[10px] font-black text-subtitle/30 tracking-widest pr-1">
                    {description.length}/{DESCRIPTION_MAX_LENGTH}
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Evidence & Attachments */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                  <Paperclip className="w-4 h-4 text-brand" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-subtitle/70 uppercase tracking-[0.15em]">{t.services.modal.evidence_panel_title}</h3>
                  <p className="text-xs text-subtitle/50 mt-0.5">{t.services.modal.evidence_panel_subtitle}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 rounded-2xl bg-app-bg p-1.5">
                {tabs.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                      activeTab === key
                        ? "bg-brand/10 text-brand border border-brand/20 shadow-sm"
                        : "text-subtitle/40 hover:text-subtitle border border-transparent"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Dropzone */}
              <div
                onClick={handleDropzoneClick}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  isDraggingOver ? "border-brand bg-brand/5" : "border-border-theme/50 bg-app-bg hover:border-brand/30"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                  {isProcessingImages && activeTab === "images" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-5 h-5" />
                  )}
                </div>
                <p className="text-sm font-bold text-title">{dropCopy.title}</p>
                <p className="text-xs font-black text-brand">{t.services.modal.browse_cta}</p>
                <p className="text-[11px] text-subtitle/40 font-medium">{dropCopy.hint}</p>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handleFileChange} />
              <input ref={docInputRef} type="file" accept={DOCUMENT_ACCEPT} multiple className="hidden" onChange={handleDocumentChange} />
              <input ref={videoInputRef} type="file" accept={VIDEO_ACCEPT} multiple className="hidden" onChange={handleVideoChange} />

              {/* Uploaded files */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
                  {t.services.modal.uploaded_files_title} ({uploadedCount})
                </label>

                {uploadedCount === 0 ? (
                  <div className="flex flex-col items-center text-center gap-2 rounded-2xl border border-border-theme/30 bg-app-bg/60 py-8 px-6">
                    <div className="w-11 h-11 rounded-full bg-white border border-border-theme/40 shadow-sm flex items-center justify-center">
                      <Inbox className="w-5 h-5 text-subtitle/25" />
                    </div>
                    <p className="text-sm font-bold text-title">{t.services.modal.uploaded_files_empty_title}</p>
                    <p className="text-xs text-subtitle/40 font-medium">{t.services.modal.uploaded_files_empty_subtitle}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scroll pr-1">
                    {images.map((img, i) => (
                      <div key={`img-${img.url}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-app-bg border border-border-theme/30">
                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-border-theme/30">
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-title truncate">{img.file.name}</p>
                          <p className="text-[10px] text-subtitle/50 font-medium">{formatBytes(img.file.size)}</p>
                        </div>
                        <button type="button" onClick={() => removeImage(i)} className="p-1.5 rounded-full hover:bg-red-50 text-subtitle/40 hover:text-red-500 transition-colors shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {videos.map((video, i) => (
                      <div key={`video-${video.name}-${i}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-app-bg border border-border-theme/30">
                        <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                          <Video className="w-4 h-4 text-brand" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-title truncate">{video.name}</p>
                          <p className="text-[10px] text-subtitle/50 font-medium">{formatBytes(video.size)}</p>
                        </div>
                        <button type="button" onClick={() => removeVideo(i)} className="p-1.5 rounded-full hover:bg-red-50 text-subtitle/40 hover:text-red-500 transition-colors shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {documents.map((doc, i) => {
                      const { Icon, color } = getDocIcon(doc.name);
                      return (
                        <div key={`${doc.name}-${i}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-app-bg border border-border-theme/30">
                          <div className="w-9 h-9 rounded-lg bg-white border border-border-theme/30 flex items-center justify-center shrink-0">
                            <Icon className={`w-4 h-4 ${color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-title truncate">{doc.name}</p>
                            <p className="text-[10px] text-subtitle/50 font-medium">{formatBytes(doc.size)}</p>
                          </div>
                          <button type="button" onClick={() => removeDocument(i)} className="p-1.5 rounded-full hover:bg-red-50 text-subtitle/40 hover:text-red-500 transition-colors shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tip */}
              <div className="flex items-start gap-3 rounded-2xl bg-brand/5 border border-brand/10 p-4">
                <Lightbulb className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <p className="text-xs text-subtitle/60 font-medium leading-relaxed">
                  <span className="font-black text-brand uppercase tracking-wider">{t.services.modal.tip_label}: </span>
                  {t.services.modal.tip_text}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-8 mt-2 border-t border-gray-50">
            <button
              type="button"
              onClick={handleClose}
              className="py-3.5 px-6 rounded-2xl text-sm font-bold text-subtitle hover:bg-gray-100 transition-all"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || isProcessingImages || !assetId || !title.trim()}
              className="py-3.5 px-8 rounded-2xl text-sm font-black text-white bg-brand shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.services.modal.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
