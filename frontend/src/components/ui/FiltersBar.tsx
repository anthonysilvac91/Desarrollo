"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, RotateCcw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface FiltersBarProps {
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  // Filter Props
  onDateChange?: (preset: string, start?: string, end?: string) => void;
  // Visibility Controls
  showQuickFilters?: boolean;
  showSearch?: boolean;
  // Clear all
  hasExternalFilter?: boolean;
  onClearAll?: () => void;
  defaultDatePreset?: string | null;
  // Others
  actions?: React.ReactNode;
}

export default function FiltersBar({
  searchPlaceholder,
  onSearchChange,
  onDateChange,
  showQuickFilters = false,
  showSearch = true,
  hasExternalFilter = false,
  onClearAll,
  defaultDatePreset = null,
  actions,
}: FiltersBarProps) {
  const { t } = useLanguage();
  const [searchValue, setSearchValue] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(defaultDatePreset);
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasAnyFilter = !!searchValue || !!activePreset || hasExternalFilter;

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
    setCustomRange({ start: "", end: "" });
    setIsRangePickerOpen(false);
    onDateChange?.("Todo");
  };

  const handleClearAll = () => {
    setSearchValue("");
    onSearchChange?.("");
    clearDateFilter();
    onClearAll?.();
  };

  return (
    <div className="px-0 py-0 flex flex-col lg:flex-row items-start lg:items-center gap-5 shrink-0 transition-colors">
      
      {/* Search Input */}
      {showSearch && (
        <div className="relative w-full lg:w-[480px]">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-subtitle opacity-30" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={searchValue}
            className="block w-full pl-14 pr-4 py-3.5 border border-border-theme/60 rounded-2xl leading-5 bg-white text-title placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand sm:text-sm transition-all shadow-sm font-medium"
            placeholder={searchPlaceholder || t.assets.search_placeholder}
            onChange={(e) => { setSearchValue(e.target.value); onSearchChange?.(e.target.value); }}
          />
        </div>
      )}

      <div className="hidden lg:block flex-1" />

      {/* Quick Filters + Actions */}
      <div className="flex items-center space-x-3 w-full lg:w-auto justify-end relative min-w-0">

        {/* Global reset button — shown when any filter is active */}
        {hasAnyFilter && (
          <button
            onClick={handleClearAll}
            className="p-2 text-subtitle/30 hover:text-brand hover:bg-brand/5 rounded-full transition-all animate-in fade-in zoom-in duration-200"
            title={t.common.clear_filters}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {showQuickFilters && (
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">


            <div className="relative flex w-full max-w-full items-center overflow-x-auto bg-subtitle/5 p-1 rounded-full border border-border-theme/30 custom-scroll lg:w-auto">
              {["Hoy", "Mes", "Año", "Personalizado"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  className={`shrink-0 px-4 sm:px-5 lg:px-6 py-2.5 lg:py-3 rounded-full text-[13px] sm:text-[15px] font-bold transition-all duration-200 ${
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
                  className="absolute top-full right-0 mt-3 p-5 bg-white rounded-3xl border border-border-theme/60 shadow-2xl z-50 w-[min(320px,calc(100vw-2rem))] animate-in fade-in zoom-in-95 duration-200"
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
