"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, LoginFormData } from "@/types/schemas";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { authService } from "@/services/auth.service";
import { Loader2, Mail, Lock, Eye, EyeOff, Ship, Download } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";

export default function LoginPage() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isMobile, triggerInstall } = usePWA();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const response = await authService.login(data);
      login(response.access_token);
      // AuthContext handles redirection based on user role and device
    } catch (error: any) {
      console.error("Login Error:", error);
      const message = error.response?.data?.message || t.auth.login.error_invalid;
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-app-bg p-6">
      <div className="max-w-[440px] w-full animate-in fade-in zoom-in duration-500">
        
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-brand rounded-[22px] flex items-center justify-center shadow-lg shadow-brand/20 mb-6 group transition-transform hover:scale-105 active:scale-95">
            <Ship className="w-9 h-9 text-white stroke-[2.5px]" />
          </div>
          <h1 className="text-4xl font-black text-title tracking-tight mb-2">
            {t.auth.login.title}
          </h1>
          <p className="text-subtitle/60 font-bold text-sm tracking-wide uppercase">
            {t.auth.login.subtitle}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface rounded-figma p-8 lg:p-10 shadow-soft border border-border-theme/40">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.login.email_label}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("email")}
                  type="email"
                  className={`block w-full pl-14 pr-4 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.email ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.login.email_placeholder}
                  disabled={isSubmitting}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] font-bold text-error ml-1 animate-in fade-in slide-in-from-top-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest">
                  {t.auth.login.password_label}
                </label>
                <button 
                  type="button" 
                  className="text-[10px] font-black text-brand uppercase tracking-widest hover:opacity-70 transition-opacity"
                >
                  {t.auth.login.forgot_password}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  className={`block w-full pl-14 pr-14 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.password ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.login.password_placeholder}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-5 flex items-center text-subtitle/20 hover:text-brand transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] font-bold text-error ml-1 animate-in fade-in slide-in-from-top-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand text-white py-5 rounded-2xl font-black text-base shadow-xl shadow-brand/20 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:active:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.auth.login.signing_in}</span>
                </>
              ) : (
                <span>{t.auth.login.submit}</span>
              )}
            </button>
          </form>
        </div>

        {/* Install App Button (Mobile Only) */}
        {isMobile && (
          <div className="mt-6">
            <button
              onClick={triggerInstall}
              type="button"
              className="w-full flex items-center justify-center space-x-2 py-4 border-2 border-brand/20 bg-brand/5 text-brand rounded-2xl font-black text-sm active:scale-95 transition-all"
            >
              <Download className="w-5 h-5" />
              <span>Instalar app</span>
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-12 text-center">
          <p className="text-[11px] font-black text-subtitle opacity-30 uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} RECALL PLATFORM • MVP STAGE
          </p>
        </div>
      </div>
    </div>
  );
}
