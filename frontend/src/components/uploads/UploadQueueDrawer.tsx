"use client";

import Drawer from "@/components/ui/Drawer";
import { UploadQueueItem } from "./UploadQueueItem";
import { useUploadQueue } from "@/providers/UploadQueueProvider";
import { useLanguage } from "@/lib/LanguageContext";

export function UploadQueueDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { items, pauseUpload, resumeUpload, cancelUpload, retryUpload, attachFileToUpload } = useUploadQueue();
  const { t } = useLanguage();

  return (
    <Drawer isOpen={isOpen} onClose={onClose} panelClassName="bg-app-bg">
      <div className="px-6 pt-20 pb-8 space-y-5">
        <div>
          <h2 className="text-xl font-black text-title">{t.mobile.upload_queue.title}</h2>
          <p className="text-xs font-semibold text-subtitle/50 mt-1">
            {t.mobile.upload_queue.continues_open}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-theme/50 py-10 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-subtitle/30">
              {t.mobile.upload_queue.active_empty}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <UploadQueueItem
                key={item.localId}
                item={item}
                onPause={() => pauseUpload(item.localId)}
                onResume={() => resumeUpload(item.localId)}
                onCancel={() => cancelUpload(item.localId)}
                onRetry={() => retryUpload(item.localId)}
                onAttachFile={(file) => attachFileToUpload(item.localId, file)}
                labels={t.mobile.upload_queue}
              />
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
