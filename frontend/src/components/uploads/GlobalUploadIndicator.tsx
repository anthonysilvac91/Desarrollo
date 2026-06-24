"use client";

import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useUploadQueue } from "@/providers/UploadQueueProvider";
import { UploadQueueDrawer } from "./UploadQueueDrawer";
import { useLanguage } from "@/lib/LanguageContext";

export function GlobalUploadIndicator() {
  const { items } = useUploadQueue();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const activeItems = items.filter((item) => ["queued", "authorizing", "uploading", "confirming", "paused", "failed", "needs_file"].includes(item.status));
  const average = useMemo(() => {
    if (!activeItems.length) return 0;
    return Math.round(activeItems.reduce((sum, item) => sum + item.progress, 0) / activeItems.length);
  }, [activeItems]);

  if (activeItems.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-1/2 bottom-20 z-80 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border-theme/30 bg-title px-4 py-3 text-white shadow-2xl md:bottom-6"
      >
        <UploadCloud className="w-4 h-4 text-brand" />
        <span className="text-xs font-black">
          {t.mobile.upload_queue.uploading_count
            .replace("{count}", String(activeItems.length))
            .replace("{plural}", activeItems.length === 1 ? "" : "s")
            .replace("{percent}", String(average))}
        </span>
      </button>
      <UploadQueueDrawer isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
