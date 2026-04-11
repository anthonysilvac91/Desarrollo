"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-title/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Content Card */}
      <div 
        className="relative bg-white w-full max-w-[560px] rounded-[32px] shadow-2xl shadow-title/10 overflow-hidden transform transition-all animate-in zoom-in-95 fade-in duration-300"
      >
        {/* Header */}
        <div className="px-10 pt-10 pb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black text-title tracking-tight">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-gray-100 text-subtitle/40 hover:text-title transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-10 pb-10">
          {children}
        </div>
      </div>
    </div>
  );
}
