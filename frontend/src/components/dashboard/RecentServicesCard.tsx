"use client";

import React from "react";
import Link from "next/link";
import { Inbox, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/formatDate";

interface Service {
  id: string;
  title: string;
  created_at: string;
  asset_name: string;
  worker_name: string;
}

interface Props {
  services: Service[];
  t: any;
}

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

export default function RecentServicesCard({ services, t }: Props) {
  const m = t.dashboard.modules.recent_services;

  return (
    <div className="bg-white rounded-2xl border border-border-theme/40 shadow-sm flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border-theme/20">
        <h3 className="text-[11px] font-black text-title/70 uppercase tracking-[0.2em]">{m.title}</h3>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-5 text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-brand/5 flex items-center justify-center mb-1">
            <Inbox className="w-5 h-5 text-brand/30" />
          </div>
          <p className="text-sm font-black text-title/60">{m.empty_title}</p>
          <p className="text-xs text-subtitle/40 font-medium max-w-[18rem]">{m.empty_subtitle}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-hidden">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-border-theme/10">
                  <th className="px-5 py-2 text-center text-[9px] font-black text-subtitle/30 uppercase tracking-[0.15em] w-[35%]">{m.col_service}</th>
                  <th className="px-2 py-2 text-center text-[9px] font-black text-subtitle/30 uppercase tracking-[0.15em] w-[25%]">{m.col_asset}</th>
                  <th className="px-2 py-2 text-center text-[9px] font-black text-subtitle/30 uppercase tracking-[0.15em] w-[25%]">{m.col_operator}</th>
                  <th className="px-5 py-2 text-center text-[9px] font-black text-subtitle/30 uppercase tracking-[0.15em] w-[15%]">{m.col_completed}</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, idx) => (
                  <tr key={s.id} className={`group transition-colors hover:bg-app-bg/60 ${idx < services.length - 1 ? "border-b border-border-theme/10" : ""}`}>
                    <td className="px-5 py-2.5">
                      <span className="text-xs font-semibold text-title truncate block">{s.title}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="text-xs font-semibold text-subtitle/60 truncate block">{s.asset_name}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-black text-brand">{getInitials(s.worker_name)}</span>
                        </div>
                        <span className="text-xs font-semibold text-subtitle/60 truncate">{s.worker_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="text-[11px] font-semibold text-subtitle/50 whitespace-nowrap">
                        {formatDate(s.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="sm:hidden divide-y divide-border-theme/10">
            {services.map(s => (
              <div key={s.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-brand">{getInitials(s.worker_name)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-title line-clamp-1">{s.title}</p>
                  <p className="text-xs text-subtitle/50 font-medium">{s.asset_name} · {s.worker_name}</p>
                </div>
                <span className="text-[10px] font-semibold text-subtitle/40 shrink-0 mt-0.5">
                  {formatDate(s.created_at)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="px-5 pb-5 pt-3 mt-auto border-t border-border-theme/10">
        <Link
          href="/assets"
          className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl border border-brand/30 bg-brand/5 text-brand text-xs font-black uppercase tracking-wider hover:bg-brand/10 hover:border-brand/50 transition-all"
        >
          {m.view_all}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
