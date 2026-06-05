"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

interface Operator {
  id: string;
  name: string;
  metric: number;
  avatar_url?: string;
}

interface Props {
  operators: Operator[];
  t: any;
}

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

export default function OperatorActivityCard({ operators, t }: Props) {
  const m = t.dashboard.modules.operator_activity;
  const max = operators[0]?.metric ?? 1;

  return (
    <div className="bg-white rounded-2xl border border-border-theme/40 shadow-sm flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border-theme/20">
        <h3 className="text-[11px] font-black text-title/70 uppercase tracking-[0.2em]">{m.title}</h3>
      </div>

      {operators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-5 text-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-brand/5 flex items-center justify-center mb-1">
            <Users className="w-5 h-5 text-brand/30" />
          </div>
          <p className="text-sm font-black text-title/60">{m.empty_title}</p>
          <p className="text-xs text-subtitle/40 font-medium">{m.empty_subtitle}</p>
        </div>
      ) : (
        <div className="px-5 py-3 space-y-3">
          {operators.map(op => (
            <div key={op.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand/10 overflow-hidden flex items-center justify-center shrink-0 border border-white shadow-sm ring-1 ring-border-theme/10">
                {op.avatar_url ? (
                  <img src={op.avatar_url} alt={op.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-black text-brand">{getInitials(op.name)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-title truncate">{op.name}</span>
                  <span className="text-[10px] font-black text-subtitle/50 shrink-0 ml-2">
                    {op.metric} {m.services_label}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border-theme/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand/60 transition-all duration-500"
                    style={{ width: `${Math.round((op.metric / max) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 pb-5 pt-3 mt-auto border-t border-border-theme/10">
        <Link
          href="/users"
          className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl border border-brand/30 bg-brand/5 text-brand text-xs font-black uppercase tracking-wider hover:bg-brand/10 hover:border-brand/50 transition-all"
        >
          {m.view_all}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
