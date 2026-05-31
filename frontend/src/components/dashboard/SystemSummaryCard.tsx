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
    <div className="bg-white rounded-[24px] lg:rounded-[28px] border border-border-theme/40 shadow-sm flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border-theme/20">
        <h3 className="text-[11px] font-black text-subtitle/40 uppercase tracking-[0.2em]">{m.title}</h3>
      </div>

      <div className="flex flex-col flex-1 divide-y divide-border-theme/10 px-4 py-2">
        {items.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 py-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-subtitle/60 flex-1">{label}</span>
            <span className="text-sm font-black text-title">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
