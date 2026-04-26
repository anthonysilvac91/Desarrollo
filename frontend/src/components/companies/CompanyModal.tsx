"use client";

import React, { useState, useEffect } from "react";
import { X, Building2, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { companiesService, CompanyFormData } from "@/services/companies.service";

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyToEdit?: any;
}

export default function CompanyModal({ isOpen, onClose, onSuccess, companyToEdit }: CompanyModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<CompanyFormData>({
    name: "",
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (companyToEdit) {
        setFormData({
          name: companyToEdit.name || "",
          is_active: companyToEdit.is_active ?? true,
        });
      } else {
        setFormData({ name: "", is_active: true });
      }
    }
  }, [isOpen, companyToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (companyToEdit) {
        await companiesService.update(companyToEdit.id, formData);
        showToast(t.clients.states.update_success, "success");
      } else {
        await companiesService.create(formData);
        showToast(t.clients.states.save_success, "success");
      }
      onSuccess();
      onClose();
    } catch {
      showToast(t.clients.states.save_error, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 max-h-[90vh] flex flex-col">
        <div className="px-8 pt-10 pb-6 flex justify-between items-center border-b border-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black text-title tracking-tight">
              {companyToEdit ? t.clients.modal.title_edit : t.clients.modal.title_new}
            </h2>
            <p className="text-subtitle/50 text-xs font-bold uppercase tracking-widest mt-1">
              {t.clients.modal.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
              {t.clients.modal.full_name} <span className="text-error">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-brand">
                <Building2 className="h-5 w-5 opacity-30" />
              </div>
              <input
                required
                type="text"
                className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm"
                placeholder={t.clients.modal.name_placeholder}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1 py-2">
            <div>
              <p className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em]">
                {t.clients.table.status}
              </p>
              <p className="text-sm font-bold text-title mt-0.5">
                {formData.is_active ? t.common.active : t.common.inactive}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className="transition-colors"
              aria-label="Toggle status"
            >
              {formData.is_active
                ? <ToggleRight className="w-10 h-10 text-brand" />
                : <ToggleLeft className="w-10 h-10 text-subtitle/30" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.name.trim()}
            className="w-full py-5 bg-brand text-white rounded-[20px] text-lg font-black shadow-xl shadow-brand/20 hover:bg-brand/90 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="w-6 h-6 animate-spin" />
              : (companyToEdit ? t.clients.modal.submit_edit : t.clients.modal.submit)}
          </button>
        </form>
      </div>
    </div>
  );
}
