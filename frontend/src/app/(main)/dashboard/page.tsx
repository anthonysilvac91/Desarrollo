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
import PerformanceList from "@/components/dashboard/PerformanceList";
import { Loader2, AlertCircle, Briefcase, Ship, Inbox } from "lucide-react";

export default function DashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activePreset, setActivePreset] = useState("Mes");

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardService.getStats(),
  });

  const isWorker = user?.role === "WORKER";
  const isClient = user?.role === "CLIENT";

  // Chart data placeholder (trend data — backend evolution endpoint pending)
  const CHART_DATA = [
    { name: "Mon", value: 12 },
    { name: "Tue", value: 18 },
    { name: "Wed", value: 15 },
    { name: "Thu", value: 25 },
    { name: "Fri", value: 32 },
    { name: "Sat", value: 28 },
    { name: "Sun", value: 20 },
  ];

  // Map recent services for worker/client role views
  const recentItems = stats?.recent_services.slice(0, 3).map(s => ({
    id: s.id,
    name: s.asset_name,
    metric: 1,
    icon: isClient ? Briefcase : Ship
  })) || [];

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
    <div className="flex flex-col space-y-5">
      
      {/* Filters Header (Hide for client for extra simplicity) */}
      {!isClient && (
        <FiltersBar 
          showQuickFilters={true}
          showSearch={false}
          onDateChange={(preset) => setActivePreset(preset)}
        />
      )}

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title={isClient ? t.dashboard.kpis.services_received : (isWorker ? t.dashboard.kpis.my_services : t.dashboard.kpis.jobs_performed)}
          value={stats?.total_services || 0}
        />
        <KPICard 
          title={isClient ? t.dashboard.kpis.my_assets : (isWorker ? t.dashboard.kpis.assets_attended : t.dashboard.kpis.assets_serviced)}
          value={stats?.total_assets || 0}
        />
        {!isWorker && !isClient && (
          <>
            <KPICard 
              title={t.dashboard.kpis.clients_reached}
              value={stats?.total_clients || 0}
            />
            <KPICard 
              title={t.dashboard.kpis.growth}
              value={hasData ? "+12%" : "---"} 
            />
          </>
        )}
      </div>

      {/* Evolution Chart Section (Hide for Client) */}
      {!isClient && hasData && (
        <ModuleContainer>
          <div className="p-6 lg:p-7 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-xl lg:text-2xl font-black text-title tracking-tight">
                  {t.dashboard.charts.evolution_title}
                </h2>
                <p className="text-[13px] text-subtitle/60 font-medium tracking-tight">
                  {t.dashboard.charts.period_label}: {activePreset}
                </p>
              </div>
              
              <div className="flex items-center space-x-2.5 px-4 py-2 bg-brand/5 border border-brand/10 rounded-xl w-fit">
                <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                <span className="text-[11px] font-black text-brand uppercase tracking-wider">{t.dashboard.charts.live_badge}</span>
              </div>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
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

      {/* Rankings Section */}
      {hasData ? (
        <div className={`grid grid-cols-1 ${ (isWorker || isClient) ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-5`}>
          <ModuleContainer>
            <div className="p-6">
              <PerformanceList 
                title={isClient ? t.dashboard.rankings.my_last_services : (isWorker ? t.dashboard.rankings.my_last_assets : t.dashboard.rankings.top_assets)}
                items={(isWorker || isClient) ? recentItems : []} 
                metricLabel={isClient ? t.dashboard.rankings.listed_label : (isWorker ? t.dashboard.rankings.recent_label : t.dashboard.rankings.jobs_count)}
              />
            </div>
          </ModuleContainer>

          {!isWorker && !isClient && (
            <>
              <ModuleContainer>
                <div className="p-6">
                  <PerformanceList 
                    title={t.dashboard.rankings.top_clients}
                    items={[]}
                    metricLabel={t.dashboard.rankings.jobs_count}
                  />
                </div>
              </ModuleContainer>

              <ModuleContainer>
                <div className="p-6">
                  <PerformanceList 
                    title={t.dashboard.rankings.top_operators}
                    items={[]}
                    metricLabel={t.dashboard.rankings.jobs_count}
                  />
                </div>
              </ModuleContainer>
            </>
          )}
        </div>
      ) : (
        <ModuleContainer>
          <div className="w-full flex flex-col items-center justify-center py-24 space-y-4">
            <div className="p-5 bg-app-bg rounded-full">
              <Inbox className="w-10 h-10 text-subtitle/20" />
            </div>
            <div className="text-center">
              <p className="font-black text-title text-xl">{t.dashboard.states.empty_title}</p>
              <p className="text-subtitle font-medium">{t.dashboard.states.empty_subtitle}</p>
            </div>
          </div>
        </ModuleContainer>
      )}
      
    </div>
  );
}
