"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

interface FilterOption { value: string; label: string; }

export default function FilterDropdown({ value, onChange, options, placeholder, showReset = true, compact = false, up = false, neutral = false }: {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  placeholder: string;
  showReset?: boolean;
  compact?: boolean;
  up?: boolean;
  neutral?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const selected = options.find(o => o.value === value);

  const triggerBase = compact
    ? "h-8 px-2.5 rounded-lg text-[11px]"
    : "h-11 px-4 rounded-2xl text-sm";

  const activeStyle  = "border-brand/40 bg-brand/5 text-brand";
  const neutralStyle = "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 border font-semibold transition-all shadow-sm whitespace-nowrap ${triggerBase} ${
          !neutral && value ? activeStyle : neutralStyle
        }`}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`absolute ${up ? "bottom-full mb-2" : "top-full mt-2"} right-0 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 min-w-[160px] overflow-hidden animate-in fade-in zoom-in-95 duration-150`}>
          <div className="max-h-60 overflow-y-auto py-1.5">
            {showReset && (
              <>
                <button
                  onClick={() => { onChange(""); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                    !value ? "text-brand bg-brand/5" : "text-subtitle/50 hover:bg-app-bg hover:text-subtitle"
                  }`}
                >
                  {placeholder}
                </button>
                <div className="mx-3 my-0.5 h-px bg-border-theme/20" />
              </>
            )}
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                  value === opt.value
                    ? "text-brand bg-brand/5"
                    : "text-title hover:bg-app-bg"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
