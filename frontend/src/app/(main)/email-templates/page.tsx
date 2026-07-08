"use client";

import React, { useState } from "react";
import { Mail, Eye, X, Loader2, AlertCircle, CheckCircle2, CircleSlash, Send, ToggleLeft, ToggleRight } from "lucide-react";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { emailTemplatesService, EmailTemplate } from "@/services/email-templates.service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PreviewModal({ templateKey, templateName, onClose }: { templateKey: string; templateName: string; onClose: () => void }) {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [previewLang, setPreviewLang] = useState<"en" | "es">(language);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["email-template-preview", templateKey, previewLang],
    queryFn: () => emailTemplatesService.preview(templateKey, previewLang),
  });

  const handleSendTest = async () => {
    if (!EMAIL_PATTERN.test(testEmail.trim())) {
      showToast(t.email_templates.preview_modal.send_test_invalid_email, "error");
      return;
    }
    setIsSendingTest(true);
    try {
      await emailTemplatesService.sendTest(templateKey, testEmail.trim(), previewLang);
      showToast(t.email_templates.preview_modal.send_test_success, "success");
    } catch {
      showToast(t.email_templates.preview_modal.send_test_error, "error");
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-6 duration-300 max-h-[90vh] flex flex-col">
        <div className="px-8 pt-8 pb-5 flex items-start justify-between border-b border-gray-50 shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-title tracking-tight truncate">{templateName}</h2>
            {data && (
              <p className="mt-1 text-sm font-medium text-subtitle/50 truncate">
                <span className="font-bold text-subtitle/70">{t.email_templates.preview_modal.subject_label}:</span> {data.subject}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center bg-app-bg/80 p-0.5 rounded-full border border-border-theme/50">
              <button
                onClick={() => setPreviewLang("en")}
                className={`px-2.5 py-1 text-[9px] font-black rounded-full transition-all ${
                  previewLang === "en" ? "bg-surface text-brand shadow-sm" : "text-subtitle/40 hover:text-subtitle"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setPreviewLang("es")}
                className={`px-2.5 py-1 text-[9px] font-black rounded-full transition-all ${
                  previewLang === "es" ? "bg-surface text-brand shadow-sm" : "text-subtitle/40 hover:text-subtitle"
                }`}
              >
                ES
              </button>
            </div>
            <button onClick={onClose} className="w-11 h-11 shrink-0 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll bg-app-bg p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-brand animate-spin mb-3" />
              <p className="text-sm font-semibold text-subtitle/50">{t.email_templates.states.preview_loading}</p>
            </div>
          ) : isError || !data ? (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle className="w-8 h-8 text-error mb-3" />
              <p className="text-sm font-semibold text-subtitle/50">{t.email_templates.states.preview_error}</p>
            </div>
          ) : (
            <iframe
              title={templateName}
              srcDoc={data.html}
              sandbox=""
              className="w-full rounded-2xl border border-border-theme/30 bg-white shadow-sm"
              style={{ height: "70vh" }}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-50 shrink-0 flex items-center gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-subtitle/30" />
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isSendingTest) handleSendTest(); }}
              placeholder={t.email_templates.preview_modal.send_test_placeholder}
              disabled={isSendingTest}
              className="w-full pl-10 pr-4 py-3 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-semibold placeholder:text-subtitle/30 placeholder:font-medium focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm disabled:opacity-60"
            />
          </div>
          <button
            onClick={handleSendTest}
            disabled={isSendingTest || !data}
            className="flex items-center gap-2 px-5 py-3 bg-brand text-white rounded-2xl text-sm font-black shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isSendingTest ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.email_templates.preview_modal.send_test_sending}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {t.email_templates.preview_modal.send_test_button}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmailTemplatesPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => emailTemplatesService.findAll(),
  });

  const handleToggle = async (item: EmailTemplate) => {
    setTogglingKey(item.key);
    try {
      await emailTemplatesService.toggle(item.key, !item.enabled);
      await queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    } catch {
      showToast(t.email_templates.toggle_error, "error");
    } finally {
      setTogglingKey(null);
    }
  };

  const columns: ColumnDef<EmailTemplate>[] = [
    {
      key: "name",
      header: t.email_templates.table.name,
      sortable: true,
      sortValue: (item) => item.name,
      cell: (item) => (
        <div className={`flex items-center gap-3 ${!item.implemented ? "opacity-40" : ""}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <span className="font-bold text-title text-sm">{item.name}</span>
        </div>
      ),
    },
    {
      key: "subject",
      header: t.email_templates.table.subject,
      cell: (item) => (
        <span className={`text-xs font-semibold text-subtitle/70 ${!item.implemented ? "opacity-40" : ""}`}>
          {item.subject}
        </span>
      ),
    },
    {
      key: "trigger",
      header: t.email_templates.table.trigger,
      cell: (item) => (
        <span className={`text-xs font-medium text-subtitle/50 ${!item.implemented ? "opacity-40" : ""}`}>
          {item.trigger}
        </span>
      ),
    },
    {
      key: "status",
      header: t.email_templates.table.status,
      align: "center",
      sortable: true,
      sortValue: (item) => (!item.implemented ? 0 : item.connected ? 2 : 1),
      cell: (item) =>
        !item.implemented ? (
          <span className="inline-flex items-center gap-1.5 justify-center w-32 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-slate-100 text-slate-500 border-slate-200">
            <CircleSlash className="w-3 h-3" />
            {t.email_templates.status_pending}
          </span>
        ) : item.connected ? (
          <span className="inline-flex items-center gap-1.5 justify-center w-32 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3" />
            {t.email_templates.status_connected}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 justify-center w-32 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-100 text-amber-700 border-amber-200">
            <CircleSlash className="w-3 h-3" />
            {t.email_templates.status_orphan}
          </span>
        ),
    },
    {
      key: "enabled",
      header: t.email_templates.table.enabled,
      align: "center",
      sortable: true,
      sortValue: (item) => (item.enabled ? 1 : 0),
      cell: (item) =>
        !item.implemented ? (
          <span className="text-xs text-subtitle/20">—</span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handleToggle(item); }}
            disabled={togglingKey === item.key}
            className={`p-1.5 transition-all rounded-full disabled:opacity-40 ${
              item.enabled ? "text-brand hover:bg-brand/10" : "text-subtitle/30 hover:text-subtitle hover:bg-subtitle/10"
            }`}
            title={item.enabled ? t.email_templates.toggle_disable : t.email_templates.toggle_enable}
          >
            {togglingKey === item.key ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : item.enabled ? (
              <ToggleRight className="w-6 h-6" />
            ) : (
              <ToggleLeft className="w-6 h-6" />
            )}
          </button>
        ),
    },
    {
      key: "actions",
      header: t.email_templates.table.actions,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); if (item.implemented) setPreviewTemplate(item); }}
            disabled={!item.implemented}
            className={`p-2 rounded-full transition-all ${
              item.implemented
                ? "text-subtitle/40 hover:text-brand hover:bg-brand/5"
                : "text-subtitle/15 cursor-not-allowed"
            }`}
            title={item.implemented ? t.email_templates.preview_action : t.email_templates.preview_unavailable}
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col space-y-8">
      <div>
        <h1 className="text-2xl font-black text-title tracking-tight">{t.email_templates.title}</h1>
        <p className="mt-1 text-sm font-medium text-subtitle/50">{t.email_templates.subtitle}</p>
      </div>

      <div className="bg-white rounded-4xl border border-border-theme/40 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand mb-4" />
            <p className="text-subtitle font-medium animate-pulse">{t.email_templates.states.loading}</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="p-4 bg-error/10 rounded-full">
              <AlertCircle className="w-8 h-8 text-error" />
            </div>
            <div className="text-center">
              <p className="font-black text-title text-xl tracking-tight">{t.email_templates.states.error_title}</p>
              <p className="text-subtitle font-medium text-sm">{t.email_templates.states.error_subtitle}</p>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-10 h-10 text-subtitle/30" />
            </div>
            <h3 className="text-lg font-black text-title mb-1">{t.email_templates.states.empty_title}</h3>
            <p className="text-subtitle font-medium max-w-sm">{t.email_templates.states.empty_subtitle}</p>
          </div>
        ) : (
          <DataTable
            data={templates}
            columns={columns}
            keyExtractor={(item) => item.key}
            onRowClick={(item) => { if (item.implemented) setPreviewTemplate(item); }}
          />
        )}
      </div>

      {previewTemplate && (
        <PreviewModal
          templateKey={previewTemplate.key}
          templateName={previewTemplate.name}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}
