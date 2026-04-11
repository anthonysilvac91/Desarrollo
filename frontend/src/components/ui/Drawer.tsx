"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  leftAction?: React.ReactNode; // Added optional left action (like expand)
  children: React.ReactNode;
}

export default function Drawer({ isOpen, onClose, title, leftAction, children }: DrawerProps) {
  // Handle Escape key
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

  return (
    <div className={`fixed inset-0 z-50 transition-visibility duration-300 ${isOpen ? "visible" : "invisible"}`}>
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-title/20 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div 
        className={`absolute top-0 right-0 h-full w-full max-w-md sm:max-w-lg bg-white shadow-[-20px_0_50px_-15px_rgba(0,0,0,0.1)] transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Buttons Group */}
        <div className="absolute top-8 left-8 right-8 z-10 flex items-center justify-between">
          {/* Left Action (e.g. Expand) */}
          <div className="flex-1">
            {leftAction}
          </div>

          {/* Close Button ("X") */}
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-gray-100 text-subtitle/40 hover:text-title transition-all group shrink-0"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto custom-scroll pt-4">
          {children}
        </div>
      </div>
    </div>
  );
}
