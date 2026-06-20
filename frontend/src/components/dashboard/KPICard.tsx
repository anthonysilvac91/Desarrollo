"use client";

import React from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType<{ className?: string; strokeWidth?: number }>;
  iconBg?: string;
  iconColor?: string;
  roundedClass?: string;
}

export default function KPICard({ title, value, subtitle, icon: Icon, iconBg, iconColor, roundedClass }: KPICardProps) {
  const valueStr = String(value);
  const isPositive = valueStr.startsWith('+');
  const isNegative = valueStr.startsWith('-');

  const bgCls    = iconBg    ?? "bg-brand/10";
  const colorCls = iconColor ?? "text-brand";

  return (
    <div className={`bg-white p-2.5 sm:p-5 lg:p-6 ${roundedClass ?? "rounded-[18px] sm:rounded-[24px] lg:rounded-[28px]"} border border-border-theme/40 shadow-sm hover:shadow-xl hover:shadow-brand/5 transition-all group overflow-hidden relative min-w-0`}>

      {/* Mobile: vertical layout — icon → value → title, no subtitle */}
      <div className="flex sm:hidden flex-col items-center gap-1.5 relative z-10">
        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bgCls} ${colorCls} transition-opacity group-hover:opacity-80`}>
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </div>
        )}
        <h3 className={`text-base font-black tracking-tight leading-none ${
          isPositive ? "text-emerald-600" : isNegative ? "text-rose-600" : "text-title"
        }`}>
          {value}
        </h3>
        <p className="text-[7px] font-black text-subtitle/40 uppercase tracking-[0.1em] text-center leading-tight">
          {title}
        </p>
      </div>

      {/* Desktop: horizontal layout — icon | title / value / subtitle */}
      <div className="hidden sm:flex items-center gap-3 sm:gap-4 relative z-10">
        {Icon && (
          <div className={`shrink-0 rounded-2xl flex items-center justify-center ${bgCls} ${colorCls} transition-opacity group-hover:opacity-80`} style={{ width: 48, height: 48 }}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.75} />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[9px] sm:text-[10px] font-black text-subtitle/40 uppercase tracking-[0.14em] sm:tracking-[0.18em]">
            {title}
          </p>
          <h3 className={`text-2xl sm:text-[1.75rem] font-black tracking-tight leading-none ${
            isPositive ? "text-emerald-600" : isNegative ? "text-rose-600" : "text-title"
          }`}>
            {value}
          </h3>
          {subtitle && (
            <p className="text-[10px] font-medium text-subtitle/35 leading-tight pt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-brand/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
