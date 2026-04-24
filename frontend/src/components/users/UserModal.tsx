"use client";

import React, { useState } from "react";
import { X, User, Mail, Building2, Eye, EyeOff, ChevronDown, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { usersService } from "@/services/users.service";

export interface UserFormData {
  name: string;
  email: string;
  company: string;
  role: string;
  password?: string;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingCompanies?: string[];
}

export default function UserModal({ isOpen, onClose, onSuccess, existingCompanies = [] }: UserModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    role: "WORKER",
    password: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersService.create(formData);
      showToast(t.users.states.invite_success, "success");
      onSuccess();
      onClose();
    } catch (error) {
      showToast(t.users.states.error, "error");
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
      
      <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="px-8 pt-10 pb-6 flex justify-between items-center border-b border-gray-50">
          <div>
            <h2 className="text-2xl font-black text-title tracking-tight">{t.users.modal.title}</h2>
            <p className="text-subtitle/50 text-xs font-bold uppercase tracking-widest mt-1">{t.users.modal.subtitle}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
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

          <div className="space-y-2">
            <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.company}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-brand">
                <Building2 className="h-5 w-5 opacity-30" />
              </div>
              <input
                required
                type="text"
                autoComplete="off"
                className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm"
                placeholder={t.users.modal.company_placeholder}
                value={formData.company}
                onFocus={() => setIsCompanyDropdownOpen(true)}
                onChange={(e) => {
                  setFormData({ ...formData, company: e.target.value });
                  setIsCompanyDropdownOpen(true);
                }}
              />
              
              {isCompanyDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsCompanyDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border-theme/40 rounded-2xl shadow-2xl z-20 py-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    {existingCompanies.filter(c => c.toLowerCase().includes(formData.company.toLowerCase())).map((company, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, company });
                          setIsCompanyDropdownOpen(false);
                        }}
                        className="w-full px-6 py-3 text-left text-sm font-bold text-title/70 hover:bg-brand/5 hover:text-brand transition-colors"
                      >
                        {company}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

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
                      { id: "CLIENT", label: "Cliente Final" }
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

          <div className="space-y-2">
            <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.password}</label>
            <div className="relative group">
              <input
                required
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
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-brand text-white rounded-[20px] text-lg font-black shadow-xl shadow-brand/20 hover:bg-brand/90 hover:scale-[1.01] active:scale-[0.99] transition-all mt-4 flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t.users.modal.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
