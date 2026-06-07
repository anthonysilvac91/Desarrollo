"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { DayPicker, useDayPicker } from "react-day-picker";
import type { DateRange, MonthCaptionProps } from "react-day-picker";
import { useLanguage } from "@/lib/LanguageContext";

interface PresetOption { value: string; label: string; }

interface DateFilterDropdownProps {
  value: string;
  customStart?: string;
  customEnd?: string;
  onChange: (preset: string, start?: string, end?: string) => void;
  options: PresetOption[];
  placeholder: string;
  compact?: boolean;
  iconOnlyCustom?: boolean;
  bottomSheet?: boolean;
}

function CalendarCaption({ calendarMonth }: MonthCaptionProps) {
  const { previousMonth, nextMonth, goToMonth } = useDayPicker();
  return (
    <div className="flex items-center justify-between mb-2">
      <button
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        className="p-1 rounded-full hover:bg-app-bg text-subtitle/40 hover:text-brand transition-all disabled:opacity-30"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>
      <span className="text-xs font-black text-title capitalize">
        {calendarMonth.date.toLocaleDateString("es", { month: "long", year: "numeric" })}
      </span>
      <button
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        className="p-1 rounded-full hover:bg-app-bg text-subtitle/40 hover:text-brand transition-all disabled:opacity-30"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

function CalendarPanel({
  t,
  value,
  options,
  placeholder,
  customRange,
  setCustomRange,
  showCustom,
  setShowCustom,
  onChange,
  onClose,
}: {
  t: any;
  value: string;
  options: PresetOption[];
  placeholder: string;
  customRange: DateRange | undefined;
  setCustomRange: (r: DateRange | undefined) => void;
  showCustom: boolean;
  setShowCustom: (v: boolean) => void;
  onChange: (preset: string, start?: string, end?: string) => void;
  onClose: () => void;
}) {
  if (!showCustom) {
    return (
      <div className="py-1.5">
        <button
          onClick={() => { onChange(""); onClose(); }}
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
            onClick={() => { onChange(opt.value); onClose(); }}
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
    );
  }

  return (
    <div className="p-3">
      <div className="mb-4 mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-app-bg px-2 py-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-subtitle/35">
            {t.date_filters.from}
          </span>
          <span className="block truncate text-[11px] font-bold text-title">
            {customRange?.from
              ? customRange.from.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })
              : "--"}
          </span>
        </div>
        <div className="rounded-xl bg-app-bg px-2 py-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-subtitle/35">
            {t.date_filters.to}
          </span>
          <span className="block truncate text-[11px] font-bold text-title">
            {customRange?.to && customRange.to.getTime() !== customRange.from?.getTime()
              ? customRange.to.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })
              : "--"}
          </span>
        </div>
      </div>
      <DayPicker
        mode="range"
        selected={customRange}
        onSelect={(range) => {
          const alreadyHadFrom = !!customRange?.from;
          setCustomRange(range);
          if (alreadyHadFrom && range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
            onChange("Personalizado", toDateStr(range.from), toDateStr(range.to));
            onClose();
            setShowCustom(false);
          }
        }}
        classNames={{
          root: "text-xs",
          nav: "hidden",
          month_grid: "w-full border-collapse mt-1",
          weekday: "text-center text-[9px] font-black text-subtitle/30 uppercase pb-1.5 w-7",
          day: "p-0 text-center",
          day_button: "w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center transition-all hover:bg-brand/10 hover:text-brand mx-auto",
          selected: "!bg-brand !text-white rounded-full",
          today: "text-brand font-black",
          range_start: "!bg-brand !text-white rounded-full",
          range_end: "!bg-brand !text-white rounded-full",
          range_middle: "bg-brand/10 !text-brand rounded-none",
          outside: "opacity-20",
        }}
        components={{ MonthCaption: CalendarCaption }}
      />
      <button
        onClick={() => setShowCustom(false)}
        className="mt-2 w-full py-2 rounded-xl text-xs font-black text-subtitle/50 border border-border-theme/40 hover:bg-app-bg transition-all"
      >
        ←
      </button>
    </div>
  );
}

export default function DateFilterDropdown({
  value,
  customStart = "",
  customEnd = "",
  onChange,
  options,
  placeholder,
  compact: _compact = false,
  iconOnlyCustom = false,
  bottomSheet = false,
}: DateFilterDropdownProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() =>
    customStart && customEnd
      ? { from: new Date(customStart + "T00:00:00"), to: new Date(customEnd + "T00:00:00") }
      : undefined
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomRange(
      customStart && customEnd
        ? { from: new Date(customStart + "T00:00:00"), to: new Date(customEnd + "T00:00:00") }
        : undefined
    );
  }, [customStart, customEnd]);

  useEffect(() => {
    if (!open || bottomSheet) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, bottomSheet]);

  const isCustomActive = value === "Personalizado" && customStart && customEnd;

  const triggerLabel = isCustomActive
    ? `${formatShort(customStart)} – ${formatShort(customEnd)}`
    : options.find(o => o.value === value)?.label ?? placeholder;

  const isActive = !!value;
  const activeStyle  = "border-brand/40 bg-brand/5 text-brand";
  const neutralStyle = "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80";

  const handleClose = () => { setOpen(false); setShowCustom(false); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(v => !v); setShowCustom(false); }}
        className={`flex items-center gap-1.5 border font-semibold transition-all shadow-sm whitespace-nowrap h-11 px-4 rounded-2xl text-sm ${
          isActive ? activeStyle : neutralStyle
        }`}
      >
        {isCustomActive && <Calendar className="w-3.5 h-3.5 shrink-0" />}
        {!(iconOnlyCustom && isCustomActive) && <span>{triggerLabel}</span>}
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Desktop: absolute dropdown */}
      {!bottomSheet && open && !showCustom && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 min-w-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <CalendarPanel
            t={t} value={value} options={options} placeholder={placeholder}
            customRange={customRange} setCustomRange={setCustomRange}
            showCustom={false} setShowCustom={setShowCustom}
            onChange={onChange} onClose={handleClose}
          />
        </div>
      )}
      {!bottomSheet && open && showCustom && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-30 w-[min(270px,calc(100vw-2rem))] animate-in fade-in zoom-in-95 duration-150">
          <CalendarPanel
            t={t} value={value} options={options} placeholder={placeholder}
            customRange={customRange} setCustomRange={setCustomRange}
            showCustom={true} setShowCustom={setShowCustom}
            onChange={onChange} onClose={handleClose}
          />
        </div>
      )}

      {/* Mobile: bottom sheet via portal */}
      {bottomSheet && open && typeof document !== "undefined" && ReactDOM.createPortal(
        <div className="fixed inset-0 z-200 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
          <div className="relative bg-white rounded-t-3xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <span className="text-base font-black text-title">
                {showCustom ? t.date_filters.custom : placeholder}
              </span>
              <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-app-bg text-subtitle/40">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="pb-8">
              <CalendarPanel
                t={t} value={value} options={options} placeholder={placeholder}
                customRange={customRange} setCustomRange={setCustomRange}
                showCustom={showCustom} setShowCustom={setShowCustom}
                onChange={onChange} onClose={handleClose}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
