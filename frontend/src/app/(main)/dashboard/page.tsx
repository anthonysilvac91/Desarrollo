"use client";

import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Box, 
  Users, 
  TrendingUp, 
  UserCircle,
  Ship,
  Building2
} from "lucide-react";
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
import { dashboardService, DashboardStats } from "@/services/dashboard.service";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import KPICard from "@/components/dashboard/KPICard";
import PerformanceList from "@/components/dashboard/PerformanceList";

export default function DashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activePreset, setActivePreset] = useState("Mes");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await dashboardService.getStats();
        setStats(data);
      } catch (err) {
        console.error("Error loading stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const isWorker = user?.role === "WORKER";

  // Chart data placeholder (evolución todavía mock en backend)
  const CHART_DATA = [
    { name: "Lun", value: 12 },
    { name: "Mar", value: 18 },
    { name: "Mié", value: 15 },
    { name: "Jue", value: 25 },
    { name: "Vie", value: 32 },
    { name: "Sáb", value: 28 },
    { name: "Dom", value: 20 },
  ];

  // Map recent services to top assets for worker (as a quick way to reuse the component)
  const topAssets = stats?.recent_services.slice(0, 3).map(s => ({
    id: s.id,
    name: s.asset_name,
    metric: 1, // Placeholder metric for worker view
    icon: Ship
  })) || [];

  if (loading) return <div className="p-8 text-subtitle">Cargando dashboard...</div>;

  return (
    <div className="flex flex-col space-y-5">
      
      {/* Filters Header */}
      <FiltersBar 
        showQuickFilters={true}
        showSearch={false}
        onDateChange={(preset) => setActivePreset(preset)}
      />

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title={isWorker ? "Mis Servicios" : t.dashboard.kpis.jobs_performed}
          value={stats?.total_services || 0}
        />
        <KPICard 
          title={isWorker ? "Activos Atendidos" : t.dashboard.kpis.assets_serviced}
          value={stats?.total_assets || 0}
        />
        {!isWorker && (
          <>
            <KPICard 
              title={t.dashboard.kpis.clients_reached}
              value={stats?.total_clients || 0}
            />
            <KPICard 
              title={t.dashboard.kpis.growth}
              value="+12%" // Placeholder trend
            />
          </>
        )}
      </div>

      {/* Evolution Chart Section */}
      <ModuleContainer>
        <div className="p-6 lg:p-7 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-xl lg:text-2xl font-black text-title tracking-tight">
                {isWorker ? "Mi Rendimiento" : t.dashboard.charts.evolution_title}
              </h2>
              <p className="text-[13px] text-subtitle/60 font-medium tracking-tight">
                Análisis de rendimiento durante el periodo: {activePreset}
              </p>
            </div>
            
            <div className="flex items-center space-x-2.5 px-4 py-2 bg-brand/5 border border-brand/10 rounded-xl w-fit">
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="text-[11px] font-black text-brand uppercase tracking-wider">Live Metrics</span>
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

      {/* Rankings Section */}
      <div className={`grid grid-cols-1 ${isWorker ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-5`}>
        <ModuleContainer>
          <div className="p-6">
            <PerformanceList 
              title={isWorker ? "Últimos Activos" : t.dashboard.rankings.top_assets}
              items={isWorker ? topAssets : []} // Admin view rankings placeholder
              metricLabel={isWorker ? "Reciente" : t.dashboard.rankings.jobs_count}
            />
          </div>
        </ModuleContainer>

        {!isWorker && (
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
      
    </div>
  );
}
