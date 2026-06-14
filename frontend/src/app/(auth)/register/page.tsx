"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema, RegisterFormData } from "@/types/schemas";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import { authService } from "@/services/auth.service";
import { Loader2, User, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface InvitationData {
  email: string;
  role: string;
  organization_name: string;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center bg-app-bg"><Loader2 className="w-8 h-8 text-brand animate-spin" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [validating, setValidating] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  });

  useEffect(() => {
    if (!token) { setTokenError(true); setValidating(false); return; }
    authService.validateInvitation(token)
      .then(setInvitation)
      .catch(() => setTokenError(true))
      .finally(() => setValidating(false));
  }, [token]);

  const onSubmit = async (data: RegisterFormData) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const response = await authService.register(token, data.name, data.password);
      login(response.access_token);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t.auth.register.error_invalid_token;
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-app-bg">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  if (tokenError || !invitation) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-app-bg p-6">
        <div className="max-w-[440px] w-full text-center space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="p-4 bg-error/10 rounded-full w-fit mx-auto">
            <AlertCircle className="w-8 h-8 text-error" />
          </div>
          <h2 className="text-xl font-black text-title">{t.auth.register.error_invalid_token}</h2>
          <Link href="/login" className="inline-block text-brand font-black text-sm uppercase tracking-widest">
            {t.auth.forgot_password.back_to_login}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-app-bg p-6">
      <div className="max-w-[440px] w-full animate-in fade-in zoom-in duration-500">

        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-10 text-center">
          <img src="/brand/isotipo.png" alt="Fentri" className="h-14 w-auto object-contain mb-2" draggable={false} />
          <h1 className="text-4xl font-black text-title tracking-tight mb-2">
            {t.auth.register.title}
          </h1>
          <p className="text-subtitle/60 font-bold text-sm">
            {t.auth.register.subtitle} <span className="text-brand">{invitation.organization_name}</span>
          </p>
        </div>

        <div className="bg-surface rounded-figma p-8 lg:p-10 shadow-soft border border-border-theme/40">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Email (read-only) */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.register.email_label}
              </label>
              <div className="px-5 py-4 bg-app-bg border border-border-theme/40 rounded-2xl text-title font-bold opacity-60 select-none">
                {invitation.email}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.register.name_label}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("name")}
                  type="text"
                  autoComplete="name"
                  className={`block w-full pl-14 pr-4 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.name ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.register.name_placeholder}
                  disabled={isSubmitting}
                />
              </div>
              {errors.name && (
                <p className="text-[11px] font-bold text-error ml-1 animate-in fade-in slide-in-from-top-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.register.password_label}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`block w-full pl-14 pr-14 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.password ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.register.password_placeholder}
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand text-white py-5 rounded-2xl font-black text-base shadow-xl shadow-brand/20 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:active:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.auth.register.creating}</span>
                </>
              ) : (
                <span>{t.auth.register.submit}</span>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-[11px] font-black text-subtitle/30 uppercase tracking-widest hover:text-brand transition-colors"
          >
            {t.auth.forgot_password.back_to_login}
          </Link>
        </div>
      </div>
    </div>
  );
}
