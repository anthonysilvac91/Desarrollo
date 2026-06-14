"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import { authService } from "@/services/auth.service";
import { Building2, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const signupSchema = z.object({
    organization_name: z.string().trim().min(1, t.auth.signup.validation_organization),
    admin_name: z.string().trim().min(1, t.auth.signup.validation_admin_name),
    email: z.string().email(t.auth.validation.invalid_email),
    password: z.string().min(6, t.auth.validation.password_min),
    confirm: z.string().min(6, t.auth.validation.password_min),
  }).refine((data) => data.password === data.confirm, {
    message: t.auth.validation.passwords_mismatch,
    path: ["confirm"],
  });

  type SignupFormData = z.infer<typeof signupSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      organization_name: "",
      admin_name: "",
      email: "",
      password: "",
      confirm: "",
    },
  });

  const getServerMessage = (error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof error.response === "object" &&
      error.response !== null &&
      "data" in error.response &&
      typeof error.response.data === "object" &&
      error.response.data !== null &&
      "message" in error.response.data &&
      typeof error.response.data.message === "string"
    ) {
      return error.response.data.message;
    }

    return t.auth.signup.error_generic;
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      const response = await authService.registerOrganization({
        organization_name: data.organization_name.trim(),
        admin_name: data.admin_name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });
      login(response.access_token);
    } catch (error: unknown) {
      showToast(getServerMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-app-bg p-6">
      <div className="max-w-[480px] w-full animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-10 text-center">
          <img src="/brand/isotipo.png" alt="Fentri" className="h-14 w-auto object-contain mb-2" draggable={false} />
          <h1 className="text-4xl font-black text-title tracking-tight mb-2">
            {t.auth.signup.title}
          </h1>
          <p className="text-subtitle/60 font-bold text-sm tracking-wide uppercase">
            {t.auth.signup.subtitle}
          </p>
        </div>

        <div className="bg-surface rounded-figma p-8 lg:p-10 shadow-soft border border-border-theme/40">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.signup.organization_label}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("organization_name")}
                  type="text"
                  autoComplete="organization"
                  className={`block w-full pl-14 pr-4 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.organization_name ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.signup.organization_placeholder}
                  disabled={isSubmitting}
                />
              </div>
              {errors.organization_name && (
                <p className="text-[11px] font-bold text-error ml-1 animate-in fade-in slide-in-from-top-1">
                  {errors.organization_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.signup.admin_name_label}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("admin_name")}
                  type="text"
                  autoComplete="name"
                  className={`block w-full pl-14 pr-4 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.admin_name ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.signup.admin_name_placeholder}
                  disabled={isSubmitting}
                />
              </div>
              {errors.admin_name && (
                <p className="text-[11px] font-bold text-error ml-1 animate-in fade-in slide-in-from-top-1">
                  {errors.admin_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.signup.email_label}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  className={`block w-full pl-14 pr-4 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.email ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.signup.email_placeholder}
                  disabled={isSubmitting}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] font-bold text-error ml-1 animate-in fade-in slide-in-from-top-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.signup.password_label}
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
                  placeholder={t.auth.signup.password_placeholder}
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

            <div className="space-y-2">
              <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                {t.auth.signup.confirm_label}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  {...register("confirm")}
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className={`block w-full pl-14 pr-14 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                    errors.confirm ? "border-error/40" : "border-border-theme/40"
                  }`}
                  placeholder={t.auth.signup.confirm_placeholder}
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
                  <span>{t.auth.signup.creating}</span>
                </>
              ) : (
                <span>{t.auth.signup.submit}</span>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[11px] font-black text-subtitle/40 uppercase tracking-widest">
            {t.auth.signup.already_have_account}{" "}
            <Link href="/login" className="text-brand hover:opacity-70 transition-opacity">
              {t.auth.signup.back_to_login}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
