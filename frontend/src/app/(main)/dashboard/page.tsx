"use client";

import React, { useState } from "react";
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
import FiltersBar from "@/components/ui/FiltersBar";
import KPICard from "@/components/dashboard/KPICard";
import RecentServicesCard from "@/components/dashboard/RecentServicesCard";
import AssetCoverageCard from "@/components/dashboard/AssetCoverageCard";
import OperatorActivityCard from "@/components/dashboard/OperatorActivityCard";
import SystemSummaryCard from "@/components/dashboard/SystemSummaryCard";
import { Loader2, AlertCircle, Inbox, Wrench, Clock, Users, Ship } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatDate";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [activePreset, setActivePreset] = useState("Mes");

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
    refetchInterval: AUTO_REFETCH_INTERVALS.dashboard,
    ...AUTO_REFETCH_OPTIONS,
  });

  const isWorker = user?.role === "WORKER";
  const isExternal = user?.role === "EXTERNAL";

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

  const hasData = (stats?.total_assets || 0) > 0 || (stats?.total_services || 0) > 0;

  return (
    <div className="flex min-w-0 flex-col space-y-5 sm:space-y-6">
      
      {!isExternal && (
        <FiltersBar 
          showQuickFilters={true}
          showSearch={false}
          defaultDatePreset={activePreset}
          onDateChange={handleDateChange}
        />
      )}

      {/* KPI Section */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        <KPICard
          title={t.dashboard.kpis.jobs_performed}
          value={stats?.total_services ?? 0}
          subtitle={t.dashboard.kpis.subtitle_services_performed}
          icon={Wrench}
        />
        <KPICard
          title={t.dashboard.kpis.assets_serviced}
          value={stats?.assets_serviced ?? 0}
          subtitle={t.dashboard.kpis.subtitle_assets_serviced}
          icon={Ship}
        />
        <KPICard
          title={t.dashboard.kpis.last_service}
          value={stats?.last_service ? formatRelativeTime(stats.last_service, language as "en" | "es") : "---"}
          subtitle={stats?.last_service ? t.dashboard.kpis.subtitle_last_service : t.dashboard.kpis.subtitle_no_service}
          icon={Clock}
        />
        <KPICard
          title={t.dashboard.kpis.active_operators}
          value={stats?.active_operators ?? 0}
          subtitle={t.dashboard.kpis.subtitle_active_operators}
          icon={Users}
        />
      </div>

      {/* Evolution Chart Section */}
      {!isExternal && hasData && (
        <ModuleContainer>
          <div className="p-4 sm:p-6 lg:p-7 space-y-5 sm:space-y-8">
            <div className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-title tracking-tight">
                  {t.dashboard.charts.evolution_title}
                </h2>
                <p className="text-[13px] text-subtitle/60 font-medium tracking-tight">
                  {t.dashboard.charts.period_label}: {presetLabel[activePreset] ?? activePreset}
                </p>
              </div>
              
              <div className="flex shrink-0 items-center space-x-2 px-3 sm:px-4 py-2 bg-brand/5 border border-brand/10 rounded-xl w-fit">
                <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                <span className="text-[10px] sm:text-[11px] font-black text-brand uppercase tracking-wider">{t.dashboard.charts.live_badge}</span>
              </div>
            </div>

            <div className="h-[240px] sm:h-[280px] lg:h-[260px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.evolution || []} margin={{ top: 5, right: 8, left: -20, bottom: 8 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                  <Tooltip cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '4 4' }} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
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
            t={t}
          />
        </div>
      </div>
      
    </div>
  );
}
