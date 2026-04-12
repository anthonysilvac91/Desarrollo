"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "brand";
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  variant = "danger"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: "bg-error text-white hover:bg-error/90 shadow-error/20",
    warning: "bg-warning text-white hover:bg-warning/90 shadow-warning/20",
    brand: "bg-brand text-white hover:bg-brand/90 shadow-brand/20"
  };

  const iconStyles = {
    danger: "bg-error/10 text-error",
    warning: "bg-warning/10 text-warning",
    brand: "bg-brand/10 text-brand"
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-title/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-border-theme/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        
        {/* Header with Icon */}
        <div className="p-8 pb-0 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl ${iconStyles[variant]} flex items-center justify-center mb-6 ring-8 ring-white shadow-sm`}>
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black text-title tracking-tight mb-3">{title}</h3>
          <p className="text-subtitle/70 text-[15px] leading-relaxed font-medium px-4">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="p-8 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl text-sm font-black text-title bg-app-bg hover:bg-gray-100 transition-all border border-border-theme/40 active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-6 py-4 rounded-2xl text-sm font-black transition-all shadow-lg active:scale-95 ${variantStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>

        {/* Close Icon (Optional) */}
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
