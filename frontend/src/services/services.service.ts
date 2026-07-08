import api from "@/lib/api";

export interface Service {
  id: string;
  title: string;
  original_title?: string | null;
  is_title_translated?: boolean;
  title_translation_status?: string;
  description: string | null;
  original_description?: string | null;
  original_language?: string | null;
  translated_language?: string | null;
  is_translated?: boolean;
  translation_status?: string;
  asset_id: string;
  asset?: {
    id: string;
    name: string;
    location?: string;
    thumbnail_url?: string | null;
    deleted_at?: string | null;
    purged_at?: string | null;
    owner?: { id: string; name: string; deleted_at?: string | null; purged_at?: string | null };
  };
  worker?: {
    id: string;
    name: string;
    deleted_at?: string | null;
    purged_at?: string | null;
  };
  attachments?: {
    id?: string;
    file_url?: string | null;
    thumbnail_url?: string | null;
    file_type?: string;
    file_name?: string | null;
    file_size_bytes?: number | null;
    media_type?: "IMAGE" | "VIDEO" | "DOCUMENT";
    status?: string;
  }[];
  attachmentUploadSummary?: {
    status: "NONE" | "UPLOADING" | "PARTIALLY_READY" | "READY" | "FAILED";
    expected: number;
    ready: number;
    uploading: number;
    failed: number;
    bytesTotal: string;
    bytesReady: string;
  };
  pendingAttachments?: Array<{
    uploadId: string;
    name: string;
    mediaType: "IMAGE" | "VIDEO" | "DOCUMENT";
    status: string;
    progress: number;
    file_size_bytes: string;
    failureCode?: string | null;
  }>;
  organization?: {
    name: string;
    logo_url?: string | null;
    default_asset_icon?: string | null;
  };
  is_public: boolean;
  status: string;
  created_at: string;
}

export interface ServiceShareLink {
  token: string;
  allow_downloads: boolean;
  expires_at?: string | null;
}

export interface PublicServiceShare {
  token: string;
  allow_downloads: boolean;
  service: Service;
}

export interface ServiceStats {
  total_services: number;
  period_services: number;
  assets_serviced: number;
  active_operators: number;
}

export interface ServiceFilterOptions {
  workers: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; name: string }>;
}

export interface ServiceListResponse {
  data: Service[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UploadIntentResponse {
  clientId: string;
  uploadId: string;
  bucket: string;
  objectPath: string;
  signedUploadToken: string;
  tusEndpoint: string;
  expiresAt: string;
}

export interface UpdateServiceInput {
  title?: string;
  description?: string | null;
  status?: string;
  is_public?: boolean;
  worker_id?: string;
  asset_id?: string;
}

export const servicesService = {
  findAll: async (params?: { page?: number; limit?: number; search?: string; worker_id?: string; asset_id?: string; preset?: string; startDate?: string; endDate?: string; lang?: string }): Promise<Service[] | ServiceListResponse> => {
    const res = await api.get("/services", { params });
    return res.data;
  },

  getStats: async (params?: { preset?: string; startDate?: string; endDate?: string; worker_id?: string; asset_id?: string }): Promise<ServiceStats> => {
    const res = await api.get<ServiceStats>("/services/stats", { params });
    return res.data;
  },
  getFilterOptions: async (): Promise<ServiceFilterOptions> => {
    const res = await api.get<ServiceFilterOptions>("/services/filter-options");
    return res.data;
  },
  findOne: async (id: string, lang?: string) => {
    const res = await api.get<Service>(`/services/${id}`, { params: { lang } });
    return res.data;
  },
  getOrCreateShareLink: async (id: string): Promise<ServiceShareLink> => {
    const res = await api.post<ServiceShareLink>(`/services/${id}/share-link`);
    return res.data;
  },
  findPublicShare: async (token: string, lang?: string): Promise<PublicServiceShare> => {
    const res = await api.get<PublicServiceShare>(`/public/service-shares/${token}`, { params: { lang } });
    return res.data;
  },
  create: async (data: FormData) => {
    const res = await api.post<Service>("/services", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  createWithUploadManifest: async (data: {
    title: string;
    description?: string;
    asset_id: string;
    expectedAttachments: Array<{
      clientId: string;
      name: string;
      mimeType: string;
      sizeBytes: string;
      mediaType: "VIDEO";
    }>;
  }): Promise<{ service: Service; uploadIntents: UploadIntentResponse[] }> => {
    const res = await api.post<{ service: Service; uploadIntents: UploadIntentResponse[] }>("/services/with-upload-manifest", data);
    return res.data;
  },
  update: async (id: string, data: UpdateServiceInput) => {
    const res = await api.patch<Service>(`/services/${id}`, data);
    return res.data;
  },
  getAttachmentDownloadUrl: async (serviceId: string, attachmentId: string): Promise<{ url: string; file_name: string | null; file_type: string | null }> => {
    const res = await api.get(`/services/${serviceId}/attachments/${attachmentId}/download`);
    return res.data;
  },
  getVideoPlaybackUrl: async (serviceId: string, attachmentId: string): Promise<{
    url?: string;
    embedUrl?: string;
    hlsUrl?: string;
    cfStreamUid?: string;
    duration?: number | null;
    thumbnail?: string | null;
    expiresAt?: string;
  }> => {
    const res = await api.post(`/services/${serviceId}/attachments/${attachmentId}/playback-url`);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/services/${id}`);
    return res.data;
  }
};
