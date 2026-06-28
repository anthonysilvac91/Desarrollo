"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type * as tus from "tus-js-client";
import { createTusUpload } from "@/lib/uploads/tusUploader";
import { uploadService } from "@/services/uploadService";
import { UploadIntent, UploadQueueItem } from "@/types/uploads";

interface EnqueueInput {
  serviceId: string;
  files: File[];
  intents?: UploadIntent[];
}

interface UploadQueueContextValue {
  items: UploadQueueItem[];
  activeCount: number;
  enqueueVideos: (input: EnqueueInput) => void;
  pauseUpload: (localId: string) => void;
  resumeUpload: (localId: string) => void;
  cancelUpload: (localId: string) => Promise<void>;
  retryUpload: (localId: string) => Promise<void>;
  attachFileToUpload: (localId: string, file: File) => boolean;
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);
const STORAGE_KEY = "fentri.uploadQueue.v1";

const TERMINAL_STATUSES = new Set(["completed", "cancelled"]);

function restorePersistedItems(): UploadQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UploadQueueItem[];
    return parsed
      .filter((item) => !TERMINAL_STATUSES.has(item.status))
      .map((item) => ({
        ...item,
        file: undefined,
        status: "needs_file" as const,
        error: "Selecciona nuevamente el archivo para continuar.",
      }));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function persistedShape(item: UploadQueueItem) {
  return {
    localId: item.localId,
    uploadId: item.uploadId,
    serviceId: item.serviceId,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    mediaType: item.mediaType,
    status: item.status === "uploading" ? "paused" : item.status,
    progress: item.progress,
    bytesUploaded: item.bytesUploaded,
    error: item.error,
    intent: item.intent,
  };
}

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadQueueItem[]>(restorePersistedItems);
  const [concurrency, setConcurrency] = useState(2);
  const uploadsRef = useRef(new Map<string, tus.Upload>());
  const progressReportRef = useRef(new Map<string, { progress: number; at: number }>());

  useEffect(() => {
    uploadService.getAttachmentConfig()
      .then((config) => setConcurrency(Math.max(1, config.uploadConcurrency || 2)))
      .catch(() => setConcurrency(2));

  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(persistedShape)));
  }, [items]);

  const patchItem = useCallback((localId: string, patch: Partial<UploadQueueItem>) => {
    setItems((current) => current.map((item) => item.localId === localId ? { ...item, ...patch } : item));
  }, []);

  const pollStreamConfirm = useCallback((localId: string, serviceId: string, uploadId: string, attempt = 0) => {
    if (attempt > 30) {
      console.error("[upload] Timeout esperando procesamiento de CF Stream", { localId, uploadId, serviceId, attempts: attempt });
      patchItem(localId, { status: "failed", error: "El video tardó demasiado en procesarse." });
      return;
    }
    setTimeout(async () => {
      try {
        const result = await uploadService.confirm(serviceId, uploadId);
        if (result?.status === "PROCESSING") {
          pollStreamConfirm(localId, serviceId, uploadId, attempt + 1);
        } else {
          patchItem(localId, { status: "completed", attachment: result, progress: 100 });
          await queryClient.invalidateQueries({ queryKey: ["services"] });
          await queryClient.invalidateQueries({ queryKey: ["service", serviceId] });
        }
      } catch (error: unknown) {
        console.error("[upload] Error al confirmar video en polling", { localId, uploadId, serviceId, attempt, error });
        patchItem(localId, { status: "failed", error: "Error al confirmar el video procesado." });
      }
    }, 3000);
  }, [patchItem, queryClient]);

  const startUpload = useCallback((item: UploadQueueItem) => {
    if (!item.file || !item.intent || !item.uploadId || uploadsRef.current.has(item.localId)) return;
    patchItem(item.localId, { status: "uploading", error: undefined });
    uploadService.markStarted(item.serviceId, item.uploadId).catch(() => undefined);

    const upload = createTusUpload(item.file, item.intent, {
      onProgress: (bytesUploaded, bytesTotal) => {
        const progress = bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
        patchItem(item.localId, { progress, bytesUploaded, status: "uploading" });
        const last = progressReportRef.current.get(item.localId);
        if (!last || progress - last.progress >= 10 || Date.now() - last.at > 30000) {
          progressReportRef.current.set(item.localId, { progress, at: Date.now() });
          uploadService.updateProgress(item.serviceId, item.uploadId!, progress, "UPLOADING").catch(() => undefined);
        }
      },
      onSuccess: async () => {
        uploadsRef.current.delete(item.localId);
        patchItem(item.localId, { status: "confirming", progress: 100, bytesUploaded: item.sizeBytes });
        try {
          await uploadService.updateProgress(item.serviceId, item.uploadId!, 100, "UPLOADED");
          const result = await uploadService.confirm(item.serviceId, item.uploadId!);
          if (result?.status === "PROCESSING") {
            patchItem(item.localId, { status: "confirming", progress: 100, error: "El video se está procesando..." });
            pollStreamConfirm(item.localId, item.serviceId, item.uploadId!);
          } else {
            patchItem(item.localId, { status: "completed", attachment: result, progress: 100 });
          }
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["services"] }),
            queryClient.invalidateQueries({ queryKey: ["service", item.serviceId] }),
          ]);
        } catch (error: unknown) {
          console.error("[upload] Error al confirmar carga tras TUS success", { localId: item.localId, uploadId: item.uploadId, serviceId: item.serviceId, error });
          const message = error instanceof Error ? error.message : "No se pudo confirmar la carga.";
          patchItem(item.localId, {
            status: "failed",
            error: message,
          });
        }
      },
      onError: (error) => {
        console.error("[upload] TUS error", { localId: item.localId, uploadId: item.uploadId, serviceId: item.serviceId, error: error.message, cause: error });
        uploadsRef.current.delete(item.localId);
        patchItem(item.localId, { status: "failed", error: error.message });
        if (item.uploadId) {
          uploadService.updateProgress(item.serviceId, item.uploadId, item.progress, "FAILED").catch(() => undefined);
        }
      },
    });

    uploadsRef.current.set(item.localId, upload);
    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch((error) => {
      uploadsRef.current.delete(item.localId);
      patchItem(item.localId, { status: "failed", error: error.message });
    });
  }, [patchItem, queryClient, pollStreamConfirm]);

  useEffect(() => {
    const active = items.filter((item) => item.status === "uploading" || item.status === "confirming").length;
    if (active >= concurrency) return;
    const next = items.find((item) => item.status === "queued" && item.file && item.intent);
    if (next) startUpload(next);
  }, [items, concurrency, startUpload]);

  const enqueueVideos = useCallback(({ serviceId, files, intents = [] }: EnqueueInput) => {
    const intentByClientId = new Map(intents.map((intent) => [intent.clientId, intent]));
    const intentQueue = [...intents];
    setItems((current) => [
      ...current,
      ...files.map((file) => {
        const localId = crypto.randomUUID();
        const intent = intentByClientId.get(localId) ?? intentQueue.shift();
        return {
          localId,
          uploadId: intent?.uploadId,
          serviceId,
          file,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          mediaType: "VIDEO" as const,
          status: intent ? "queued" as const : "authorizing" as const,
          progress: 0,
          bytesUploaded: 0,
          intent,
        };
      }),
    ]);
  }, []);

  const pauseUpload = useCallback((localId: string) => {
    uploadsRef.current.get(localId)?.abort();
    uploadsRef.current.delete(localId);
    patchItem(localId, { status: "paused" });
  }, [patchItem]);

  const resumeUpload = useCallback((localId: string) => {
    patchItem(localId, { status: "queued", error: undefined });
  }, [patchItem]);

  const cancelUpload = useCallback(async (localId: string) => {
    const item = items.find((candidate) => candidate.localId === localId);
    uploadsRef.current.get(localId)?.abort();
    uploadsRef.current.delete(localId);
    if (item?.uploadId) {
      await uploadService.cancel(item.serviceId, item.uploadId).catch(() => undefined);
    }
    setItems((current) => current.filter((i) => i.localId !== localId));
  }, [items, setItems]);

  const retryUpload = useCallback(async (localId: string) => {
    const item = items.find((candidate) => candidate.localId === localId);
    if (!item?.uploadId || !item.file) {
      patchItem(localId, { status: "needs_file", error: "Selecciona nuevamente el archivo para continuar." });
      return;
    }
    const intent = await uploadService.retry(item.serviceId, item.uploadId);
    patchItem(localId, { intent, status: "queued", error: undefined });
  }, [items, patchItem]);

  const attachFileToUpload = useCallback((localId: string, file: File) => {
    const item = items.find((candidate) => candidate.localId === localId);
    if (!item) return false;
    if (item.fileName !== file.name || item.sizeBytes !== file.size || item.mimeType !== file.type) {
      patchItem(localId, { error: "El archivo seleccionado no coincide con la carga original." });
      return false;
    }
    patchItem(localId, { file, status: "queued", error: undefined });
    return true;
  }, [items, patchItem]);

  const value = useMemo<UploadQueueContextValue>(() => ({
    items,
    activeCount: items.filter((item) => item.status === "uploading" || item.status === "confirming").length,
    enqueueVideos,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    attachFileToUpload,
  }), [items, enqueueVideos, pauseUpload, resumeUpload, cancelUpload, retryUpload, attachFileToUpload]);

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
}

export function useUploadQueue() {
  const context = useContext(UploadQueueContext);
  if (!context) {
    throw new Error("useUploadQueue must be used inside UploadQueueProvider");
  }
  return context;
}
