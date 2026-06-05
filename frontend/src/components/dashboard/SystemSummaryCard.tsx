"use client";

import React from "react";
import { Ship, Building2, HardHat, ShieldCheck } from "lucide-react";

interface Props {
  totalAssets: number;
  totalOwners: number;
  totalWorkers: number;
  totalAdmins: number;
  t: any;
}

export default function SystemSummaryCard({ totalAssets, totalOwners, totalWorkers, totalAdmins, t }: Props) {
  const m = t.dashboard.modules.system_summary;

  const items = [
    { label: m.assets,  value: totalAssets,  icon: Ship,        color: "bg-blue-50 text-blue-500" },
    { label: m.owners,  value: totalOwners,  icon: Building2,   color: "bg-violet-50 text-violet-500" },
    { label: m.workers, value: totalWorkers, icon: HardHat,     color: "bg-amber-50 text-amber-500" },
    { label: m.admins,  value: totalAdmins,  icon: ShieldCheck, color: "bg-emerald-50 text-emerald-500" },
  ];

  return (
    <>
      {/* Mobile: 4 mini cards in a row */}
      <div className="grid grid-cols-4 gap-2 sm:hidden">
        {items.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-2.5 border border-border-theme/40 shadow-sm flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-title leading-none">{value}</span>
            <span className="text-[7px] font-black text-subtitle/40 uppercase tracking-[0.1em] text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* Desktop: 4 mini cards stacked vertically */}
      <div className="hidden sm:flex flex-col gap-2 h-full">
        {items.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex-1 bg-white rounded-2xl border border-border-theme/40 shadow-sm flex flex-col items-center justify-center gap-1.5 p-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-lg font-black text-title leading-none">{value}</span>
            <span className="text-[8px] font-black text-subtitle/40 uppercase tracking-[0.12em] text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
