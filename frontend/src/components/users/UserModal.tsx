"use client";

import React, { useState, useEffect } from "react";
import { X, User, Mail, Building2, Eye, EyeOff, ChevronDown, Loader2, Camera } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { usersService } from "@/services/users.service";
import { companiesService } from "@/services/companies.service";

export interface UserFormData {
  name: string;
  email: string;
  company_id: string;
  role: string;
  password?: string;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingCompanies?: string[];
  userToEdit?: any | null;
}

export default function UserModal({ isOpen, onClose, onSuccess, existingCompanies = [], userToEdit }: UserModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const isEditMode = !!userToEdit;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company_id: "",
    role: "WORKER",
    password: ""
  });

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      companiesService.findAll().then((data: any) => {
        const list = Array.isArray(data) ? data : data.data || [];
        setCompanies(list);
      }).catch(() => {});

      if (userToEdit) {
        setFormData({
          name: userToEdit.name || "",
          email: userToEdit.email || "",
          company_id: userToEdit.company_id || userToEdit.customer_id || "",
          role: userToEdit.role || "WORKER",
          password: ""
        });
        setAvatarFile(null);
        setAvatarPreview(userToEdit.avatar_url || null);
      } else {
        setFormData({ name: "", email: "", company_id: "", role: "WORKER", password: "" });
        setAvatarFile(null);
        setAvatarPreview(null);
      }
    }
  }, [isOpen, userToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditMode) {
        const payload = new FormData();
        payload.append("name", formData.name);
        payload.append("email", formData.email);
        if (avatarFile) {
          payload.append("avatar", avatarFile);
        }
        await usersService.update(userToEdit.id, payload);
        showToast(t.users.states.update_success, "success");
      } else {
        const payload: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
        };
        if (formData.company_id) payload.company_id = formData.company_id;
        await usersService.create(payload);
        showToast(t.users.states.invite_success, "success");
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.message)
          ? error.response.data.message.join(", ")
          : null);
      showToast(
        backendMsg || (isEditMode ? t.users.states.error_update : t.users.states.error_invite),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const userInitials = (formData.name || userToEdit?.name || "U")
    .split(" ")
    .map((chunk: string) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 max-h-[90vh] flex flex-col">
        <div className="px-8 pt-10 pb-6 flex justify-between items-center border-b border-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black text-title tracking-tight">
              {isEditMode ? t.users.modal.title_edit : t.users.modal.title}
            </h2>
            <p className="text-subtitle/50 text-xs font-bold uppercase tracking-widest mt-1">{t.users.modal.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
          {isEditMode && (
            <div className="flex justify-center">
              <div className="relative group">
                <div className="w-28 h-28 rounded-[32px] bg-brand/5 border border-border-theme/40 flex items-center justify-center overflow-hidden shadow-sm">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-brand">{userInitials}</span>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 bg-brand text-white p-3 rounded-2xl shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAvatarFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setAvatarPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.full_name}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-brand">
                <User className="h-5 w-5 opacity-30" />
              </div>
              <input
                required
                type="text"
                className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm"
                placeholder={t.users.modal.full_name_placeholder}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.email}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-brand">
                <Mail className="h-5 w-5 opacity-30" />
              </div>
              <input
                required
                type="email"
                className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm"
                placeholder={t.users.modal.email_placeholder}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          {!isEditMode && formData.role === "CLIENT" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.company}</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-brand">
                  <Building2 className="h-5 w-5 opacity-30" />
                </div>
                <select
                  required
                  className="block w-full pl-14 pr-10 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm appearance-none"
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                >
                  <option value="" disabled>Selecciona una empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-subtitle/50" />
                </div>
              </div>
            </div>
          )}

          {!isEditMode && (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.role}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  className="w-full px-6 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold text-sm flex items-center justify-between focus:outline-none focus:border-brand transition-all"
                >
                  <span>{formData.role}</span>
                  <ChevronDown className={`w-4 h-4 text-subtitle transition-transform duration-300 ${isRoleDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isRoleDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsRoleDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border-theme/40 rounded-2xl shadow-2xl z-20 py-2 animate-in fade-in zoom-in-95 duration-200">
                      {[
                        { id: "ADMIN", label: "Administrador" },
                        { id: "WORKER", label: "Operador/Trabajador" },
                        { id: "CLIENT", label: "Usuario Final" }
                      ].map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, role: role.id });
                            setIsRoleDropdownOpen(false);
                          }}
                          className={`w-full px-6 py-3 text-left text-sm font-bold transition-colors hover:bg-brand/5 ${
                            formData.role === role.id ? "text-brand bg-brand/5" : "text-title/70"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{role.label}</span>
                            {formData.role === role.id && <div className="w-1.5 h-1.5 rounded-full bg-brand" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {!isEditMode && (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.password}</label>
              <div className="relative group">
                <input
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  className="block w-full px-6 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:border-brand transition-all text-sm"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-6 flex items-center text-subtitle/30 hover:text-brand transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {formData.password.length > 0 && formData.password.length < 8 && (
                <p className="text-[11px] font-bold text-error/70 ml-1">
                  Minimum 8 characters ({formData.password.length}/8)
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-brand text-white rounded-[20px] text-lg font-black shadow-xl shadow-brand/20 hover:bg-brand/90 hover:scale-[1.01] active:scale-[0.99] transition-all mt-4 flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isEditMode ? t.users.modal.submit_edit : t.users.modal.submit)}
          </button>
        </form>
      </div>
    </div>
  );
}
