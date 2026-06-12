"use client";

import React, { useState, useRef } from "react";
import { X, Loader2, ImagePlus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Combobox from "@/components/ui/Combobox";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { servicesService } from "@/services/services.service";
import { Asset, assetsService } from "@/services/assets.service";
import { SERVICE_IMAGE_MAX_BYTES, compressImageFile } from "@/lib/imageCompression";

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 400;
const MAX_PHOTOS = 20;

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ServiceModal({ isOpen, onClose, onSuccess }: ServiceModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  const { data: assetsData = [] } = useQuery<Asset[] | { data: Asset[] }>({
    queryKey: ["assets"],
    queryFn: () => assetsService.findAll(),
    enabled: isOpen,
  });

  const assets = Array.isArray(assetsData) ? assetsData : assetsData.data || [];

  const resetForm = () => {
    setAssetId("");
    setTitle("");
    setDescription("");
    setImages([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
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

  const removeImage = (index: number) => {
    setImages(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
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

      await servicesService.create(formData);
      queryClient.invalidateQueries({ queryKey: ["services"] });
      showToast(t.services.modal.success, "success");
      onSuccess();
      handleClose();
    } catch {
      showToast(t.services.modal.error, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t.services.modal.title_create}>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-6 mt-2">

        {/* Asset */}
        <Combobox
          label={t.services.modal.asset_label}
          options={assets}
          value={assetId}
          onChange={setAssetId}
          placeholder={t.services.modal.asset_placeholder}
        />

        {/* Title */}
        <div className="flex flex-col space-y-2">
          <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
            {t.services.modal.title_label}
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={TITLE_MAX_LENGTH}
            placeholder={t.services.modal.title_placeholder}
            className="w-full px-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
          />
          <p className="text-right text-[10px] font-black text-subtitle/30 tracking-widest pr-1">
            {title.length}/{TITLE_MAX_LENGTH}
          </p>
        </div>

        {/* Description */}
        <div className="flex flex-col space-y-2">
          <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
            {t.services.modal.description_label}
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder={t.services.modal.description_placeholder}
            rows={3}
            className="w-full px-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm resize-none"
          />
          <p className="text-right text-[10px] font-black text-subtitle/30 tracking-widest pr-1">
            {description.length}/{DESCRIPTION_MAX_LENGTH}
          </p>
        </div>

        {/* Evidence */}
        <div className="flex flex-col space-y-2">
          <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1 flex items-center justify-between">
            <span>{t.services.modal.evidence_label}</span>
            {images.length > 0 && (
              <span className="bg-brand/10 text-brand text-[11px] px-2 py-0.5 rounded-full font-black normal-case tracking-normal">
                {images.length}
              </span>
            )}
          </label>
          <div className="flex gap-3 flex-wrap">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-border-theme/40 flex-shrink-0">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < MAX_PHOTOS && (
              <button
                type="button"
                disabled={isProcessingImages}
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-border-theme flex items-center justify-center text-subtitle/30 hover:border-brand/40 hover:text-brand/40 transition-colors flex-shrink-0 disabled:opacity-50"
              >
                {isProcessingImages ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-6 h-6" strokeWidth={1.25} />}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-4 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-4 px-6 rounded-2xl text-sm font-bold text-subtitle hover:bg-gray-100 transition-all"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={loading || isProcessingImages || !assetId || !title.trim()}
            className="flex-[2] py-4 px-6 rounded-2xl text-sm font-black text-white bg-brand shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.services.modal.submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}
