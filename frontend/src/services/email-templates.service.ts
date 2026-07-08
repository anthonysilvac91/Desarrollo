import api from "@/lib/api";

export interface EmailTemplate {
  key: string;
  name: string;
  subject: string;
  trigger: string;
  connected: boolean;
  implemented: boolean;
  enabled: boolean;
}

export interface EmailTemplatePreview {
  subject: string;
  html: string;
}

export const emailTemplatesService = {
  findAll: async (): Promise<EmailTemplate[]> => {
    const res = await api.get<EmailTemplate[]>("/email-templates");
    return res.data;
  },

  preview: async (key: string, lang: "en" | "es" = "es"): Promise<EmailTemplatePreview> => {
    const res = await api.get<EmailTemplatePreview>(`/email-templates/${key}/preview`, {
      params: { lang },
    });
    return res.data;
  },

  sendTest: async (key: string, to: string, lang: "en" | "es" = "es"): Promise<{ sent: boolean }> => {
    const res = await api.post<{ sent: boolean }>(`/email-templates/${key}/send-test`, {
      to,
      lang,
    });
    return res.data;
  },

  toggle: async (key: string, enabled: boolean): Promise<{ key: string; enabled: boolean }> => {
    const res = await api.patch<{ key: string; enabled: boolean }>(`/email-templates/${key}/toggle`, {
      enabled,
    });
    return res.data;
  },
};
