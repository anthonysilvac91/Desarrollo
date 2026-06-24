"use client";

import { Play, Video } from "lucide-react";

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoAttachmentCard({
  name,
  size,
  onPlay,
}: {
  name?: string | null;
  size?: number | null;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-app-bg/60 border border-border-theme/30 text-left active:scale-[0.98] transition-all"
    >
      <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
        <Video className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-title truncate">{name || "Video"}</p>
        <p className="text-[10px] text-subtitle/50 font-medium">{formatBytes(size)}</p>
      </div>
      <div className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
        <Play className="w-4 h-4 fill-current" />
      </div>
    </button>
  );
}
