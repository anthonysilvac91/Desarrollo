"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { usersService } from "@/services/users.service";
import { servicesService, Service } from "@/services/services.service";
import ServiceDrawer from "@/components/services/ServiceDrawer";
import ServiceAttachmentCard from "@/components/services/ServiceAttachmentCard";
import { formatDate } from "@/lib/formatDate";
import {
  Loader2, AlertCircle, ChevronLeft, History, Calendar,
  Ship, SlidersHorizontal, X, Shield, Mail, Phone,
  Wrench, Info,
} from "lucide-react";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";

const ROLE_LABELS: Record<string, { en: string; es: string }> = {
  SUPER_ADMIN: { en: "Super Admin", es: "Super Admin" },
  ADMIN:       { en: "Admin",       es: "Admin" },
  WORKER:      { en: "Worker",      es: "Operador" },
  EXTERNAL:    { en: "External",    es: "Externo" },
};

const getRoleStyle = (role: string) => {
  const styles: Record<string, string> = {
    SUPER_ADMIN: "bg-indigo-50 text-indigo-600 border-indigo-100",
    ADMIN:       "bg-indigo-50 text-indigo-600 border-indigo-100",
    WORKER:      "bg-amber-50 text-amber-600 border-amber-100",
    EXTERNAL:    "bg-slate-100 text-slate-600 border-slate-200",
  };
  return styles[role] || "bg-gray-50 text-gray-600 border-gray-100";
};

