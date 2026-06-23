"use client";

import React from "react";
import { AlertTriangle, Clock, Info, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { subscriptionsService, SubscriptionWithUsage } from "@/services/subscriptions.service";
import { useAuth } from "@/lib/AuthContext";

interface AccountStatusBannerProps {
  onUpgradeClick?: () => void;
}

export default function AccountStatusBanner({ onUpgradeClick }: AccountStatusBannerProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data } = useQuery<SubscriptionWithUsage>({
    queryKey: ["my-subscription"],
    queryFn: () => subscriptionsService.getMyPlan(),
    enabled: isAdmin && !!user?.organization_id,
    staleTime: 60_000,
  });

  if (!isAdmin || !data) return null;

  const { subscription } = data;
  const now = new Date();
  const demoExpires = subscription.demo_expires_at ? new Date(subscription.demo_expires_at) : null;
  const daysLeft = demoExpires ? Math.ceil((demoExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  if (subscription.status === "SUSPENDED") {
    return (
      <div className="mx-4 sm:mx-8 lg:mx-14 mt-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
        <p className="text-sm font-semibold text-red-700 flex-1">
          Tu cuenta está suspendida. Contacta con soporte para reactivarla.
        </p>
      </div>
    );
  }

  if (subscription.plan === "DEMO" && demoExpires && demoExpires < now) {
    return (
      <div className="mx-4 sm:mx-8 lg:mx-14 mt-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
        <p className="text-sm font-semibold text-red-700 flex-1">
          Tu periodo de prueba ha vencido.{" "}
          {onUpgradeClick && (
            <button onClick={onUpgradeClick} className="underline font-bold hover:text-red-800">
              Actualizar plan
            </button>
          )}
        </p>
      </div>
    );
  }

  if (subscription.plan === "DEMO" && daysLeft !== null && daysLeft <= 3) {
    return (
      <div className="mx-4 sm:mx-8 lg:mx-14 mt-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
        <Clock className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm font-semibold text-amber-700 flex-1">
          Tu periodo de prueba vence en {daysLeft} día{daysLeft !== 1 ? "s" : ""}.{" "}
          {onUpgradeClick && (
            <button onClick={onUpgradeClick} className="underline font-bold hover:text-amber-800">
              Actualizar plan
            </button>
          )}
        </p>
      </div>
    );
  }

  if (subscription.pending_plan) {
    return (
      <div className="mx-4 sm:mx-8 lg:mx-14 mt-2 rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0" />
        <p className="text-sm font-semibold text-blue-700 flex-1">
          Tu solicitud de cambio a {subscription.pending_plan} está en proceso.
        </p>
      </div>
    );
  }

  return null;
}
