"use client";

import React, { useState, useEffect } from "react";
import { X, Mail, Loader2, Send, UserCog, Building2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { invitationsService, CreateInvitationData } from "@/services/invitations.service";
import { ownersService, Owner } from "@/services/owners.service";

interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES = ["ADMIN", "WORKER", "EXTERNAL"] as const;

export default function InvitationModal({ isOpen, onClose, onSuccess }: InvitationModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [form, setForm] = useState<CreateInvitationData>({ email: "", role: "WORKER" });

  useEffect(() => {
    if (!isOpen) return;
    setForm({ email: "", role: "WORKER" });
    ownersService.findAll({ limit: 200 }).then((res) => {
      const list = Array.isArray(res) ? res : res.data ?? [];
      setOwners(list.filter((o: Owner) => o.is_active));
    }).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) { window.addEventListener("keydown", handleEsc); document.body.style.overflow = "hidden"; }
    return () => { window.removeEventListener("keydown", handleEsc); document.body.style.overflow = "auto"; };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.role === "EXTERNAL" && !form.owner_id) return;
    setLoading(true);
    try {
      await invitationsService.create(form);
      showToast(t.invitations.modal.success, "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t.invitations.modal.error;
      showToast(Array.isArray(msg) ? msg[0] : msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.email.includes("@") && form.role &&
    (form.role !== "EXTERNAL" || !!form.owner_id);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        {/* Header */}
        <div className="px-8 pt-10 pb-6 flex justify-between items-start border-b border-gray-50">
          <div>
            <h2 className="text-2xl font-black text-title tracking-tight">{t.invitations.modal.title}</h2>
            <p className="text-subtitle/50 text-xs font-bold uppercase tracking-widest mt-1">{t.invitations.modal.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
              {t.invitations.modal.email_label} <span className="text-error">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 opacity-30 group-focus-within:text-brand group-focus-within:opacity-100 transition-all" />
              </div>
              <input
                required
                type="email"
                className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all text-sm"
                placeholder={t.invitations.modal.email_placeholder}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
              {t.invitations.modal.role_label} <span className="text-error">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((role) => {
                const roleStyles: Record<string, string> = {
                  ADMIN: "border-indigo-200 bg-indigo-50 text-indigo-600",
                  WORKER: "border-amber-200 bg-amber-50 text-amber-600",
                  EXTERNAL: "border-slate-200 bg-slate-100 text-slate-600",
                };
                const isSelected = form.role === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm({ ...form, role, owner_id: undefined })}
                    className={`py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider border-2 transition-all ${
                      isSelected
                        ? roleStyles[role]
                        : "border-border-theme/30 bg-app-bg text-subtitle/40 hover:border-border-theme/60"
                    }`}
                  >
                    {t.invitations.modal.roles[role]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Owner — only for EXTERNAL */}
          {form.role === "EXTERNAL" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
                {t.invitations.modal.owner_label} <span className="text-error">*</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 opacity-30 group-focus-within:text-brand group-focus-within:opacity-100 transition-all" />
                </div>
                <select
                  required
                  className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all text-sm appearance-none"
                  value={form.owner_id ?? ""}
                  onChange={(e) => setForm({ ...form, owner_id: e.target.value || undefined })}
                  disabled={loading}
                >
                  <option value="">{t.invitations.modal.owner_placeholder}</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full py-5 bg-brand text-white rounded-[20px] text-lg font-black shadow-xl shadow-brand/20 hover:bg-brand/90 active:scale-[0.99] transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.invitations.modal.sending}</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>{t.invitations.modal.submit}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
