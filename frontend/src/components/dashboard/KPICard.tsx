"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
}

export default function KPICard({
  title,
  value,
}: KPICardProps) {
  const valueStr = String(value);
  const isPositive = valueStr.startsWith('+');
  const isNegative = valueStr.startsWith('-');

  return (
    <div className="bg-white p-4 lg:p-5 rounded-[28px] border border-border-theme/40 shadow-sm hover:shadow-xl hover:shadow-brand/5 transition-all group overflow-hidden relative">
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-0.5">
          <p className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em]">{title}</p>
          <h3 className={`text-2xl lg:text-3xl font-black tracking-tight ${
            isPositive ? "text-emerald-600" : isNegative ? "text-rose-600" : "text-title"
          }`}>
            {value}
          </h3>
        </div>
      </div>
      
      {/* Decorative background shape */}
      <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-brand/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
