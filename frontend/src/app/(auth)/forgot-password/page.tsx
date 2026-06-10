"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ForgotPasswordFormData } from "@/types/schemas";
import { useLanguage } from "@/lib/LanguageContext";
import { authService } from "@/services/auth.service";
import { Loader2, Mail, Ship, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const forgotPasswordSchema = z.object({
    email: z.string().email(t.auth.validation.invalid_email),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(data.email);
      setSent(true);
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
            {t.auth.forgot_password.title}
          </h1>
          <p className="text-subtitle/60 font-bold text-sm text-center px-4">
            {t.auth.forgot_password.subtitle}
          </p>
        </div>

        <div className="bg-surface rounded-figma p-8 lg:p-10 shadow-soft border border-border-theme/40">
          {sent ? (
            <div className="flex flex-col items-center text-center py-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-title mb-1">{t.auth.forgot_password.success_title}</h2>
                <p className="text-sm font-medium text-subtitle/60">{t.auth.forgot_password.success_message}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                  {t.auth.forgot_password.email_label}
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
                    placeholder={t.auth.forgot_password.email_placeholder}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] font-bold text-error ml-1 animate-in fade-in slide-in-from-top-1">
                    {errors.email.message}
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
                    <span>{t.auth.forgot_password.sending}</span>
                  </>
                ) : (
                  <span>{t.auth.forgot_password.submit}</span>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center space-x-2 text-[11px] font-black text-subtitle/40 uppercase tracking-widest hover:text-brand transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.auth.forgot_password.back_to_login}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
