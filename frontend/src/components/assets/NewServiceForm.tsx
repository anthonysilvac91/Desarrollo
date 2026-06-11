"use client";

import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera, Check, ChevronLeft, Loader2,
  X, CalendarDays, MapPin,
} from "lucide-react";
import { Asset, assetsService } from "@/services/assets.service";
import { useToast } from "@/lib/ToastContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { SERVICE_IMAGE_MAX_BYTES, compressImageFile } from "@/lib/imageCompression";
import { formatDate } from "@/lib/formatDate";
import AssetIcon from "@/components/ui/AssetIcon";
import ImageCropModal from "@/components/ui/ImageCropModal";

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const MAX_PHOTOS = 8;

interface NewServiceFormProps {
  asset: Asset;
  onSuccess: () => void;
  onCancel: () => void;
  /** When true: single-column layout, no sticky footer, no desktop sidebar */
  inline?: boolean;
}

export default function NewServiceForm({ asset, onSuccess, onCancel, inline = false }: NewServiceFormProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropQueue, setCropQueue] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  const openNextCrop = (sources: string[]) => {
    const [next, ...rest] = sources;
    setCropSrc(next ?? null);
    setCropQueue(rest);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileArray = Array.from(e.target.files ?? []);
    e.target.value = "";
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
      const sources = await Promise.all(
        compressed.map(
          file =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error(t.common.image_read_error));
              reader.readAsDataURL(file);
            }),
        ),
      );
      openNextCrop(sources);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.image_process_error, "error");
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleCropConfirm = (croppedFile: File) => {
    setImages(prev => [
      ...prev,
      { url: URL.createObjectURL(croppedFile), file: croppedFile },
    ]);
    openNextCrop(cropQueue);
  };

  const handleCropCancel = () => {
    setCropSrc(null);
    setCropQueue([]);
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting || isProcessingImages) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("asset_id", asset.id);
      images.forEach(img => formData.append("files", img.file));

      await assetsService.createService(formData);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
        queryClient.invalidateQueries({ queryKey: ["asset", asset.id] }),
        queryClient.invalidateQueries({ queryKey: ["services"] }),
      ]);
      showToast(t.mobile.new_service.success, "success");
      onSuccess();
    } catch (err: any) {
      console.error('[NewServiceForm] save error:', err?.response?.status, err?.response?.data, err?.message);
      const msg = err?.response?.data?.message;
      const status = err?.response?.status;
      const displayMsg = Array.isArray(msg) ? msg[0] : msg
        || (status ? `Error ${status}` : t.mobile.new_service.error_save);
      showToast(displayMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = title.trim().length > 0;
  const canAddPhoto = images.length < MAX_PHOTOS && !isSubmitting && !isProcessingImages && !cropSrc;

  return (
    <div className={`flex flex-col animate-in fade-in duration-300 ${inline ? "pb-4" : "pb-28 lg:pb-12"}`}>
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          onError={(message) => { showToast(message, "error"); handleCropCancel(); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8 lg:mb-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="p-3 rounded-full bg-surface border border-border-theme/60 hover:bg-app-bg transition-all shadow-sm shrink-0"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5px]" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-title tracking-tight leading-none">
              {t.mobile.new_service.header_title}
            </h1>
          </div>
        </div>

        {!inline && (
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting || isProcessingImages}
            className="hidden lg:flex items-center gap-2.5 bg-brand hover:bg-brand/90 disabled:opacity-40 text-white px-8 py-3.5 rounded-full font-black text-sm transition-all shadow-lg shadow-brand/25 active:scale-95"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3px]" />}
            <span>{t.mobile.new_service.save}</span>
          </button>
        )}
      </div>

      {/* Layout */}
      <div className={`grid gap-6 lg:gap-8 items-start ${inline ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1fr_340px]"}`}>

        {/* Columna principal: formulario */}
        <div className="space-y-5">

          {/* Título */}
          <div className="space-y-1.5">
            <span className="block px-1 text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
              {t.mobile.new_service.title_label}
            </span>
            <div className="bg-surface rounded-3xl border border-border-theme/40 overflow-hidden shadow-sm">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={TITLE_MAX_LENGTH}
                disabled={isSubmitting}
                placeholder={t.mobile.new_service.title_placeholder}
                className="w-full bg-transparent px-6 py-5 text-title font-bold text-base placeholder:text-subtitle/25 focus:outline-none disabled:opacity-50"
              />
              <div className="px-6 pb-4 flex justify-end">
                <span className={`text-[10px] font-black tracking-widest ${title.length > TITLE_MAX_LENGTH * 0.9 ? "text-brand" : "text-subtitle/25"}`}>
                  {title.length}/{TITLE_MAX_LENGTH}
                </span>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <span className="block px-1 text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
              {t.mobile.new_service.description_label}
            </span>
            <div className="bg-surface rounded-3xl border border-border-theme/40 overflow-hidden shadow-sm">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                disabled={isSubmitting}
                placeholder={t.mobile.new_service.description_placeholder}
                rows={6}
                className="w-full bg-transparent px-6 py-5 text-subtitle font-semibold text-sm placeholder:text-subtitle/25 focus:outline-none resize-none disabled:opacity-50 leading-relaxed"
              />
              <div className="px-6 pb-4 flex justify-end">
                <span className={`text-[10px] font-black tracking-widest ${description.length > DESCRIPTION_MAX_LENGTH * 0.9 ? "text-brand" : "text-subtitle/25"}`}>
                  {description.length}/{DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
            </div>
          </div>

          {/* Evidencia: siempre visible en inline, solo móvil en página */}
          <div className={inline ? undefined : "block lg:hidden"}>
            <EvidenceSection
              images={images}
              canAdd={canAddPhoto}
              isProcessing={isProcessingImages}
              onAdd={() => fileInputRef.current?.click()}
              onRemove={removeImage}
              t={t}
            />
          </div>

          {/* Botón guardar inline (solo en modo drawer) */}
          {inline && (
            <button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting || isProcessingImages}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-full font-black text-base bg-brand text-white shadow-xl shadow-brand/30 active:scale-95 transition-all disabled:opacity-40"
            >
              {isSubmitting || isProcessingImages ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[3px]" />
                  <span>{t.mobile.new_service.save}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Sidebar — solo en modo página desktop */}
        {!inline && (
          <div className="hidden lg:flex flex-col gap-5">
            <div className="bg-surface rounded-3xl border border-border-theme/40 p-6 shadow-sm space-y-4">
              <p className="text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
                {t.mobile.new_service.asset_label}
              </p>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-app-bg border border-border-theme/20 flex items-center justify-center shrink-0">
                  {asset.thumbnail_url ? (
                    <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <AssetIcon iconId={user?.organization?.default_asset_icon} className="w-7 h-7 text-brand opacity-30" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-title text-sm leading-tight truncate">{asset.name}</p>
                  {asset.owner?.name && (
                    <p className="text-xs font-semibold text-subtitle/60 truncate mt-0.5">{asset.owner.name}</p>
                  )}
                  {asset.location && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-brand shrink-0" />
                      <span className="text-xs text-subtitle/50 font-semibold truncate">{asset.location}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-border-theme/20 flex items-center gap-2 text-subtitle/50">
                <CalendarDays className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-xs font-bold">{formatDate(new Date())}</span>
              </div>
            </div>

            <EvidenceSection
              images={images}
              canAdd={canAddPhoto}
              isProcessing={isProcessingImages}
              onAdd={() => fileInputRef.current?.click()}
              onRemove={removeImage}
              t={t}
            />

            <button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting || isProcessingImages}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-sm bg-brand text-white shadow-lg shadow-brand/20 hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3px]" />}
              <span>{t.mobile.new_service.save}</span>
            </button>
          </div>
        )}
      </div>

      {/* Botón guardar sticky móvil — solo en modo página */}
      {!inline && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 lg:hidden p-5 pb-5 bg-gradient-to-t from-app-bg via-app-bg/95 to-transparent z-50 pointer-events-none">
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting || isProcessingImages}
            className="pointer-events-auto w-full flex items-center justify-center gap-2.5 py-4 rounded-full font-black text-base bg-brand text-white shadow-xl shadow-brand/30 active:scale-95 transition-all disabled:opacity-40"
          >
            {isSubmitting || isProcessingImages ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5 stroke-[3px]" />
                <span>{t.mobile.new_service.save}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Input de archivo */}
      <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handleFileChange} />
    </div>
  );
}

interface EvidenceSectionProps {
  images: { url: string; file: File }[];
  canAdd: boolean;
  isProcessing: boolean;
  onAdd: () => void;
  onRemove: (i: number) => void;
  t: any;
}

function EvidenceSection({ images, canAdd, isProcessing, onAdd, onRemove, t }: EvidenceSectionProps) {
  return (
    <div className="bg-surface rounded-3xl border border-border-theme/40 overflow-hidden shadow-sm">
      <div className="px-5 pt-5 pb-3 border-b border-border-theme/20 flex items-center justify-between">
        <label className="text-[10px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
          {t.mobile.new_service.evidence_label}
        </label>
        {images.length > 0 && (
          <span className="bg-brand/10 text-brand text-[10px] font-black px-2 py-0.5 rounded-full">
            {images.length}/{MAX_PHOTOS}
          </span>
        )}
      </div>

      <div className="p-4 grid grid-cols-3 gap-2.5">
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="aspect-square rounded-2xl border-2 border-dashed border-brand/30 bg-brand/5 flex flex-col items-center justify-center text-brand gap-1.5 active:scale-95 transition-all hover:border-brand/50 hover:bg-brand/10"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  {t.mobile.new_service.evidence_add}
                </span>
              </>
            )}
          </button>
        )}

        {images.map((img, i) => (
          <div key={img.url} className="aspect-square rounded-2xl overflow-hidden relative border border-border-theme/40 group">
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-title/60 backdrop-blur-sm text-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {images.length === 0 &&
          [0, 1, 2, 3, 4].map(i => (
            <div
              key={`slot-${i}`}
              className="aspect-square rounded-2xl border border-dashed border-border-theme/40 bg-app-bg/40 flex items-center justify-center"
            >
              <Camera className="w-4 h-4 text-subtitle/20" />
            </div>
          ))}
      </div>

      {images.length === 0 && (
        <p className="text-center text-xs text-subtitle/30 font-semibold pb-5 -mt-1">
          {t.mobile.new_service.evidence_empty_hint}
        </p>
      )}
    </div>
  );
}
