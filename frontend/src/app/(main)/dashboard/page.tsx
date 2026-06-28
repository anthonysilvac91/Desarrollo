"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboard.service";
import ModuleContainer from "@/components/ui/ModuleContainer";
import KPICard from "@/components/dashboard/KPICard";
import RecentServicesCard from "@/components/dashboard/RecentServicesCard";
import AssetCoverageCard from "@/components/dashboard/AssetCoverageCard";
import OperatorActivityCard from "@/components/dashboard/OperatorActivityCard";
import SystemSummaryCard from "@/components/dashboard/SystemSummaryCard";
import AssetIcon from "@/components/ui/AssetIcon";
import { Loader2, AlertCircle, Inbox, Wrench, Clock, Plus, ArrowRight, UploadCloud, CalendarDays, HardHat, Building2, Users, Package, Bell, CheckCircle2 } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/formatDate";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";
import { subscriptionsService } from "@/services/subscriptions.service";

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  return { start: start.toISOString(), end: end.toISOString() };
};

const getLastDaysRange = (days: number) => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
};

type DashboardStats = Awaited<ReturnType<typeof dashboardService.getStats>>;

function WorkerMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-border-theme/40 bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <p className="text-2xl font-black leading-none text-title">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-subtitle/40">{label}</p>
    </div>
  );
}

