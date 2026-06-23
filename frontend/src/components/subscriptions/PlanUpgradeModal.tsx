"use client";

import React, { useState } from "react";
import { X, Check, Loader2, Crown, Zap, Building2, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionsService, PlanTier } from "@/services/subscriptions.service";
import { useToast } from "@/lib/ToastContext";

interface PlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanTier;
}

const PLANS = [
  {
    tier: "STARTER" as PlanTier,
    name: "Starter",
    price: "$49",
    icon: Zap,
    color: "bg-slate-100 text-slate-600 border-slate-200",
    features: ["3 usuarios", "100 activos", "5 GB storage"],
    extras: [],
  },
  {
    tier: "PRO" as PlanTier,
    name: "Pro",
    price: "$149",
    icon: Sparkles,
    color: "bg-blue-50 text-blue-600 border-blue-200",
    features: ["10 usuarios", "500 activos", "50 GB storage", "10 hs video/mes"],
    extras: ["Acceso externo", "Traducción AI"],
  },
  {
    tier: "BUSINESS" as PlanTier,
    name: "Business",
    price: "$349",
    icon: Building2,
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
    features: ["Usuarios ilimitados", "Activos ilimitados", "200 GB storage", "50 hs video/mes"],
    extras: ["Acceso externo", "Branding personalizado", "Traducción AI"],
  },
  {
    tier: "ENTERPRISE" as PlanTier,
    name: "Enterprise",
    price: "Custom",
    icon: Crown,
    color: "bg-violet-50 text-violet-600 border-violet-200",
    features: ["Todo ilimitado", "Storage personalizado", "Video personalizado"],
    extras: ["Todas las funcionalidades", "Soporte dedicado"],
  },
];

export default function PlanUpgradeModal({ isOpen, onClose, currentPlan }: PlanUpgradeModalProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PlanTier | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (plan: PlanTier) => subscriptionsService.requestChange(plan),
    onSuccess: () => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
    },
    onError: () => showToast("No se pudo enviar la solicitud", "error"),
  });

  const handleConfirm = () => {
    if (!selected || selected === "ENTERPRISE") return;
    mutation.mutate(selected);
  };

  const handleClose = () => {
    setSelected(null);
    setShowSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300" onClick={handleClose} />

      <div className="relative bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="px-6 sm:px-10 pt-8 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-title">Cambiar plan</h2>
            <p className="text-sm text-subtitle/50 mt-1">
              Los cambios de plan se procesan manualmente. No se realizará ningún cargo automático.
            </p>
          </div>
          <button onClick={handleClose} className="p-2.5 rounded-full hover:bg-gray-100 text-subtitle/40 hover:text-title transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 sm:px-10 pb-8 max-h-[70vh] overflow-y-auto">
          {showSuccess ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-black text-title">Solicitud enviada</p>
              <p className="text-sm text-subtitle/60 max-w-md mx-auto">
                Tu solicitud de cambio a <span className="font-bold">{selected}</span> fue enviada. Nuestro equipo la procesará en las próximas 24 horas.
              </p>
              <button
                onClick={handleClose}
                className="mt-4 px-6 py-2.5 rounded-2xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-all"
              >
                Entendido
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {PLANS.map((plan) => {
                  const isCurrent = plan.tier === currentPlan;
                  const isSelected = plan.tier === selected;
                  const Icon = plan.icon;
                  return (
                    <button
                      key={plan.tier}
                      onClick={() => !isCurrent && setSelected(plan.tier)}
                      disabled={isCurrent}
                      className={`relative text-left p-5 rounded-2xl border-2 transition-all ${
                        isCurrent
                          ? "border-brand/40 bg-brand/5 cursor-default"
                          : isSelected
                          ? "border-brand shadow-md shadow-brand/10"
                          : "border-border-theme/30 hover:border-border-theme/60"
                      }`}
                    >
                      {isCurrent && (
                        <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-wider bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                          Plan actual
                        </span>
                      )}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${plan.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-title">{plan.name}</p>
                          <p className="text-xs font-bold text-subtitle/50">{plan.price}/mes</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {plan.features.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-subtitle/60">
                            <Check className="w-3 h-3 text-green-500 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                        {plan.extras.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-brand/70">
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span className="font-semibold">{f}</span>
                          </div>
                        ))}
                      </div>
                      {plan.tier === "ENTERPRISE" && (
                        <p className="mt-3 text-[11px] text-violet-500 font-semibold">
                          Contacta con nuestro equipo para pricing personalizado
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-theme/20">
                <button onClick={handleClose} className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-subtitle/60 hover:bg-app-bg transition-all">
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!selected || selected === currentPlan || selected === "ENTERPRISE" || mutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-all disabled:opacity-40 shadow-sm shadow-brand/20"
                >
                  {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Solicitar cambio
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
