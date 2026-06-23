"use client";

import React, { useState } from "react";
import { Check, X as XIcon, Loader2, Crown, Zap, Building2, Sparkles, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { subscriptionsService, SubscriptionWithUsage, PlanTier } from "@/services/subscriptions.service";
import PlanUpgradeModal from "./PlanUpgradeModal";
import ModuleContainer from "@/components/ui/ModuleContainer";

const PLAN_META: Record<string, { name: string; price: string; color: string; badge: string }> = {
  DEMO: { name: "Demo", price: "$0", color: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  STARTER: { name: "Starter", price: "$49", color: "bg-slate-500", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  PRO: { name: "Pro", price: "$149", color: "bg-blue-500", badge: "bg-blue-100 text-blue-600 border-blue-200" },
  BUSINESS: { name: "Business", price: "$349", color: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-600 border-emerald-200" },
  ENTERPRISE: { name: "Enterprise", price: "Custom", color: "bg-violet-500", badge: "bg-violet-100 text-violet-600 border-violet-200" },
};

function ProgressBar({ current, max, label, unit }: { current: number; max: number; label: string; unit?: string }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isHigh = pct >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-subtitle/60">{label}</span>
        <span className="font-bold text-title">
          {current}{unit ? ` ${unit}` : ""} / {max >= 999999 ? "∞" : `${max}${unit ? ` ${unit}` : ""}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-app-bg/80 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isHigh ? "bg-red-400" : "bg-brand"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {enabled ? (
        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <Check className="w-3 h-3 text-green-600" />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <XIcon className="w-3 h-3 text-red-400" />
        </div>
      )}
      <span className={enabled ? "text-title font-semibold" : "text-subtitle/40"}>
        {label}
      </span>
    </div>
  );
}

export default function PlanStatusCard() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { data, isLoading } = useQuery<SubscriptionWithUsage>({
    queryKey: ["my-subscription"],
    queryFn: () => subscriptionsService.getMyPlan(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <ModuleContainer>
        <div className="p-8 flex items-center gap-3 justify-center text-subtitle/50">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-bold">Cargando plan...</span>
        </div>
      </ModuleContainer>
    );
  }

  if (!data) return null;

  const { subscription: sub, usage } = data;
  const meta = PLAN_META[sub.plan] ?? PLAN_META.DEMO;

  const demoExpires = sub.demo_expires_at ? new Date(sub.demo_expires_at) : null;
  const now = new Date();
  const daysLeft = demoExpires ? Math.ceil((demoExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const demoDaysUsed = demoExpires ? 14 - Math.max(0, daysLeft ?? 0) : 0;

  return (
    <>
      <ModuleContainer>
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${meta.color}`} />
              <h3 className="text-lg font-black text-title">{meta.name}</h3>
              <span className="text-sm font-bold text-subtitle/50">{meta.price}/mes</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.badge}`}>
              {sub.plan}
            </span>
          </div>

          {/* Demo bar */}
          {sub.plan === "DEMO" && demoExpires && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-amber-700">Periodo de prueba</span>
                <span className={`font-bold ${daysLeft !== null && daysLeft <= 3 ? "text-red-600" : "text-amber-700"}`}>
                  {daysLeft !== null && daysLeft > 0
                    ? `Vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`
                    : "Vencido"
                  }
                </span>
              </div>
              <div className="h-2 rounded-full bg-amber-200/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${daysLeft !== null && daysLeft <= 3 ? "bg-red-400" : "bg-amber-400"}`}
                  style={{ width: `${Math.min((demoDaysUsed / 14) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Pending plan banner */}
          {sub.pending_plan && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
              <p className="text-sm font-semibold text-blue-700">
                Tu solicitud de cambio a <span className="font-black">{sub.pending_plan}</span> está siendo procesada.
              </p>
            </div>
          )}

          {/* Usage meters */}
          <div className="space-y-4">
            <ProgressBar label="Usuarios" current={usage.users} max={sub.max_users} />
            <ProgressBar label="Activos" current={usage.assets} max={sub.max_assets} />
            <ProgressBar label="Storage" current={usage.storage_gb} max={sub.max_storage_gb} unit="GB" />
            {sub.max_video_hours > 0 && (
              <ProgressBar label="Video" current={usage.video_hours} max={sub.max_video_hours} unit="hs" />
            )}
          </div>

          {/* Features */}
          <div className="space-y-3 pt-2 border-t border-border-theme/20">
            <p className="text-xs font-black uppercase tracking-wider text-subtitle/40">Funcionalidades</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <FeatureRow label="Acceso externo" enabled={sub.allow_external} />
              <FeatureRow label="Branding personalizado" enabled={sub.allow_branding} />
              <FeatureRow label="Traducción AI" enabled={sub.allow_ai_translation} />
              <FeatureRow label="Video" enabled={sub.max_video_hours > 0} />
            </div>
          </div>

          {/* Action */}
          <div className="pt-2">
            <button
              onClick={() => setUpgradeOpen(true)}
              className="flex items-center gap-2 bg-brand hover:bg-brand/90 active:scale-95 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm shadow-brand/20"
            >
              <ArrowUpRight className="w-4 h-4" />
              Solicitar cambio de plan
            </button>
          </div>
        </div>
      </ModuleContainer>

      <PlanUpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentPlan={sub.plan}
      />
    </>
  );
}
