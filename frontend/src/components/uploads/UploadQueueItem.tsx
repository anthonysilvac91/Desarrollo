"use client";

import { Loader2, Pause, Play, RotateCcw, X } from "lucide-react";
import { UploadQueueItem as UploadQueueItemType } from "@/types/uploads";

interface UploadQueueLabels {
  confirming: string;
  uploaded_percent: string;
  select_same_file: string;
  select_file: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadQueueItem({
  item,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onAttachFile,
  labels,
}: {
  item: UploadQueueItemType;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onAttachFile: (file: File) => void;
  labels: UploadQueueLabels;
}) {
  const isActive = item.status === "uploading" || item.status === "confirming";
  const canResume = item.status === "paused";
  const canRetry = item.status === "failed";

  return (
    <div className="rounded-2xl border border-border-theme/40 bg-surface p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-title truncate">{item.fileName}</p>
          <p className="text-[11px] font-semibold text-subtitle/50">
            {formatBytes(item.sizeBytes)} · {item.status}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <button onClick={onPause} className="p-2 rounded-full bg-brand/10 text-brand active:scale-90">
              <Pause className="w-4 h-4" />
            </button>
          )}
          {canResume && (
            <button onClick={onResume} className="p-2 rounded-full bg-brand/10 text-brand active:scale-90">
              <Play className="w-4 h-4" />
            </button>
          )}
          {canRetry && (
            <button onClick={onRetry} className="p-2 rounded-full bg-brand/10 text-brand active:scale-90">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {item.status !== "completed" && item.status !== "cancelled" && (
            <button onClick={onCancel} className="p-2 rounded-full bg-red-50 text-red-500 active:scale-90">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="h-2 rounded-full bg-app-bg overflow-hidden">
        <div className="h-full bg-brand transition-all" style={{ width: `${item.progress}%` }} />
      </div>

      {isActive && (
        <div className="flex items-center gap-2 text-[11px] font-bold text-subtitle/50">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
          <span>{item.status === "confirming" ? labels.confirming : labels.uploaded_percent.replace("{percent}", String(item.progress))}</span>
        </div>
      )}
      {item.error && <p className="text-[11px] font-semibold text-red-500">{item.error}</p>}
      {item.status === "needs_file" && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-amber-600">
            {labels.select_same_file}
          </p>
          <label className="inline-flex cursor-pointer items-center rounded-full bg-brand px-3 py-2 text-[11px] font-black text-white active:scale-95">
            {labels.select_file}
            <input
              type="file"
              className="hidden"
              accept={item.mimeType}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onAttachFile(file);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
