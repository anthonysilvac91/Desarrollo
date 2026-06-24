"use client";

import { X } from "lucide-react";

export function VideoPlayerModal({
  url,
  embedUrl,
  title,
  onClose,
}: {
  url?: string;
  embedUrl?: string;
  title?: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-100">
      <div className="absolute inset-0 bg-app-bg/80 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative z-10 flex min-h-full flex-col justify-center px-4 py-8">
        <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl bg-title shadow-2xl">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="min-w-0 truncate text-sm font-black text-white">{title || "Video"}</p>
            <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white active:scale-90">
              <X className="h-5 w-5" />
            </button>
          </div>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="aspect-video w-full bg-black"
              style={{ border: "none" }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={url}
              controls
              preload="metadata"
              className="aspect-video w-full bg-black"
            >
              Tu navegador no puede reproducir este video. Descarga el archivo para verlo.
            </video>
          )}
        </div>
      </div>
    </div>
  );
}
