"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

export interface RelationshipDeleteOption {
  value: string;
  title: string;
  description: string;
}

interface RelationshipDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  options: RelationshipDeleteOption[];
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  confirmText: string;
  cancelText: string;
}

export default function RelationshipDeleteModal({
  isOpen,
  title,
  description,
  options,
  value,
  onChange,
  onClose,
  onConfirm,
  confirmText,
  cancelText,
}: RelationshipDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-title/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-border-theme/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="p-8 pb-5 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-error/10 text-error flex items-center justify-center mb-6 ring-8 ring-white shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black text-title tracking-tight mb-3">{title}</h3>
          <p className="text-subtitle/70 text-[15px] leading-relaxed font-medium px-4">
            {description}
          </p>
        </div>

        <div className="px-8 pb-2 space-y-3">
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={`w-full flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                  selected
                    ? "border-error/40 bg-error/5"
                    : "border-border-theme/40 bg-app-bg/40 hover:border-error/20 hover:bg-error/5"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-error bg-error" : "border-subtitle/20 bg-white"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-title">{option.title}</span>
                  <span className="mt-1 block text-xs font-semibold leading-relaxed text-subtitle/60">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

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
            className="flex-1 px-6 py-4 rounded-2xl text-sm font-black transition-all shadow-lg active:scale-95 bg-error text-white hover:bg-error/90 shadow-error/20"
          >
            {confirmText}
          </button>
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
