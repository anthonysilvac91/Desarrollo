"use client";

import React, { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ResetPasswordFormData } from "@/types/schemas";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { authService } from "@/services/auth.service";
import { Loader2, Lock, Eye, EyeOff, Ship, AlertCircle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordContent() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const resetPasswordSchema = z.object({
    password: z.string().min(6, t.auth.validation.password_min),
    confirm: z.string().min(6, t.auth.validation.password_min),
  }).refine((data) => data.password === data.confirm, {
    message: t.auth.validation.passwords_mismatch,
    path: ["confirm"],
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirm: "",
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-app-bg p-6">
        <div className="max-w-[440px] w-full text-center space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="p-4 bg-error/10 rounded-full w-fit mx-auto">
            <AlertCircle className="w-8 h-8 text-error" />
          </div>
          <h2 className="text-xl font-black text-title">{t.auth.reset_password.error_invalid_token}</h2>
          <Link href="/forgot-password" className="inline-block text-brand font-black text-sm uppercase tracking-widest">
            {t.auth.forgot_password.submit}
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, data.password);
      showToast(t.auth.reset_password.success, "success");
      router.push("/login");
    } catch {
      showToast(t.auth.reset_password.error_invalid_token, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-app-bg p-6">
      <div className="max-w-[440px] w-full animate-in fade-in zoom-in duration-500">

        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-brand rounded-[22px] flex items-center justify-center shadow-lg shadow-brand/20 mb-6">
            <Ship className="w-9 h-9 text-white stroke-[2.5px]" />
          </div>
          <h1 className="text-4xl font-black text-title tracking-tight mb-2">
            {t.auth.reset_password.title}
          </h1>
          <p className="text-subtitle/60 font-bold text-sm">
            {t.auth.reset_password.subtitle}
          </p>
        </div>

        <div className="bg-surface rounded-figma p-8 lg:p-10 shadow-soft border border-border-theme/40">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* New Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.reset_password.password_label}
              </label>
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
                  placeholder={t.auth.reset_password.password_placeholder}
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

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.reset_password.confirm_label}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("confirm")}
                  type={showConfirm ? "text" : "password"}
                  className={`block w-full pl-14 pr-14 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.confirm ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.reset_password.confirm_placeholder}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-5 flex items-center text-subtitle/20 hover:text-brand transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirm && (
                <p className="text-[11px] font-bold text-error ml-1 animate-in fade-in slide-in-from-top-1">
                  {errors.confirm.message}
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
                  <span>{t.auth.reset_password.resetting}</span>
                </>
              ) : (
                <span>{t.auth.reset_password.submit}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center bg-app-bg"><Loader2 className="w-8 h-8 text-brand animate-spin" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
