"use client";

import React, { useState } from "react";
import { Camera, FileText } from "lucide-react";

export interface ServiceAttachmentLike {
  file_url: string;
  file_type?: string;
}

interface ServiceAttachmentCardProps {
  attachment: ServiceAttachmentLike;
  alt: string;
  size?: "sm" | "md" | "lg";
  onImageClick?: (url: string) => void;
}

function isImageAttachment(fileType?: string) {
  return typeof fileType === "string" && fileType.startsWith("image/");
}

export default function ServiceAttachmentCard({
  attachment,
  alt,
  size = "md",
  onImageClick,
}: ServiceAttachmentCardProps) {
  const [hasError, setHasError] = useState(false);
  const isImage = isImageAttachment(attachment.file_type) && !hasError;

  const sizeClass =
    size === "sm"
      ? "w-14 h-14 rounded-2xl"
      : size === "lg"
        ? "aspect-square rounded-2xl"
        : "w-24 h-24 rounded-2xl";

  const clickable = isImage && !!onImageClick;

  if (!isImage) {
    return (
      <div className={`${sizeClass} border border-border-theme/20 bg-app-bg flex flex-col items-center justify-center p-3 text-center`}>
        <FileText className="w-6 h-6 text-subtitle/35 mb-2" />
        <span className="text-[10px] font-black uppercase tracking-wider text-subtitle/45">
          {attachment.file_type || "Archivo"}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={clickable ? () => onImageClick(attachment.file_url) : undefined}
      className={`${sizeClass} overflow-hidden border border-border-theme/20 shadow-sm bg-app-bg group relative ${clickable ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform" : ""}`}
    >
      <img
        src={attachment.file_url}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
      {clickable && (
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-6 h-6 text-white" />
        </div>
      )}
    </button>
  );
}
