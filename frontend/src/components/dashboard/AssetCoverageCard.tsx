"use client";

import React from "react";
import Link from "next/link";
import { PieChart, Pie, Cell } from "recharts";
import { ArrowRight, Package } from "lucide-react";

interface Props {
  totalAssets: number;
  assetsServiced: number;
  t: any;
}

const BRAND = "var(--theme-primary)";
const GRAY  = "#e2e8f0";
const SIZE  = 140;
const INNER = 46;
const OUTER = 62;

export default function AssetCoverageCard({ totalAssets, assetsServiced, t }: Props) {
  const m          = t.dashboard.modules.asset_coverage;
  const noActivity = Math.max(0, totalAssets - assetsServiced);
  const percentage = totalAssets > 0 ? Math.round((assetsServiced / totalAssets) * 100) : 0;

  const donutData = totalAssets === 0
    ? [{ value: 1 }]
    : [
        { value: assetsServiced },
        { value: noActivity },
      ];

  const donutColors = totalAssets === 0 ? [GRAY] : [BRAND, GRAY];

  const footer = (
    <div className="px-5 pb-5 pt-3 border-t border-border-theme/10">
      <Link
        href="/assets"
        className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl border border-brand/30 bg-brand/5 text-brand text-xs font-black uppercase tracking-wider hover:bg-brand/10 hover:border-brand/50 transition-all"
      >
        {m.view_all}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );

  if (totalAssets === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border-theme/40 shadow-sm flex flex-col h-full">
        <div className="px-5 pt-5 pb-3 border-b border-border-theme/20">
          <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-title tracking-tight">{m.title}</h3>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 py-8 px-5 text-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-brand/5 flex items-center justify-center mb-1">
            <Package className="w-5 h-5 text-brand/30" />
          </div>
          <p className="text-sm font-black text-title/50">{m.no_assets_title}</p>
          <p className="text-xs text-subtitle/40 font-medium">{m.no_assets_subtitle}</p>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border-theme/40 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border-theme/20">
        <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-title tracking-tight">{m.title}</h3>
      </div>

      {/* Donut */}
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-5 py-4">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <PieChart width={SIZE} height={SIZE} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={donutData}
              cx={SIZE / 2}
              cy={SIZE / 2}
              innerRadius={INNER}
              outerRadius={OUTER}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive
            >
              {donutData.map((_, i) => (
                <Cell key={i} fill={donutColors[i]} />
              ))}
            </Pie>
          </PieChart>

          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-0.5">
              <span className="text-lg font-black text-brand leading-none">{assetsServiced}</span>
              <span className="text-[9px] font-black text-subtitle/30 leading-none px-0.5">of</span>
              <span className="text-lg font-black text-title leading-none">{totalAssets}</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full space-y-2 border-t border-border-theme/10 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BRAND }} />
              <span className="text-xs font-semibold text-subtitle/60">{m.active_period}</span>
            </div>
            <span className="text-xs font-black text-title">
              {assetsServiced} <span className="text-subtitle/40 font-semibold">({percentage}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: GRAY }} />
              <span className="text-xs font-semibold text-subtitle/60">{m.no_activity}</span>
            </div>
            <span className="text-xs font-black text-title">
              {noActivity} <span className="text-subtitle/40 font-semibold">({totalAssets > 0 ? 100 - percentage : 0}%)</span>
            </span>
          </div>
        </div>
      </div>

      {footer}
    </div>
  );
}