function WorkerMobileDashboard({
  stats,
  t,
  language,
  assetIconId,
}: {
  stats?: DashboardStats;
  t: ReturnType<typeof useLanguage>["t"];
  language: string;
  assetIconId?: string | null;
}) {
  const lastServiceLabel = stats?.last_service
    ? formatRelativeTime(stats.last_service, language as "en" | "es")
    : "---";
  const latestService = stats?.recent_services?.[0];
  const weeklyTotal = stats?.evolution?.reduce((sum, point) => sum + point.value, 0) ?? 0;
  const WorkerAssetIcon = ({ className, strokeWidth }: { className?: string; strokeWidth?: number }) => (
    <AssetIcon iconId={assetIconId} className={className} strokeWidth={strokeWidth} />
  );

  return (
    <div className="sm:hidden space-y-4 pb-24">
      <div className="rounded-3xl border border-border-theme/40 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">{t.date_filters.today}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-title">{t.dashboard.kpis.my_services}</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-subtitle/55">
              {stats?.total_services ?? 0} {t.dashboard.kpis.services_performed.toLowerCase()} - {stats?.assets_serviced ?? 0} {t.dashboard.kpis.assets_attended.toLowerCase()}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/20">
            <Wrench className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>

        <Link
          href="/assets"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-black text-white shadow-lg shadow-brand/20 active:scale-[0.98] transition-transform"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          {t.mobile.nav.new_service}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <WorkerMetric label={t.dashboard.kpis.services_performed} value={stats?.total_services ?? 0} icon={Wrench} />
        <WorkerMetric label={t.dashboard.kpis.assets_attended} value={stats?.assets_serviced ?? 0} icon={WorkerAssetIcon} />
        <WorkerMetric label={t.dashboard.kpis.last_service} value={lastServiceLabel} icon={Clock} />
        <WorkerMetric label={t.date_filters.week} value={weeklyTotal} icon={CalendarDays} />
      </div>

      {stats?.private_services ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <UploadCloud className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-title">{stats.private_services} {t.dashboard.worker_mobile.pending_publication}</p>
            <p className="text-xs font-medium text-subtitle/55">{t.dashboard.worker_mobile.pending_publication_subtitle}</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-border-theme/40 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border-theme/20 px-5 py-4">
          <h3 className="text-lg font-black tracking-tight text-title">{t.dashboard.rankings.my_last_services}</h3>
          <Link href="/service" className="text-brand">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        {(stats?.recent_services?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
            <Inbox className="mb-3 h-8 w-8 text-subtitle/20" />
            <p className="text-sm font-black text-title/60">{t.dashboard.modules.recent_services.empty_title}</p>
            <p className="mt-1 text-xs font-medium text-subtitle/40">{t.dashboard.modules.recent_services.empty_subtitle}</p>
          </div>
        ) : (
          <div className="divide-y divide-border-theme/10">
            {stats?.recent_services.slice(0, 4).map((service) => (
              <Link key={service.id} href="/service" className="flex items-start gap-3 px-5 py-4 active:bg-app-bg">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-title">{service.title}</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-subtitle/55">{service.asset_name}</p>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-subtitle/35">{formatDate(service.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border-theme/40 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black tracking-tight text-title">{t.dashboard.rankings.my_last_assets}</h3>
          <Link href="/assets" className="text-brand">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
        {(stats?.top_assets?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm font-bold text-subtitle/35">{t.assets.states.empty_title}</p>
        ) : (
          <div className="space-y-2">
            {stats?.top_assets.slice(0, 4).map((asset) => (
              <Link key={asset.id} href={`/assets/${asset.id}`} className="flex items-center justify-between rounded-2xl bg-app-bg px-4 py-3 active:scale-[0.99] transition-transform">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-title">{asset.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-subtitle/35">{t.dashboard.rankings.jobs_count}</p>
                </div>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-xl bg-white px-2 text-sm font-black text-brand shadow-sm">
                  {asset.metric}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {latestService && (
        <div className="rounded-2xl border border-border-theme/40 bg-app-bg px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-subtitle/35">{t.dashboard.kpis.last_service}</p>
          <p className="mt-1 truncate text-sm font-bold text-title">{latestService.title}</p>
        </div>
      )}
    </div>
  );
}

function ChartDateFilter({
  activePreset,
  onDateChange,
  t,
}: {
  activePreset: string;
  onDateChange: (preset: string, start?: string, end?: string) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCustomOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsCustomOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCustomOpen]);

  const handlePresetClick = (preset: string) => {
    if (preset === "Personalizado") {
      setIsCustomOpen((value) => !value);
      return;
    }
    setIsCustomOpen(false);
    onDateChange(preset);
  };

  const handleCustomChange = (field: "start" | "end", value: string) => {
    const nextRange = { ...customRange, [field]: value };
    setCustomRange(nextRange);
    if (nextRange.start && nextRange.end) {
      onDateChange("Personalizado", nextRange.start, nextRange.end);
    }
  };

  const presets = [
    { value: "Hoy", label: t.date_filters.today },
    { value: "Mes", label: t.date_filters.month },
    { value: "Año", label: t.date_filters.year },
    { value: "Personalizado", label: t.date_filters.custom },
  ];

  return (
    <div ref={popoverRef} className="relative shrink-0">
      <div className="flex max-w-full items-center overflow-x-auto rounded-2xl border border-border-theme/40 bg-subtitle/5 p-1 custom-scroll">
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetClick(preset.value)}
            className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-black transition-all sm:px-4 ${
              activePreset === preset.value
                ? "bg-white text-brand shadow-sm ring-1 ring-black/5"
                : "text-subtitle/45 hover:text-subtitle"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {isCustomOpen && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[min(320px,calc(100vw-2rem))] rounded-3xl border border-border-theme/60 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <label className="ml-1 text-[12px] font-black uppercase tracking-wider text-brand">{t.date_filters.from}</label>
              <input
                type="date"
                className="w-full rounded-xl border border-border-theme/40 bg-app-bg px-4 py-3 text-sm font-bold text-title transition-all focus:outline-none focus:border-brand"
                value={customRange.start}
                onChange={(event) => handleCustomChange("start", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[12px] font-black uppercase tracking-wider text-brand">{t.date_filters.to}</label>
              <input
                type="date"
                className="w-full rounded-xl border border-border-theme/40 bg-app-bg px-4 py-3 text-sm font-bold text-title transition-all focus:outline-none focus:border-brand"
                value={customRange.end}
                onChange={(event) => handleCustomChange("end", event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsCustomOpen(false)}
              className="mt-2 w-full rounded-xl bg-brand py-3 text-sm font-black text-white transition-all hover:bg-brand/90"
            >
              {t.date_filters.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Super Admin Dashboard ────────────────────────────────────────────────────

const PLAN_STYLES: Record<string, { pill: string; bar: string }> = {
  DEMO:       { pill: "bg-slate-50 text-slate-600 border-slate-200",    bar: "bg-slate-300" },
  STARTER:    { pill: "bg-blue-50 text-blue-600 border-blue-200",       bar: "bg-blue-400" },
  PRO:        { pill: "bg-violet-50 text-violet-600 border-violet-200", bar: "bg-violet-500" },
  BUSINESS:   { pill: "bg-amber-50 text-amber-600 border-amber-200",    bar: "bg-amber-400" },
  ENTERPRISE: { pill: "bg-emerald-50 text-emerald-600 border-emerald-200", bar: "bg-emerald-400" },
};

const STATUS_META: Record<string, { dot: string; label: string }> = {
  ACTIVE:    { dot: "bg-emerald-400", label: "Activa" },
  TRIALING:  { dot: "bg-blue-400",    label: "Trial" },
  SUSPENDED: { dot: "bg-amber-400",   label: "Suspendida" },
  CANCELLED: { dot: "bg-red-400",     label: "Cancelada" },
};

const PLAN_ORDER = ["DEMO", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];

function SuperAdminDashboard() {
  const { data: subs, isLoading } = useQuery({
    queryKey: ["subscriptions-all"],
    queryFn: () => subscriptionsService.listAll(),
    refetchInterval: AUTO_REFETCH_INTERVALS.dashboard,
    ...AUTO_REFETCH_OPTIONS,
  });

  const totalOrgs   = subs?.length ?? 0;
  const activeOrgs  = subs?.filter(s => s.organization.is_active && s.subscription.status === "ACTIVE").length ?? 0;
  const totalUsers  = subs?.reduce((acc, s) => acc + s.usage.users,  0) ?? 0;
  const totalAssets = subs?.reduce((acc, s) => acc + s.usage.assets, 0) ?? 0;

  const planCounts: Record<string, number> = {};
  subs?.forEach(s => {
    const p = s.subscription.plan;
    planCounts[p] = (planCounts[p] ?? 0) + 1;
  });

  const pendingChanges = subs?.filter(s => s.subscription.pending_plan) ?? [];

  const topClients = [...(subs ?? [])]
    .sort((a, b) => b.usage.users - a.usage.users || b.usage.assets - a.usage.assets)
    .slice(0, 8);

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-40 animate-pulse">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">Cargando plataforma...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          title="Total clientes"
          value={totalOrgs}
          subtitle="Organizaciones registradas"
          icon={Building2}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          roundedClass="rounded-2xl"
        />
        <KPICard
          title="Clientes activos"
          value={activeOrgs}
          subtitle="Con suscripción activa"
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          roundedClass="rounded-2xl"
        />
        <KPICard
          title="Usuarios totales"
          value={totalUsers}
          subtitle="En toda la plataforma"
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          roundedClass="rounded-2xl"
        />
        <KPICard
          title="Activos totales"
          value={totalAssets}
          subtitle="Gestionados en plataforma"
          icon={Package}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          roundedClass="rounded-2xl"
        />
      </div>

      {/* Pending changes banner */}
      {pendingChanges.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <Bell className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm font-bold text-amber-700 flex-1">
            {pendingChanges.length} organización{pendingChanges.length > 1 ? "es" : ""} con solicitud de cambio de plan pendiente
          </p>
          <Link href="/organizations" className="text-xs font-black text-amber-600 underline underline-offset-2">
            Revisar
          </Link>
        </div>
      )}

      {/* Plan distribution + Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">

        {/* Plan distribution */}
        <ModuleContainer roundedClass="rounded-2xl">
          <div className="p-5 flex flex-col gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-subtitle/40">Por plan</p>
            <div className="flex flex-col gap-3.5">
              {PLAN_ORDER.map(plan => {
                const count = planCounts[plan] ?? 0;
                if (count === 0) return null;
                const styles = PLAN_STYLES[plan];
                const pct = totalOrgs > 0 ? Math.round((count / totalOrgs) * 100) : 0;
                return (
                  <div key={plan} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles.pill}`}>
                        {plan}
                      </span>
                      <span className="text-sm font-black text-title">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border-theme/20 overflow-hidden">
                      <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {totalOrgs === 0 && (
                <p className="text-sm font-bold text-subtitle/30 text-center py-4">Sin datos</p>
              )}
            </div>
          </div>
        </ModuleContainer>

        {/* Clients table */}
        <ModuleContainer roundedClass="rounded-2xl">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border-theme/20">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-subtitle/40">Clientes</p>
            <Link href="/organizations" className="flex items-center gap-1 text-[11px] font-black text-brand hover:opacity-70 transition-opacity">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border-theme/15">
            {topClients.length === 0 ? (
              <div className="py-12 text-center text-sm font-bold text-subtitle/30">Sin organizaciones</div>
            ) : topClients.map(item => {
              const plan   = item.subscription.plan;
              const status = item.subscription.status;
              const ps     = PLAN_STYLES[plan] ?? { pill: "", bar: "" };
              const ss     = STATUS_META[status] ?? { dot: "bg-subtitle/30", label: status };
              return (
                <div key={item.organization.id} className="flex items-center gap-3 sm:gap-4 px-5 py-3 hover:bg-app-bg/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-title truncate">{item.organization.name}</p>
                    <p className="text-[10px] font-medium text-subtitle/35 truncate">{item.organization.slug}</p>
                  </div>
                  <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${ps.pill}`}>
                    {plan}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                    <span className="text-[11px] font-bold text-subtitle/45 hidden sm:block">{ss.label}</span>
                  </div>
                  <div className="text-right shrink-0 w-12">
                    <p className="text-sm font-black text-title">{item.usage.users}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-subtitle/30">users</p>
                  </div>
                  <div className="text-right shrink-0 w-12">
                    <p className="text-sm font-black text-title">{item.usage.assets}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-subtitle/30">assets</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ModuleContainer>
      </div>
    </div>
  );
}

// ── Dashboard principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>(() => getLastDaysRange(30));
  const [activePreset, setActivePreset] = useState("Mes");
  const [workerDefaultApplied, setWorkerDefaultApplied] = useState(false);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isWorker = user?.role === "WORKER";
  const isExternal = user?.role === "EXTERNAL";
  const assetIconId = user?.organization?.default_asset_icon;
  const DashboardAssetIcon = ({ className, strokeWidth }: { className?: string; strokeWidth?: number }) => (
    <AssetIcon iconId={assetIconId} className={className} strokeWidth={strokeWidth} />
  );

  useEffect(() => {
    if (!isWorker || workerDefaultApplied) return;
    setActivePreset("Hoy");
    setDateRange(getTodayRange());
    setWorkerDefaultApplied(true);
  }, [isWorker, workerDefaultApplied]);

  const presetLabel: Record<string, string> = {
    "Hoy": t.date_filters.today,
    "Mes": t.date_filters.month,
    "Año": t.date_filters.year,
    "Personalizado": t.date_filters.custom,
    "Todo": t.common.all,
  };

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-stats", dateRange],
    queryFn: () => dashboardService.getStats({
      startDate: dateRange.start,
      endDate: dateRange.end
    }),
    enabled: !isSuperAdmin,
    refetchInterval: AUTO_REFETCH_INTERVALS.dashboard,
    ...AUTO_REFETCH_OPTIONS,
  });

  const handleDateChange = (preset: string, start?: string, end?: string) => {
    setActivePreset(preset);
    
    if (preset === "Todo" || preset === null) {
      setDateRange({});
      return;
    }

    if (preset === "Personalizado" && start && end) {
      setDateRange({ start, end });
      return;
    }

    const now = new Date();
    const startDate = new Date();

    if (preset === "Hoy") {
      startDate.setHours(0, 0, 0, 0);
    } else if (preset === "Mes") {
      startDate.setDate(now.getDate() - 30);
    } else if (preset === "Año") {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    setDateRange({ start: startDate.toISOString(), end: now.toISOString() });
  };



  if (isSuperAdmin) return <SuperAdminDashboard />;

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-40 animate-pulse">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.dashboard.states.loading}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center py-32 space-y-4">
        <div className="p-4 bg-error/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div className="text-center">
          <p className="font-black text-title text-xl">{t.dashboard.states.error_title}</p>
          <p className="text-subtitle font-medium">{t.dashboard.states.error_subtitle}</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="px-8 py-3 bg-title text-white rounded-2xl font-black text-sm transition-all hover:scale-105 active:scale-95 shadow-xl shadow-title/20"
        >
          {t.dashboard.states.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col space-y-5 sm:space-y-6">
      {isWorker && <WorkerMobileDashboard stats={stats} t={t} language={language} assetIconId={assetIconId} />}

      <div className={isWorker ? "hidden min-w-0 flex-col space-y-5 sm:flex sm:space-y-6" : "flex min-w-0 flex-col space-y-5 sm:space-y-6"}>
        {/* KPI Section */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <KPICard
            title={t.dashboard.kpis.jobs_performed}
            value={stats?.total_services ?? 0}
            subtitle={t.dashboard.kpis.subtitle_services_performed}
            icon={Wrench}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            roundedClass="rounded-2xl"
          />
          <KPICard
            title={t.dashboard.kpis.assets_serviced}
            value={stats?.assets_serviced ?? 0}
            subtitle={t.dashboard.kpis.subtitle_assets_serviced}
            icon={DashboardAssetIcon}
            iconBg="bg-cyan-50"
            iconColor="text-cyan-500"
            roundedClass="rounded-2xl"
          />
          <KPICard
            title={t.dashboard.kpis.last_service}
            value={stats?.last_service ? formatRelativeTime(stats.last_service, language as "en" | "es") : "---"}
            subtitle={stats?.last_service ? t.dashboard.kpis.subtitle_last_service : t.dashboard.kpis.subtitle_no_service}
            icon={Clock}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            roundedClass="rounded-2xl"
          />
          <KPICard
            title={t.dashboard.kpis.active_operators}
            value={stats?.active_operators ?? 0}
            subtitle={t.dashboard.kpis.subtitle_active_operators}
            icon={HardHat}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            roundedClass="rounded-2xl"
          />
        </div>

        {/* Evolution Chart Section */}
        {!isExternal && (
          <ModuleContainer roundedClass="rounded-2xl">
            <div className="p-4 sm:p-6 lg:p-7 space-y-5 sm:space-y-8">
              <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
                <div className="space-y-0.5">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-title tracking-tight">
                    {t.dashboard.charts.evolution_title}
                  </h2>
                  <p className="text-[13px] text-subtitle/60 font-medium tracking-tight">
                    {t.dashboard.charts.period_label}: {presetLabel[activePreset] ?? activePreset}
                  </p>
                </div>

                <ChartDateFilter activePreset={activePreset} onDateChange={handleDateChange} t={t} />
              </div>

              <div className="h-[240px] sm:h-[280px] lg:h-[260px] w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.evolution || []} margin={{ top: 5, right: 8, left: -20, bottom: 8 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--theme-primary)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--theme-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} 
                  />
                  <Tooltip cursor={{ stroke: "var(--theme-primary)", strokeWidth: 2, strokeDasharray: "4 4" }} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="var(--theme-primary)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    animationDuration={1500}
                  />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ModuleContainer>
        )}

        {/* Lower Dashboard Modules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[6.5fr_2.5fr_2.5fr_1.5fr] gap-4 sm:gap-5">
          <div className="sm:col-span-2 xl:col-span-1">
            <RecentServicesCard
              services={stats?.recent_services ?? []}
              t={t}
            />
          </div>
          <AssetCoverageCard
            totalAssets={stats?.total_assets ?? 0}
            assetsServiced={stats?.assets_serviced ?? 0}
            t={t}
          />
          <OperatorActivityCard
            operators={stats?.top_workers ?? []}
            t={t}
          />
          <div className="sm:col-span-2 xl:col-span-1">
            <SystemSummaryCard
              totalAssets={stats?.total_assets ?? 0}
              totalOwners={stats?.total_owners ?? 0}
              totalWorkers={stats?.total_workers ?? 0}
              totalAdmins={stats?.total_admins ?? 0}
              assetIconId={assetIconId}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
