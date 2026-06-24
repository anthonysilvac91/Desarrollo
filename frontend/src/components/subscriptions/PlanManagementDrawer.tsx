"use client";

import React, { useState, useEffect } from "react";
import { Check, Loader2, AlertTriangle, Crown, Zap, Building2, Sparkles, Star } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionsService, SubscriptionWithUsage, PlanTier } from "@/services/subscriptions.service";
import { useToast } from "@/lib/ToastContext";
import Drawer from "@/components/ui/Drawer";

interface PlanManagementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: SubscriptionWithUsage | null;
  organization?: { id: string; name: string; slug: string; is_active: boolean } | null;
}

const PLAN_OPTIONS: { tier: PlanTier; name: string; price: string; color: string; icon: React.ElementType }[] = [
  { tier: "DEMO", name: "Demo", price: "$0", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Star },
  { tier: "STARTER", name: "Starter", price: "$49", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Zap },
  { tier: "PRO", name: "Pro", price: "$149", color: "bg-blue-100 text-blue-600 border-blue-200", icon: Sparkles },
  { tier: "BUSINESS", name: "Business", price: "$349", color: "bg-emerald-100 text-emerald-600 border-emerald-200", icon: Building2 },
  { tier: "ENTERPRISE", name: "Enterprise", price: "Custom", color: "bg-violet-100 text-violet-600 border-violet-200", icon: Crown },
];