// ─── Job card adaptada: muestra activo en vez de worker ─────────────────────
const UserJobCard = ({ job, onClick }: { job: Service; onClick?: () => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollHeight > textRef.current.clientHeight);
    }
  }, [job.description]);

  return (
    <div
      onClick={onClick}
      className="group flex flex-col bg-surface rounded-4xl border border-border-theme/40 overflow-hidden hover:border-brand/40 hover:shadow-2xl transition-all duration-300 cursor-pointer"
    >
      <div className="flex-1 p-8">
        {/* Badges: fecha + activo */}
        <div className="flex items-center space-x-3 mb-4 flex-wrap gap-y-2">
          <div className="bg-brand/5 px-3 py-1.5 rounded-full flex items-center border border-brand/5">
            <Calendar className="w-3.5 h-3.5 text-brand mr-2" />
            <span className="text-[10px] font-black text-brand uppercase tracking-wider">
              {formatDate(job.created_at)}
            </span>
          </div>
          {job.asset?.name && (
            <div className="bg-app-bg px-3 py-1.5 rounded-full flex items-center border border-border-theme/60">
              <Ship className="w-3.5 h-3.5 text-subtitle/40 mr-2" />
              <span className="text-[10px] font-black text-subtitle/60 uppercase tracking-wider truncate max-w-[140px]">
                {job.asset.name}
              </span>
            </div>
          )}
        </div>

        {/* Título */}
        <h4 className="text-xl font-bold text-title group-hover:text-brand transition-colors tracking-tight mb-3">
          {job.title}
        </h4>

        {/* Descripción con expand */}
        {job.description && (
          <div className="relative">
            <p
              ref={textRef}
              className={`text-[15px] text-subtitle/70 leading-relaxed font-bold transition-all duration-300 whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-3"}`}
            >
              {job.description}
            </p>
            {(isTruncated || isExpanded) && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(v => !v); }}
                className="mt-2 text-[11px] font-black text-brand uppercase tracking-widest hover:underline"
              >
                {isExpanded ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
        )}

        {/* Miniaturas de adjuntos */}
        {job.attachments && job.attachments.length > 0 && (
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border-theme/10">
            {job.attachments.slice(0, 4).map((img, idx) => (
              <ServiceAttachmentCard
                key={idx}
                attachment={img as any}
                alt="Evidencia"
                size="sm"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Página principal ────────────────────────────────────────────────────────
export default function UserDetailPage() {
  const router = useRouter();
  const { id: userId } = useParams() as { id: string };
  const { language } = useLanguage();

  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Datos del usuario
  const { data: user, isLoading: isUserLoading, isError: isUserError } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => usersService.findOne(userId),
    enabled: !!userId,
    ...AUTO_REFETCH_OPTIONS,
  });

  // Servicios realizados por este usuario
  const { data: servicesData, isLoading: isServicesLoading } = useQuery({
    queryKey: ["services", "by-worker", userId],
    queryFn: () => servicesService.findAll({ worker_id: userId, limit: 100 }),
    enabled: !!userId,
    refetchInterval: AUTO_REFETCH_INTERVALS.fast,
    ...AUTO_REFETCH_OPTIONS,
  });

  const services: Service[] = useMemo(() => {
    if (!servicesData) return [];
    return Array.isArray(servicesData) ? servicesData : (servicesData?.data ?? []);
  }, [servicesData]);

  const filteredServices = useMemo(() => {
    let jobs = services;
    if (datePreset) {
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      jobs = jobs.filter(j => {
        const diffDays = (now.getTime() - new Date(j.created_at).getTime()) / oneDay;
        if (datePreset === "Hoy")    return diffDays <= 1;
        if (datePreset === "Semana") return diffDays <= 7;
        if (datePreset === "Mes")    return diffDays <= 30;
        if (datePreset === "Año")    return diffDays <= 365;
        return true;
      });
    } else if (startDate || endDate) {
      jobs = jobs.filter(j => {
        const d = new Date(j.created_at);
        if (startDate && d < new Date(startDate)) return false;
        if (endDate   && d > new Date(endDate))   return false;
        return true;
      });
    }
    return jobs;
  }, [services, datePreset, startDate, endDate]);

  const lastServiceDate = useMemo(() => {
    if (!services.length) return null;
    return services.reduce((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? a : b
    ).created_at;
  }, [services]);

  const hasFilters = !!(datePreset || startDate || endDate);
  const clearFilters = () => { setDatePreset(null); setStartDate(""); setEndDate(""); };

  // ── Loading / error ──────────────────────────────────────────────────────
  if (isUserLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
        <p className="font-black text-subtitle/40 tracking-widest text-xs uppercase">Cargando usuario...</p>
      </div>
    );
  }

  if (isUserError || !user) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-40 space-y-4">
        <div className="p-4 bg-error/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div className="text-center">
          <p className="font-black text-title text-xl">Error al cargar</p>
          <p className="text-subtitle font-medium">No se pudo obtener el usuario.</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-8 py-3 bg-title text-white rounded-2xl font-black text-sm"
        >
          Volver
        </button>
      </div>
    );
  }

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = ROLE_LABELS[user.role]?.[language] ?? user.role;

  return (
    <div className="flex flex-col space-y-6 pb-24 animate-in fade-in duration-500">

      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-3 rounded-full bg-surface border border-border-theme/60 hover:bg-app-bg transition-all shadow-sm shrink-0"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5px]" />
        </button>
        <h1 className="text-2xl sm:text-3xl font-black text-title tracking-tight leading-none">
          {user.name}
        </h1>
      </div>

      {/* ── 2. RESUMEN DE USUARIO ────────────────────────────────────────── */}
      <div className="bg-surface p-5 sm:p-8 rounded-3xl lg:rounded-[40px] border border-border-theme/40 shadow-soft">
        <div className="flex items-center space-x-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-app-bg shadow-lg bg-brand/10 flex items-center justify-center">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl sm:text-3xl font-black text-brand tracking-tighter">
                  {initials}
                </span>
              )}
            </div>
            {/* Dot de estado */}
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-surface ${user.is_active ? "bg-emerald-500" : "bg-rose-400"}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${getRoleStyle(user.role)}`}>
                <Shield className="w-3 h-3 mr-1.5" />
                {roleLabel}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${user.is_active ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                {user.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-subtitle/60">
              <Mail className="w-3.5 h-3.5 text-brand shrink-0" />
              <span className="text-xs font-bold truncate">{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex items-center gap-1.5 text-subtitle/60 mt-1">
                <Phone className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-xs font-bold">{user.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 pt-5 border-t border-border-theme/20 grid grid-cols-2 gap-4">
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-black text-subtitle/30 uppercase tracking-widest">
              Total servicios
            </span>
            <span className="text-2xl font-black text-title">
              {isServicesLoading
                ? <Loader2 className="w-5 h-5 animate-spin text-brand inline" />
                : services.length}
            </span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-black text-subtitle/30 uppercase tracking-widest">
              Último servicio
            </span>
            <span className="text-xl font-black text-title">
              {isServicesLoading ? "—" : lastServiceDate ? formatDate(lastServiceDate) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. TÍTULO DE SECCIÓN ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-[14px] font-black text-title uppercase tracking-[0.2em] flex items-center">
          <History className="w-4 h-4 mr-3 text-brand" />
          Historial de servicios
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFiltersOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-theme/40 text-subtitle text-xs font-bold"
          >
            {isFiltersOpen
              ? <X className="w-3.5 h-3.5" />
              : <SlidersHorizontal className="w-3.5 h-3.5" />}
            Filtrar
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── 4. FILTROS EXPANDIBLES ───────────────────────────────────────── */}
      {isFiltersOpen && (
        <div className="bg-surface rounded-2xl border border-border-theme/40 p-5 space-y-6">
          {/* Presets rápidos */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest">
              Período
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "Hoy",    label: "Hoy" },
                { key: "Semana", label: "Semana" },
                { key: "Mes",    label: "Mes" },
                { key: "Año",    label: "Año" },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => { setDatePreset(d => d === p.key ? null : p.key); setStartDate(""); setEndDate(""); }}
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-black transition-all ${
                    datePreset === p.key
                      ? "bg-brand text-white border-transparent"
                      : "border-border-theme/40 text-subtitle/60"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rango personalizado */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-subtitle/40 uppercase tracking-widest">
              Rango personalizado
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-subtitle/30 uppercase pl-1">Desde</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setDatePreset(null); }}
                  className="w-full px-3 py-2 bg-app-bg/10 border border-border-theme/10 rounded-xl text-[11px] font-bold text-subtitle focus:outline-none focus:border-brand/40"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-subtitle/30 uppercase pl-1">Hasta</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setDatePreset(null); }}
                  className="w-full px-3 py-2 bg-app-bg/10 border border-border-theme/10 rounded-xl text-[11px] font-bold text-subtitle focus:outline-none focus:border-brand/40"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. HISTORIAL ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {isServicesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>

        ) : services.length === 0 ? (
          <div className="relative overflow-hidden rounded-[32px] border border-brand/15 bg-surface px-6 py-10 text-center shadow-soft">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/10 text-brand ring-8 ring-brand/5">
              <Wrench className="h-9 w-9" strokeWidth={1.75} />
            </div>
            <div className="mx-auto max-w-md space-y-2">
              <h4 className="text-2xl font-black tracking-tight text-title">Sin servicios aún</h4>
              <p className="text-sm font-medium leading-relaxed text-subtitle/60">
                Los servicios realizados por este usuario aparecerán aquí.
              </p>
            </div>
          </div>

        ) : filteredServices.length === 0 ? (
          <div className="py-24 text-center bg-app-bg/10 border-2 border-dashed border-border-theme/50 rounded-[40px]">
            <Info className="w-12 h-12 text-subtitle/20 mx-auto mb-4" />
            <p className="text-subtitle/40 font-black uppercase tracking-widest text-sm">Sin resultados</p>
            <button
              onClick={clearFilters}
              className="mt-4 text-[10px] font-black text-brand uppercase tracking-widest"
            >
              Ver todos
            </button>
          </div>

        ) : (
          filteredServices.map(svc => (
            <UserJobCard
              key={svc.id}
              job={svc}
              onClick={() => setSelectedService(svc)}
            />
          ))
        )}
      </div>

      {/* ── ServiceDrawer (mismo que asset detail) ───────────────────────── */}
      <ServiceDrawer
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />
    </div>
  );
}
