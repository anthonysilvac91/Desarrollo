"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, SlidersHorizontal, ChevronDown, RotateCcw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface FiltersBarProps {
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  // Filter Props
  onDateChange?: (preset: string, start?: string, end?: string) => void;
  // Visibility Controls
  showQuickFilters?: boolean;
  showSearch?: boolean;
  // Others
  actions?: React.ReactNode;
}

export default function FiltersBar({
  searchPlaceholder,
  onSearchChange,
  onDateChange,
  showQuickFilters = false,
  showSearch = true,
  actions,
}: FiltersBarProps) {
  const { t } = useLanguage();
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsRangePickerOpen(false);
      }
    }
    
    if (isRangePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRangePickerOpen]);

  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    if (preset !== "Personalizado") {
      setIsRangePickerOpen(false);
      onDateChange?.(preset);
    } else {
      setIsRangePickerOpen(!isRangePickerOpen);
    }
  };

  const handleCustomDateChange = (field: "start" | "end", value: string) => {
    const newRange = { ...customRange, [field]: value };
    setCustomRange(newRange);
    if (newRange.start && newRange.end) {
      onDateChange?.("Personalizado", newRange.start, newRange.end);
    }
  };

  const clearDateFilter = () => {
    setActivePreset(null);
    setIsRangePickerOpen(false);
    onDateChange?.("Todo");
  };

  return (
    <div className="px-0 py-0 flex flex-col lg:flex-row items-start lg:items-center gap-5 shrink-0 transition-colors">
      
      {/* Search Input */}
      {showSearch && (
        <div className="relative w-full lg:w-[320px]">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-subtitle opacity-30" aria-hidden="true" />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-4 py-3.5 border border-border-theme/60 rounded-2xl leading-5 bg-white text-title placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand sm:text-sm transition-all shadow-sm font-medium"
            placeholder={searchPlaceholder || t.assets.search_placeholder}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      )}

      <div className="flex-1" />

      {/* Quick Filters + Actions */}
      <div className="flex items-center space-x-4 w-full lg:w-auto justify-end relative">
        {showQuickFilters && (
          <div className="flex items-center gap-2">
            
            {/* Discrete Reset Button */}
            {activePreset && (
              <button 
                onClick={clearDateFilter}
                className="p-2 text-subtitle/30 hover:text-brand hover:bg-brand/5 rounded-full transition-all animate-in fade-in zoom-in duration-200"
                title="Limpiar filtros"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <div className="relative flex items-center bg-subtitle/5 p-1 rounded-full border border-border-theme/30">
              {["Hoy", "Mes", "Año", "Personalizado"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  className={`px-6 py-3 rounded-full text-[15px] font-bold transition-all duration-200 ${
                    activePreset === preset
                      ? "bg-white text-brand shadow-md shadow-brand/5 ring-1 ring-black/5"
                      : "text-subtitle/50 hover:text-subtitle"
                  }`}
                >
                  {preset === "Hoy" ? t.date_filters.today : 
                   preset === "Mes" ? t.date_filters.month : 
                   preset === "Año" ? t.date_filters.year : 
                   t.date_filters.custom}
                </button>
              ))}

              {/* Range Picker Popover */}
              {isRangePickerOpen && (
                <div 
                  ref={popoverRef}
                  className="absolute top-full right-0 mt-3 p-5 bg-white rounded-3xl border border-border-theme/60 shadow-2xl z-50 min-w-[320px] animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                      <label className="text-[12px] font-black text-brand uppercase tracking-wider ml-1">{t.date_filters.from}</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-3 bg-app-bg border border-border-theme/40 rounded-xl text-sm font-bold text-title focus:outline-none focus:border-brand transition-all"
                        value={customRange.start}
                        onChange={(e) => handleCustomDateChange("start", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-black text-brand uppercase tracking-wider ml-1">{t.date_filters.to}</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-3 bg-app-bg border border-border-theme/40 rounded-xl text-sm font-bold text-title focus:outline-none focus:border-brand transition-all"
                        value={customRange.end}
                        onChange={(e) => handleCustomDateChange("end", e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => setIsRangePickerOpen(false)}
                      className="mt-2 w-full py-3 bg-brand text-white rounded-xl text-sm font-black hover:bg-brand/90 transition-all"
                    >
                      {t.date_filters.apply}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {actions && <div className="flex items-center">{actions}</div>}
      </div>
    </div>
  );
}
