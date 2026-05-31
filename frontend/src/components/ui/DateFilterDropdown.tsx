"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Calendar } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface PresetOption { value: string; label: string; }

interface DateFilterDropdownProps {
  value: string;
  customStart?: string;
  customEnd?: string;
  onChange: (preset: string, start?: string, end?: string) => void;
  options: PresetOption[];
  placeholder: string;
}

export default function DateFilterDropdown({
  value,
  customStart = "",
  customEnd = "",
  onChange,
  options,
  placeholder,
}: DateFilterDropdownProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [localStart, setLocalStart] = useState(customStart);
  const [localEnd, setLocalEnd] = useState(customEnd);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalStart(customStart);
    setLocalEnd(customEnd);
  }, [customStart, customEnd]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const isCustomActive = value === "Personalizado" && customStart && customEnd;

  const triggerLabel = isCustomActive
    ? `${formatShort(customStart)} – ${formatShort(customEnd)}`
    : options.find(o => o.value === value)?.label ?? placeholder;

  const isActive = !!value;

  const activeStyle  = "border-brand/40 bg-brand/5 text-brand";
  const neutralStyle = "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80";

  const handleApply = () => {
    if (localStart && localEnd) {
      onChange("Personalizado", localStart, localEnd);
      setOpen(false);
      setShowCustom(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(v => !v); setShowCustom(false); }}
        className={`flex items-center gap-1.5 border font-semibold transition-all shadow-sm whitespace-nowrap h-11 px-4 rounded-2xl text-sm ${
          isActive ? activeStyle : neutralStyle
        }`}
      >
        {isCustomActive && <Calendar className="w-3.5 h-3.5 shrink-0" />}
        <span>{triggerLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !showCustom && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 min-w-[160px] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="py-1.5">
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                !value ? "text-brand bg-brand/5" : "text-subtitle/50 hover:bg-app-bg hover:text-subtitle"
              }`}
            >
              {placeholder}
            </button>
            <div className="mx-3 my-0.5 h-px bg-border-theme/20" />
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                  value === opt.value ? "text-brand bg-brand/5" : "text-title hover:bg-app-bg"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="mx-3 my-0.5 h-px bg-border-theme/20" />
            <button
              onClick={() => setShowCustom(true)}
              className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                value === "Personalizado" ? "text-brand bg-brand/5" : "text-title hover:bg-app-bg"
              }`}
            >
              {t.date_filters.custom}
            </button>
          </div>
        </div>
      )}

      {open && showCustom && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 w-64 p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-brand uppercase tracking-wider block">
                {t.date_filters.from}
              </label>
              <input
                type="date"
                value={localStart}
                onChange={e => setLocalStart(e.target.value)}
                className="w-full px-3 py-2.5 bg-app-bg border border-border-theme/40 rounded-xl text-sm font-bold text-title focus:outline-none focus:border-brand transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-brand uppercase tracking-wider block">
                {t.date_filters.to}
              </label>
              <input
                type="date"
                value={localEnd}
                min={localStart}
                onChange={e => setLocalEnd(e.target.value)}
                className="w-full px-3 py-2.5 bg-app-bg border border-border-theme/40 rounded-xl text-sm font-bold text-title focus:outline-none focus:border-brand transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustom(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-subtitle/50 border border-border-theme/40 hover:bg-app-bg transition-all"
              >
                ←
              </button>
              <button
                onClick={handleApply}
                disabled={!localStart || !localEnd}
                className="flex-1 py-2.5 bg-brand text-white rounded-xl text-xs font-black hover:bg-brand/90 transition-all disabled:opacity-40"
              >
                {t.date_filters.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}
