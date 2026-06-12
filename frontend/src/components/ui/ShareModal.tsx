"use client";

import React, { useState } from "react";
import { X, Share2, Copy, Check } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  shareText: string;
  serviceTitle: string;
}

export default function ShareModal({ isOpen, onClose, shareUrl, shareText, serviceTitle }: ShareModalProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(serviceTitle)}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-title/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl border border-border-theme/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">

        <div className="p-8 pb-0 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-6 ring-8 ring-white shadow-sm">
            <Share2 className="w-8 h-8 text-brand" />
          </div>
          <h3 className="text-2xl font-black text-title tracking-tight mb-1">{t.common.share_modal.title}</h3>
          <p className="text-subtitle/60 text-sm font-medium">{serviceTitle}</p>
        </div>

        <div className="px-8 pt-6">
          <div className="flex items-center gap-2 bg-app-bg rounded-2xl border border-border-theme/40 px-4 py-3">
            <span className="flex-1 text-sm text-subtitle/70 font-medium truncate">{shareUrl}</span>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-black active:scale-95 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t.common.share_modal.copied : t.common.share_modal.copy}
            </button>
          </div>
        </div>

        <div className="px-8 pt-4 pb-8 grid grid-cols-2 gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-sm font-black active:scale-95 transition-all"
          >
            {t.common.share_modal.whatsapp}
          </a>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 text-[#2AABEE] text-sm font-black active:scale-95 transition-all"
          >
            {t.common.share_modal.telegram}
          </a>
        </div>

        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-subtitle/20 hover:text-subtitle/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
