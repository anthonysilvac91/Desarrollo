"use client";

import React, { useState } from "react";
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
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import KPICard from "@/components/dashboard/KPICard";
import PerformanceList from "@/components/dashboard/PerformanceList";

// --- MOCK DATA ---
const KPI_DATA = {
  jobs: { value: 128, trend: 12.5 },
  assets: { value: 42, trend: 8.2 },
  clients: { value: 36, trend: 5.1 },
  efficiency: { value: "+18%", trend: 15.4 }
};

const CHART_DATA = [
  { name: "Lun", value: 12 },
  { name: "Mar", value: 18 },
  { name: "Mié", value: 15 },
  { name: "Jue", value: 25 },
  { name: "Vie", value: 32 },
  { name: "Sáb", value: 28 },
  { name: "Dom", value: 20 },
];

const TOP_ASSETS = [
  { id: 1, name: "Sea Voyager 450", metric: 12, icon: Ship },
  { id: 2, name: "Azimut Atlantic", metric: 9, icon: Ship },
  { id: 3, name: "Sunseeker Predator", metric: 7, icon: Ship },
];

const TOP_CLIENTS = [
  { id: 1, name: "Marine Holdings Ltd", metric: 24, icon: Building2 },
  { id: 2, name: "Adriatic Charters", metric: 18, icon: Building2 },
  { id: 3, name: "Global Yachts Corp", metric: 15, icon: Building2 },
];

const TOP_OPERATORS = [
  { id: 1, name: "Carlos Rodríguez", metric: 42, icon: UserCircle },
  { id: 2, name: "Ana Martínez", metric: 38, icon: UserCircle },
  { id: 3, name: "Juan Pérez", metric: 35, icon: UserCircle },
];

export default function DashboardPage() {
  const { t } = useLanguage();
  const [activePreset, setActivePreset] = useState("Mes");

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-border-theme/40 rounded-2xl shadow-2xl flex flex-col space-y-1">
          <p className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest">{label}</p>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-brand" />
            <p className="text-sm font-black text-title">{payload[0].value} {t.dashboard.rankings.jobs_count}</p>
          </div>
        </div>
      );
    }
    return null;
  };

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
          title={t.dashboard.kpis.jobs_performed}
          value={KPI_DATA.jobs.value}
        />
        <KPICard 
          title={t.dashboard.kpis.assets_serviced}
          value={KPI_DATA.assets.value}
        />
        <KPICard 
          title={t.dashboard.kpis.clients_reached}
          value={KPI_DATA.clients.value}
        />
        <KPICard 
          title={t.dashboard.kpis.growth}
          value={KPI_DATA.efficiency.value}
        />
      </div>

      {/* Evolution Chart Section */}
      <ModuleContainer>
        <div className="p-6 lg:p-7 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-xl lg:text-2xl font-black text-title tracking-tight">{t.dashboard.charts.evolution_title}</h2>
              <p className="text-[13px] text-subtitle/60 font-medium tracking-tight">Análisis de rendimiento durante el periodo: {activePreset}</p>
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
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '4 4' }} />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ModuleContainer>
          <div className="p-6">
            <PerformanceList 
              title={t.dashboard.rankings.top_assets}
              items={TOP_ASSETS}
              metricLabel={t.dashboard.rankings.jobs_count}
            />
          </div>
        </ModuleContainer>

        <ModuleContainer>
          <div className="p-6">
            <PerformanceList 
              title={t.dashboard.rankings.top_clients}
              items={TOP_CLIENTS}
              metricLabel={t.dashboard.rankings.jobs_count}
            />
          </div>
        </ModuleContainer>

        <ModuleContainer>
          <div className="p-6">
            <PerformanceList 
              title={t.dashboard.rankings.top_operators}
              items={TOP_OPERATORS}
              metricLabel={t.dashboard.rankings.jobs_count}
            />
          </div>
        </ModuleContainer>
      </div>
      
    </div>
  );
}