export default function PlanManagementDrawer({ isOpen, onClose, data, organization }: PlanManagementDrawerProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [notes, setNotes] = useState("");
  const [maxUsers, setMaxUsers] = useState(0);
  const [maxAssets, setMaxAssets] = useState(0);
  const [maxStorageGb, setMaxStorageGb] = useState(0);
  const [maxVideoHours, setMaxVideoHours] = useState(0);

  useEffect(() => {
    if (data) {
      setSelectedPlan(null);
      setNotes(data.subscription.notes || "");
    }
  }, [data]);

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!data || !selectedPlan) return Promise.reject();
      const overrides = selectedPlan === "ENTERPRISE"
        ? { max_users: maxUsers, max_assets: maxAssets, max_storage_gb: maxStorageGb, max_video_hours: maxVideoHours }
        : undefined;
      return subscriptionsService.assignPlan(data.organization.id, {
        plan: selectedPlan,
        overrides: overrides as any,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      showToast("Plan actualizado", "success");
      invalidateAll();
      setSelectedPlan(null);
    },
    onError: () => showToast("Error al actualizar plan", "error"),
  });

  const approveMutation = useMutation({
    mutationFn: (approved: boolean) => {
      if (!data) return Promise.reject();
      return subscriptionsService.approveChange(data.organization.id, approved);
    },
    onSuccess: (_, approved) => {
      showToast(approved ? "Solicitud aprobada" : "Solicitud rechazada", "success");
      invalidateAll();
    },
    onError: () => showToast("Error al procesar solicitud", "error"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "SUSPENDED") => {
      if (!data) return Promise.reject();
      return subscriptionsService.toggleStatus(data.organization.id, status);
    },
    onSuccess: (_, status) => {
      showToast(status === "ACTIVE" ? "Organización reactivada" : "Organización suspendida", "success");
      invalidateAll();
    },
    onError: () => showToast("Error al cambiar estado", "error"),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["subscriptions-all"] });
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };

  const initialAssignMutation = useMutation({
    mutationFn: (plan: PlanTier) => {
      if (!organization) return Promise.reject();
      const overrides = plan === "ENTERPRISE"
        ? { max_users: maxUsers, max_assets: maxAssets, max_storage_gb: maxStorageGb, max_video_hours: maxVideoHours }
        : undefined;
      return subscriptionsService.assignPlan(organization.id, {
        plan,
        overrides: overrides as any,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      showToast("Plan asignado correctamente", "success");
      invalidateAll();
      onClose();
    },
    onError: () => showToast("Error al asignar plan", "error"),
  });

  if (!data && organization) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose}>
        <div className="pt-20 px-6 pb-8 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-title">{organization.name}</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-100 text-amber-700 border-amber-200">
              Sin plan
            </span>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-bold text-amber-700">Sin suscripción</p>
            </div>
            <p className="text-sm text-amber-600">Esta organización no tiene un plan asignado. Selecciona uno para activarla.</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-subtitle/40">Asignar plan</p>
            <div className="grid grid-cols-1 gap-2">
              {PLAN_OPTIONS.map((plan) => {
                const isSelected = plan.tier === selectedPlan;
                const Icon = plan.icon;
                return (
                  <button
                    key={plan.tier}
                    onClick={() => setSelectedPlan(isSelected ? null : plan.tier)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-brand shadow-sm"
                        : "border-border-theme/30 hover:border-border-theme/60"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${plan.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-title">{plan.name}</p>
                      <p className="text-[11px] text-subtitle/50">{plan.price}/mes</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPlan === "ENTERPRISE" && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-violet-500">Límites personalizados</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Max usuarios", value: maxUsers, set: setMaxUsers },
                    { label: "Max activos", value: maxAssets, set: setMaxAssets },
                    { label: "Storage (GB)", value: maxStorageGb, set: setMaxStorageGb },
                    { label: "Video (hs)", value: maxVideoHours, set: setMaxVideoHours },
                  ].map((f) => (
                    <div key={f.label} className="space-y-1">
                      <label className="text-[10px] font-semibold text-subtitle/50">{f.label}</label>
                      <input
                        type="number"
                        min={0}
                        value={f.value}
                        onChange={(e) => f.set(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-border-theme/50 rounded-lg text-sm font-semibold text-title outline-none focus:border-brand"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPlan && (
              <button
                onClick={() => initialAssignMutation.mutate(selectedPlan)}
                disabled={initialAssignMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-all disabled:opacity-50"
              >
                {initialAssignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Asignar {selectedPlan}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-subtitle/40">Notas internas</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Solo visible para SUPER_ADMIN..."
              className="w-full px-4 py-3 border-2 border-border-theme/40 rounded-xl text-sm text-title outline-none focus:border-brand resize-none placeholder:text-subtitle/30"
            />
          </div>
        </div>
      </Drawer>
    );
  }

  if (!data) return <Drawer isOpen={isOpen} onClose={onClose}><div /></Drawer>;

  const { subscription: sub, usage, organization: org } = data;
  const currentMeta = PLAN_OPTIONS.find((p) => p.tier === sub.plan);

  function ProgressMini({ label, current, max, unit }: { label: string; current: number; max: number; unit?: string }) {
    const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="font-semibold text-subtitle/50">{label}</span>
          <span className="font-bold text-title">
            {current}{unit ? ` ${unit}` : ""} / {max >= 999999 ? "∞" : `${max}${unit ? ` ${unit}` : ""}`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-app-bg/80 overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 80 ? "bg-red-400" : "bg-brand"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <div className="pt-20 px-6 pb-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h3 className="text-lg font-black text-title">{org.name}</h3>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${currentMeta?.color}`}>
              {sub.plan}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              sub.status === "ACTIVE" || sub.status === "TRIALING"
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-red-100 text-red-700 border-red-200"
            }`}>
              {sub.status}
            </span>
          </div>
        </div>

        {/* Usage */}
        <div className="rounded-2xl border border-border-theme/30 bg-app-bg/30 p-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-subtitle/40">Uso actual</p>
          <ProgressMini label="Usuarios" current={usage.users} max={sub.max_users} />
          <ProgressMini label="Activos" current={usage.assets} max={sub.max_assets} />
          <ProgressMini label="Storage" current={usage.storage_gb} max={sub.max_storage_gb} unit="GB" />
          {sub.max_video_hours > 0 && (
            <ProgressMini label="Video" current={usage.video_hours} max={sub.max_video_hours} unit="hs" />
          )}
        </div>

        {/* Pending request */}
        {sub.pending_plan && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-bold text-amber-700">Solicitud pendiente</p>
            </div>
            <p className="text-sm text-amber-600">
              Cambio a <span className="font-black">{sub.pending_plan}</span>
              {sub.pending_plan_requested_at && (
                <span className="text-xs text-amber-500 ml-2">
                  ({new Date(sub.pending_plan_requested_at).toLocaleDateString()})
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => approveMutation.mutate(true)}
                disabled={approveMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-all disabled:opacity-50"
              >
                {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Aprobar"}
              </button>
              <button
                onClick={() => approveMutation.mutate(false)}
                disabled={approveMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-bold hover:bg-red-200 transition-all disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </div>
        )}

        {/* Change plan */}
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-subtitle/40">Cambiar plan</p>
          <div className="grid grid-cols-1 gap-2">
            {PLAN_OPTIONS.map((plan) => {
              const isCurrent = plan.tier === sub.plan;
              const isSelected = plan.tier === selectedPlan;
              const Icon = plan.icon;
              return (
                <button
                  key={plan.tier}
                  onClick={() => setSelectedPlan(isCurrent ? null : plan.tier)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    isCurrent
                      ? "border-brand/40 bg-brand/5"
                      : isSelected
                      ? "border-brand shadow-sm"
                      : "border-border-theme/30 hover:border-border-theme/60"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${plan.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-title">{plan.name}</p>
                    <p className="text-[11px] text-subtitle/50">{plan.price}/mes</p>
                  </div>
                  {isCurrent && <Check className="w-4 h-4 text-brand shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* ENTERPRISE overrides */}
          {selectedPlan === "ENTERPRISE" && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-violet-500">Límites personalizados</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Max usuarios", value: maxUsers, set: setMaxUsers },
                  { label: "Max activos", value: maxAssets, set: setMaxAssets },
                  { label: "Storage (GB)", value: maxStorageGb, set: setMaxStorageGb },
                  { label: "Video (hs)", value: maxVideoHours, set: setMaxVideoHours },
                ].map((f) => (
                  <div key={f.label} className="space-y-1">
                    <label className="text-[10px] font-semibold text-subtitle/50">{f.label}</label>
                    <input
                      type="number"
                      min={0}
                      value={f.value}
                      onChange={(e) => f.set(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-border-theme/50 rounded-lg text-sm font-semibold text-title outline-none focus:border-brand"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPlan && selectedPlan !== sub.plan && (
            <button
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-all disabled:opacity-50"
            >
              {assignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Aplicar {selectedPlan}
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-subtitle/40">Notas internas</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Solo visible para SUPER_ADMIN..."
            className="w-full px-4 py-3 border-2 border-border-theme/40 rounded-xl text-sm text-title outline-none focus:border-brand resize-none placeholder:text-subtitle/30"
          />
        </div>

        {/* Suspend / Reactivate */}
        <div className="pt-4 border-t border-border-theme/20">
          {sub.status === "SUSPENDED" || sub.status === "CANCELLED" ? (
            <button
              onClick={() => statusMutation.mutate("ACTIVE")}
              disabled={statusMutation.isPending}
              className="w-full py-3 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-all disabled:opacity-50"
            >
              {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Reactivar organización"}
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm("¿Seguro que deseas suspender esta organización? Los usuarios no podrán realizar escrituras.")) {
                  statusMutation.mutate("SUSPENDED");
                }
              }}
              disabled={statusMutation.isPending}
              className="w-full py-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50"
            >
              {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Suspender organización"}
            </button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
