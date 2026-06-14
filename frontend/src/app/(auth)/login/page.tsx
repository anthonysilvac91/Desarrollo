"use client";

import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoginFormData } from "@/types/schemas";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { authService } from "@/services/auth.service";
import { Loader2, Mail, Lock, Eye, EyeOff, Download, Share, PlusSquare } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import Link from "next/link";

export default function LoginPage() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [temporaryToken, setTemporaryToken] = useState<string | null>(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'app' | 'email'>('app');
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const { shouldShowInstallButton, shouldShowIOSInstructions, triggerInstall } = usePWA();
  const loginSchema = z.object({
    email: z.string().email(t.auth.validation.invalid_email),
    password: z.string().min(6, t.auth.validation.password_min),
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const response = await authService.login(data);
      if ("requires_2fa" in response && response.requires_2fa) {
        setTemporaryToken(response.temporary_token);
        setTwoFactorMethod(response.method);
        if (response.method === 'email') {
          try {
            await authService.requestTwoFactorEmailCode(response.temporary_token);
            showToast(t.auth.login.two_factor_email_required, "info");
          } catch {
            showToast(t.auth.login.two_factor_email_required, "info");
          }
        } else {
          showToast(t.auth.login.two_factor_required, "info");
        }
        return;
      }
      login(response.access_token);
      // AuthContext handles redirection based on user role and device
    } catch (error: unknown) {
      console.error("Login Error:", error);
      const message =
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
          ? error.response.data.message
          : t.auth.login.error_invalid;
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTwoFactorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!temporaryToken || !twoFactorCode.trim()) return;
    setIsSubmitting(true);
    try {
      const response = twoFactorMethod === 'email'
        ? await authService.loginWithEmailCode(temporaryToken, twoFactorCode)
        : await authService.loginWithTwoFactor(temporaryToken, twoFactorCode);
      login(response.access_token);
    } catch (error: unknown) {
      const message =
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
          ? error.response.data.message
          : t.auth.login.two_factor_invalid;
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmailCode = async () => {
    if (!temporaryToken) return;
    setIsSubmitting(true);
    try {
      await authService.requestTwoFactorEmailCode(temporaryToken);
      showToast(t.auth.login.two_factor_email_required, "info");
    } catch {
      showToast(t.auth.login.two_factor_invalid, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-app-bg p-6">
      <div className="max-w-[440px] w-full animate-in fade-in zoom-in duration-500">
        
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-10 text-center">
          <img
            src="/brand/logo.png"
            alt="Fentri"
            className="h-36 w-auto mb-4 object-contain"
            draggable={false}
          />
          <p className="text-subtitle/60 font-bold text-sm tracking-wide uppercase">
            {t.auth.login.subtitle}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface rounded-figma p-8 lg:p-10 shadow-soft border border-border-theme/40">
          {temporaryToken ? (
            <form onSubmit={handleTwoFactorSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
                  {t.auth.login.two_factor_label}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                  </div>
                  <input
                    value={twoFactorCode}
                    onChange={(event) => setTwoFactorCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="block w-full pl-14 pr-4 py-4 border rounded-2xl bg-app-bg text-title font-bold tracking-[0.3em] placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all border-border-theme/40"
                    placeholder="000000"
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
                <p className="text-xs font-semibold text-subtitle/50 ml-1">
                  {twoFactorMethod === 'email' ? t.auth.login.two_factor_email_help : t.auth.login.two_factor_help}
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !twoFactorCode.trim()}
                className="w-full bg-brand text-white py-5 rounded-2xl font-black text-base shadow-xl shadow-brand/20 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:active:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t.auth.login.two_factor_verifying}</span>
                  </>
                ) : (
                  <span>{t.auth.login.two_factor_submit}</span>
                )}
              </button>

              {twoFactorMethod === 'email' && (
                <button
                  type="button"
                  onClick={handleResendEmailCode}
                  disabled={isSubmitting}
                  className="w-full text-xs font-black text-brand/60 uppercase tracking-widest hover:text-brand transition-colors disabled:opacity-40"
                >
                  {t.auth.login.two_factor_email_resend}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setTemporaryToken(null);
                  setTwoFactorCode("");
                }}
                className="w-full text-xs font-black text-subtitle/40 uppercase tracking-widest hover:text-brand transition-colors"
              >
                {t.auth.login.two_factor_back}
              </button>
            </form>
          ) : (
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
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ""}
                      type="email"
                      className={`block w-full pl-14 pr-4 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                        errors.email ? "border-error/40" : "border-border-theme/40"
                      }`}
                      placeholder={t.auth.login.email_placeholder}
                      disabled={isSubmitting}
                    />
                  )}
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
                <Link
                  href="/forgot-password"
                  className="text-[10px] font-black text-brand uppercase tracking-widest hover:opacity-70 transition-opacity"
                >
                  {t.auth.login.forgot_password}
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-subtitle/30 group-focus-within:text-brand transition-colors" />
                </div>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ""}
                      type={showPassword ? "text" : "password"}
                      className={`block w-full pl-14 pr-14 py-4 border rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all ${
                        errors.password ? "border-error/40" : "border-border-theme/40"
                      }`}
                      placeholder={t.auth.login.password_placeholder}
                      disabled={isSubmitting}
                    />
                  )}
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
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-[11px] font-black text-subtitle/40 uppercase tracking-widest">
            {t.auth.signup.login_prompt}{" "}
            <Link href="/signup" className="text-brand hover:opacity-70 transition-opacity">
              {t.auth.signup.login_link}
            </Link>
          </p>
        </div>

        {shouldShowInstallButton && (
          <div className="mt-6">
            <button
              onClick={triggerInstall}
              type="button"
              className="w-full flex items-center justify-center space-x-2 py-4 border-2 border-brand/20 bg-brand/5 text-brand rounded-2xl font-black text-sm active:scale-95 transition-all"
            >
              <Download className="w-5 h-5" />
              <span>{t.auth.login.install_app}</span>
            </button>
          </div>
        )}

        {shouldShowIOSInstructions && (
          <div className="mt-6 rounded-2xl border-2 border-brand/20 bg-brand/5 p-4 text-brand">
            <div className="flex items-start gap-3">
              <Share className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-black">{t.auth.login.install_ios_title}</p>
                <p className="mt-1 text-xs font-bold text-brand/80">
                  {t.auth.login.install_ios_message}
                </p>
              </div>
              <PlusSquare className="mt-0.5 h-5 w-5 flex-shrink-0" />
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-12 text-center">
          <p className="text-[11px] font-black text-subtitle opacity-30 uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} {t.auth.login.footer}
          </p>
        </div>
      </div>
    </div>
  );
}
