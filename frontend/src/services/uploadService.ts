import api from "@/lib/api";
import { AttachmentConfig, PlaybackData, UploadIntent } from "@/types/uploads";

export interface CreateUploadIntentInput {
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  mediaType: "VIDEO";
}

export const uploadService = {
  getAttachmentConfig: async (): Promise<AttachmentConfig> => {
    const res = await api.get<AttachmentConfig>("/services/attachment-config");
    return res.data;
  },
  createIntent: async (serviceId: string, data: CreateUploadIntentInput): Promise<UploadIntent> => {
    const res = await api.post<UploadIntent>(`/services/${serviceId}/attachments/upload-intents`, data);
    return res.data;
  },
  markStarted: async (serviceId: string, uploadId: string): Promise<void> => {
    await api.post(`/services/${serviceId}/attachments/${uploadId}/start`);
  },
  updateProgress: async (serviceId: string, uploadId: string, progress: number, status?: string): Promise<void> => {
    await api.patch(`/services/${serviceId}/attachments/${uploadId}/progress`, { progress, status });
  },
  confirm: async (serviceId: string, uploadId: string): Promise<any> => {
    const res = await api.post(`/services/${serviceId}/attachments/${uploadId}/confirm`, {});
    return res.data;
  },
  retry: async (serviceId: string, uploadId: string): Promise<UploadIntent> => {
    const res = await api.post(`/services/${serviceId}/attachments/${uploadId}/retry`);
    return res.data;
  },
  cancel: async (serviceId: string, uploadId: string): Promise<void> => {
    await api.delete(`/services/${serviceId}/attachments/uploads/${uploadId}`);
  },
  getPlaybackUrl: async (serviceId: string, attachmentId: string): Promise<PlaybackData> => {
    const res = await api.post<PlaybackData>(`/services/${serviceId}/attachments/${attachmentId}/playback-url`);
    return res.data;
  },
  getMine: async (status?: "pending"): Promise<any[]> => {
    const res = await api.get("/uploads/mine", { params: { status } });
    return res.data;
  },
};
