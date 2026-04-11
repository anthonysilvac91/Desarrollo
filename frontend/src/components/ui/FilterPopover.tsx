"use client";

import React, { useRef, useEffect } from "react";
import { X, Check } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface FilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  clients: string[];
  categories: string[];
  selectedClients: string[];
  selectedCategories: string[];
  onToggleClient: (client: string) => void;
  onToggleCategory: (category: string) => void;
  onClearAll: () => void;
}

export default function FilterPopover({
  isOpen,
  onClose,
  clients,
  categories,
  selectedClients,
  selectedCategories,
  onToggleClient,
  onToggleCategory,
  onClearAll,
}: FilterPopoverProps) {
  const { t } = useLanguage();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={popoverRef}
      className="absolute top-full right-0 mt-3 w-72 bg-white rounded-2xl border border-border-theme/60 shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-black text-title uppercase tracking-widest">{t.assets.filter}</span>
          <button 
            onClick={onClearAll}
            className="text-[11px] font-bold text-brand hover:underline transition-all"
          >
            {t.assets.filters.clear_all}
          </button>
        </div>

        {/* Section: By Client */}
        <div className="space-y-4">
          <h4 className="text-[11px] font-black text-subtitle/40 uppercase tracking-[0.15em]">
            {t.assets.filters.by_client}
          </h4>
          <div className="flex flex-col space-y-2 max-h-40 overflow-y-auto custom-scroll pr-2">
            {clients.map((client) => {
              const isActive = selectedClients.includes(client);
              return (
                <button
                  key={client}
                  onClick={() => onToggleClient(client)}
                  className="flex items-center justify-between group"
                >
                  <span className={`text-[13.5px] font-semibold transition-colors ${isActive ? "text-title" : "text-subtitle hover:text-title"}`}>
                    {client}
                  </span>
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isActive ? "bg-brand border-brand text-white" : "border-border-theme bg-gray-50/50 group-hover:border-brand/40"
                  }`}>
                    {isActive && <Check className="w-3 h-3 stroke-[4px]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section: By Category */}
        <div className="space-y-4">
          <h4 className="text-[11px] font-black text-subtitle/40 uppercase tracking-[0.15em]">
            {t.assets.filters.by_category}
          </h4>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const isActive = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  onClick={() => onToggleCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all border ${
                    isActive 
                      ? "bg-brand/10 border-brand/20 text-brand" 
                      : "bg-gray-50 border-transparent text-subtitle/60 hover:border-border-theme hover:text-title"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
