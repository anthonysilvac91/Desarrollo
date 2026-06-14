import api from "@/lib/api";

export interface OpenAiSettings {
  provider: "openai";
  model: string;
  translations_enabled: boolean;
  translate_services_created_after?: string | null;
  api_key_configured: boolean;
  api_key_hint?: string | null;
  updated_at?: string;
}

export interface UpdateOpenAiSettingsPayload {
  api_key?: string;
  model?: string;
  translations_enabled?: boolean;
  translate_services_created_after?: string | null;
}

export const aiSettingsService = {
  async getOpenAi(): Promise<OpenAiSettings> {
    const response = await api.get<OpenAiSettings>("/ai-settings/openai");
    return response.data;
  },

  async updateOpenAi(payload: UpdateOpenAiSettingsPayload): Promise<OpenAiSettings> {
    const response = await api.patch<OpenAiSettings>("/ai-settings/openai", payload);
    return response.data;
  },

  async testOpenAi(): Promise<{ ok: boolean }> {
    const response = await api.post<{ ok: boolean }>("/ai-settings/openai/test");
    return response.data;
  },
};
