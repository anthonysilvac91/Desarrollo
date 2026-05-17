"use client";

import React, { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Camera, Check, ChevronLeft, Loader2, Ship, X } from "lucide-react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import { assetsService } from "@/services/assets.service";
import { useToast } from "@/lib/ToastContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 400;

export default function NewAssetServicePage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const assetId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreateService = user?.role === "ADMIN" || user?.role === "WORKER";

  const { data: asset, isLoading, isError } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsService.findOne(assetId),
    enabled: !!assetId,
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    const newImages = Array.from(files).map((file) => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setImages((current) => [...current, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((current) => {
      const next = [...current];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!canCreateService || !title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("asset_id", assetId);
      images.forEach((image) => formData.append("files", image.file));

      await assetsService.createService(formData);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
        queryClient.invalidateQueries({ queryKey: ["asset", assetId] }),
        queryClient.invalidateQueries({ queryKey: ["services"] }),
      ]);
      showToast(t.mobile.new_service.success, "success");
      router.replace(`/assets/${assetId}`);
    } catch (error: unknown) {
      const serverMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "message" in error.response.data
          ? error.response.data.message
          : undefined;
      showToast(
        Array.isArray(serverMessage)
          ? serverMessage[0]
          : serverMessage || t.mobile.new_service.error_save,
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreateService) {
    return (
      <ModuleContainer>
        <div className="py-20 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-error mx-auto" />
          <p className="font-black text-title">No tienes permiso para crear servicios.</p>
        </div>
      </ModuleContainer>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
        <p className="font-black text-subtitle/40 tracking-widest text-xs uppercase">{t.feedback.syncing}</p>
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <ModuleContainer>
        <div className="py-20 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-error mx-auto" />
          <p className="font-black text-title">{t.mobile.new_service.error_asset}</p>
        </div>
      </ModuleContainer>
    );
  }

  return (
    <div className="flex flex-col space-y-8 pb-16">
      <div className="flex items-center space-x-5">
        <button
          onClick={() => router.back()}
          className="p-3.5 rounded-full bg-surface border border-border-theme/60 hover:bg-app-bg transition-all shadow-sm"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5px]" />
        </button>
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-title tracking-tight leading-none mb-2">
            {t.mobile.new_service.header_title}
          </h1>
          <p className="text-sm font-bold text-subtitle/60">{asset.name}</p>
        </div>
      </div>

      <ModuleContainer>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
                {t.mobile.new_service.title_label}
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={TITLE_MAX_LENGTH}
                disabled={isSubmitting}
                placeholder={t.mobile.new_service.title_placeholder}
                className="w-full bg-app-bg border border-border-theme/40 rounded-2xl px-5 py-4 text-title font-bold placeholder:text-subtitle/30 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all disabled:opacity-50"
              />
              <p className="text-right text-[10px] font-black text-subtitle/30 tracking-widest">
                {title.length}/{TITLE_MAX_LENGTH}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle/40 uppercase tracking-[0.2em]">
                {t.mobile.new_service.description_label}
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                disabled={isSubmitting}
                placeholder={t.mobile.new_service.description_placeholder}
                className="w-full bg-app-bg border border-border-theme/40 rounded-2xl p-5 min-h-[180px] text-title font-semibold placeholder:text-subtitle/30 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all resize-none disabled:opacity-50"
              />
              <p className="text-right text-[10px] font-black text-subtitle/30 tracking-widest">
                {description.length}/{DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl bg-app-bg border border-border-theme/40 p-5">
              <div className="flex items-center space-x-3 mb-4">
                <Ship className="w-5 h-5 text-brand" />
                <div>
                  <p className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest">
                    {t.mobile.new_service.asset_label}
                  </p>
                  <p className="text-sm font-black text-title">{asset.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full h-24 border-2 border-dashed border-brand/40 rounded-2xl flex flex-col items-center justify-center text-brand bg-surface active:scale-95 transition-all disabled:opacity-40"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-black uppercase">{t.mobile.new_service.evidence_add}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </button>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {images.map((image, index) => (
                  <div key={image.url} className="relative aspect-square rounded-2xl overflow-hidden border border-border-theme/40">
                    <img src={image.url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => !isSubmitting && removeImage(index)}
                      disabled={isSubmitting}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-app-bg/90 text-title flex items-center justify-center shadow-sm disabled:opacity-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-4 rounded-full font-black text-base transition-all shadow-xl bg-brand text-white shadow-brand/30 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Check className="w-6 h-6 stroke-[3px]" />
                  <span>{t.mobile.new_service.save}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </ModuleContainer>
    </div>
  );
}
