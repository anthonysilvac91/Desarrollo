"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import { Trash2, Wrench, User, Calendar, ChevronLeft, ChevronRight, ChevronDown, Loader2, AlertCircle, Inbox, Ship, Plus, CheckSquare, LayoutList, Search, ChevronRight as ChevronRightIcon, X } from "lucide-react";
import KPICard from "@/components/dashboard/KPICard";
import FilterDropdown from "@/components/ui/FilterDropdown";
import DateFilterDropdown from "@/components/ui/DateFilterDropdown";
import { useLanguage } from "@/lib/LanguageContext";
import ServiceDrawer from "@/components/services/ServiceDrawer";
import ServiceModal from "@/components/services/ServiceModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { servicesService, Service } from "@/services/services.service";
import { useToast } from "@/lib/ToastContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDate } from "@/lib/formatDate";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

interface ServiceCardProps {
  item: Service;
  onClick: () => void;
}

const ServiceCard = ({ item, onClick }: ServiceCardProps) => (
  <div
    onClick={onClick}
    className="bg-white rounded-2xl border border-border-theme/30 shadow-sm p-4 cursor-pointer active:scale-[0.99] transition-all"
  >
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
        <Wrench className="w-5 h-5 text-brand" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-title text-sm leading-tight">{item.title}</p>
        <p className="text-xs font-bold text-brand truncate mt-0.5">{item.asset?.name || "---"}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-[8px] font-black text-brand leading-none">
                {item.worker?.name ? getInitials(item.worker.name) : "?"}
              </span>
            </div>
            <span className="text-[11px] text-subtitle/70 font-semibold">{item.worker?.name || "---"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-brand shrink-0" />
            <span className="text-[11px] text-subtitle/70 font-semibold">{formatDate(item.created_at)}</span>
          </div>
        </div>
      </div>

      <ChevronRightIcon className="w-4 h-4 text-brand shrink-0" />
    </div>
  </div>
);

export default function ServicesPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canCreate = user?.role === "ADMIN" || user?.role === "WORKER";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const debouncedMobileSearch = useDebounce(mobileSearch, 300);
  const [dateFilter, setDateFilter] = useState<{preset: string, start?: string, end?: string}>({ preset: "Todo" });
  const [mobileDateFilter, setMobileDateFilter] = useState<{preset: string, start?: string, end?: string}>({ preset: "Todo" });
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileItems, setMobileItems] = useState<Service[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [activeSortKey, setActiveSortKey] = useState<string | null>(null);
  const [desktopWorkerFilter, setDesktopWorkerFilter] = useState("");
  const [mobileWorkerFilter, setMobileWorkerFilter] = useState("");
  const [isMobileWorkerOpen, setIsMobileWorkerOpen] = useState(false);
  const [mobileWorkerSearch, setMobileWorkerSearch] = useState("");
  const [mobileAssetFilter, setMobileAssetFilter] = useState("");
  const [isMobileAssetOpen, setIsMobileAssetOpen] = useState(false);
  const [mobileAssetSearch, setMobileAssetSearch] = useState("");
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const getQueryParams = () => {
    const params: any = { page, limit };
    if (debouncedSearch) params.search = debouncedSearch;
    if (dateFilter.preset !== "Todo") {
      params.preset = dateFilter.preset;
      if (dateFilter.preset === "Personalizado" && dateFilter.start && dateFilter.end) {
        params.startDate = dateFilter.start;
        params.endDate = dateFilter.end;
      }
    }
    return params;
  };

  const getMobileQueryParams = () => {
    const params: any = { page: mobilePage, limit: 10 };
    if (debouncedMobileSearch) params.search = debouncedMobileSearch;
    if (mobileDateFilter.preset !== "Todo") {
      params.preset = mobileDateFilter.preset;
      if (mobileDateFilter.preset === "Personalizado" && mobileDateFilter.start && mobileDateFilter.end) {
        params.startDate = mobileDateFilter.start;
        params.endDate = mobileDateFilter.end;
      }
    }
    if (mobileWorkerFilter) params.worker_id = mobileWorkerFilter;
    if (mobileAssetFilter) params.asset_id = mobileAssetFilter;
    return params;
  };

  const queryParams = {
    ...getQueryParams(),
    ...(desktopWorkerFilter ? { worker_id: desktopWorkerFilter } : {}),
  };

  const { data: responseData, isLoading, isError, refetch } = useQuery({
    queryKey: ["services", queryParams],
    queryFn: () => servicesService.findAll(queryParams),
    enabled: isMobile === false,
    refetchInterval: AUTO_REFETCH_INTERVALS.fast,
    ...AUTO_REFETCH_OPTIONS,
  });

  const mobileQueryParams = getMobileQueryParams();
  const { data: mobileResponseData, isLoading: mobileLoading, refetch: refetchMobile } = useQuery({
    queryKey: ["services-mobile", mobileQueryParams],
    queryFn: () => servicesService.findAll(mobileQueryParams),
    enabled: isMobile === true,
    refetchInterval: AUTO_REFETCH_INTERVALS.fast,
    ...AUTO_REFETCH_OPTIONS,
  });

  const statsParams = {
    ...(queryParams.preset ? { preset: queryParams.preset } : {}),
    ...(queryParams.startDate ? { startDate: queryParams.startDate } : {}),
    ...(queryParams.endDate ? { endDate: queryParams.endDate } : {}),
  };

  const { data: stats } = useQuery({
    queryKey: ["services-stats", statsParams],
    queryFn: () => servicesService.getStats(statsParams),
    refetchInterval: AUTO_REFETCH_INTERVALS.fast,
    ...AUTO_REFETCH_OPTIONS,
  });

  const { data: serviceFilterOptions } = useQuery({
    queryKey: ["services-workers-list"],
    queryFn: () => servicesService.getFilterOptions(),
    staleTime: 300000,
    ...AUTO_REFETCH_OPTIONS,
  });

  const workerOptions = useMemo(() => {
    return [...(serviceFilterOptions?.workers ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [serviceFilterOptions]);

  const assetOptions = useMemo(() => {
    return [...(serviceFilterOptions?.assets ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [serviceFilterOptions]);

  const servicesList = Array.isArray(responseData) ? responseData : responseData?.data || [];
  const meta = !Array.isArray(responseData) && responseData?.meta ? responseData.meta : { total: servicesList.length, page: 1, limit: 10, totalPages: 1 };

  const mobileList = Array.isArray(mobileResponseData) ? mobileResponseData : mobileResponseData?.data || [];
  const mobileMeta = !Array.isArray(mobileResponseData) && mobileResponseData?.meta
    ? mobileResponseData.meta
    : { total: mobileList.length, page: 1, limit: 10, totalPages: 1 };
  const isMobilePending = isMobile === null;
  const isMobileListLoading = isMobilePending || mobileLoading;
  const isDesktopListLoading = isMobilePending || isLoading;
  const refetchActiveServices = () => isMobile ? refetchMobile() : refetch();

  React.useEffect(() => { setPage(1); }, [debouncedSearch, dateFilter, limit, desktopWorkerFilter]);
  React.useEffect(() => { setMobilePage(1); setMobileItems([]); }, [debouncedMobileSearch, mobileDateFilter, mobileWorkerFilter, mobileAssetFilter]);

  useEffect(() => {
    if (!mobileResponseData) return;
    const newList: Service[] = Array.isArray(mobileResponseData) ? mobileResponseData : (mobileResponseData as any)?.data ?? [];
    if (mobilePage === 1) {
      setMobileItems(newList);
    } else {
      setMobileItems(prev => [...prev, ...newList]);
    }
  }, [mobileResponseData]);


  const handleDateChange = (preset: string, start?: string, end?: string) => {
    setDateFilter({ preset, start, end });
  };

  const handleConfirmDelete = async () => {
    if (serviceToDelete) {
      try {
        await servicesService.delete(serviceToDelete.id);
        showToast("Servicio eliminado con éxito.", "success");
        setServiceToDelete(null);
        refetchActiveServices();
      } catch (err) {
        showToast(t.feedback.generic_error, "error");
      }
    }
  };

  const handleDeleteRequest = (e: React.MouseEvent, service: Service) => {
    e.stopPropagation();
    setServiceToDelete(service);
  };

  const columns: ColumnDef<Service>[] = [
    {
      key: "service",
      header: t.services.table.service,
      sortable: true,
      sortValue: (item) => item.title,
      cell: (item) => (
        <div className="flex items-center space-x-3">
          <div className="rounded-full overflow-hidden border-2 border-surface shadow-sm bg-brand/10 flex items-center justify-center text-brand shrink-0" style={{ width: 52, height: 52 }}>
            <Wrench className="w-5 h-5" />
          </div>
          <span className="font-bold text-title text-xs">{item.title}</span>
        </div>
      )
    },
    {
      key: "asset",
      header: t.services.table.asset,
      sortable: true,
      sortValue: (item) => item.asset?.name || "",
      cell: (item) => (
        <div className="flex items-center text-subtitle/70">
          <Ship className="w-3.5 h-3.5 mr-1.5 text-brand" />
          <span className="text-xs font-semibold">{item.asset?.name || "---"}</span>
        </div>
      )
    },
    {
      key: "worker",
      header: t.services.table.operator,
      sortable: true,
      sortValue: (item) => item.worker?.name || "",
      cell: (item) => (
        <div className="flex items-center text-subtitle/80">
          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center mr-2 shrink-0">
            <span className="text-[10px] font-black text-brand">
              {item.worker?.name ? getInitials(item.worker.name) : "?"}
            </span>
          </div>
          <span className="font-bold text-subtitle/80 text-xs">{item.worker?.name || "---"}</span>
        </div>
      )
    },
    {
      key: "evidence",
      header: t.services.table.evidence,
      align: "center",
      sortable: true,
      sortValue: (item) => item.attachments?.length || 0,
      cell: (item) => (
        <div className="flex items-center justify-center">
          <span className="min-w-10 h-7 flex items-center justify-center text-xs font-bold text-title bg-app-bg rounded-lg border border-border-theme/40 px-2">
            {item.attachments?.length || 0}
          </span>
        </div>
      )
    },

    {
      key: "date",
      header: t.services.table.date,
      align: "center",
      sortable: true,
      sortValue: (item) => item.created_at,
      cell: (item) => (
        <div className="flex items-center justify-center text-subtitle/70">
          <Calendar className="w-3.5 h-3.5 mr-1.5 text-brand" />
          <span className="font-semibold text-xs">{formatDate(item.created_at)}</span>
        </div>
      )
    },
    {
      key: "actions",
      header: t.services.table.actions,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center">
          <button
            onClick={(e) => handleDeleteRequest(e, item)}
            className="p-1.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
            title="Eliminar servicio"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  const pagination = (
    <>
      <div className="flex items-center space-x-3">
        <div className="text-xs text-subtitle/40 font-medium tracking-tight">
          {t.services.pagination.showing}{" "}
          <span className="text-subtitle/70 font-bold">{servicesList.length}</span>{" "}
          {t.services.pagination.of}{" "}
          <span className="text-subtitle/70 font-bold">{meta.total}</span>{" "}
          {t.services.pagination.services}
        </div>
        <FilterDropdown
          value={String(limit)}
          onChange={(v) => { setLimit(Number(v)); setPage(1); }}
          options={[5, 10, 20, 50].map(n => ({ value: String(n), label: `${n} / ${t.common.per_page}` }))}
          placeholder=""
          showReset={false}
          compact
          neutral
          up
        />
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-md shadow-brand/20">{page}</button>
        <button
          onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
          disabled={page >= meta.totalPages}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div>
      {/* ── Mobile ── */}
      <div className="lg:hidden flex flex-col gap-4 pb-8">
        <h1 className="text-2xl font-black text-title tracking-tight text-center">
          {t.topbar.titles.services}
        </h1>

        {/* Mobile search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-subtitle/40" />
          <input
            type="text"
            value={mobileSearch}
            onChange={e => setMobileSearch(e.target.value)}
            placeholder={t.services.search_placeholder}
            className="w-full pl-10 pr-4 py-3 bg-white border border-border-theme/30 rounded-2xl text-sm font-medium placeholder:text-subtitle/40 outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand shadow-sm"
          />
          {mobileSearch && (
            <button onClick={() => setMobileSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-subtitle/40 hover:text-subtitle">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile filters row */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Date filter */}
          <div className="shrink-0">
            <DateFilterDropdown
              value={mobileDateFilter.preset === "Todo" ? "" : mobileDateFilter.preset}
              customStart={mobileDateFilter.start}
              customEnd={mobileDateFilter.end}
              onChange={(preset, start, end) => { setMobileDateFilter({ preset: preset || "Todo", start, end }); setMobilePage(1); }}
              options={[
                { value: "Hoy", label: t.date_filters.today },
                { value: "Semana", label: t.date_filters.week },
                { value: "Mes", label: t.date_filters.month },
                { value: "Año", label: t.date_filters.year },
              ]}
              placeholder={t.date_filters.date}
              compact
              iconOnlyCustom
              bottomSheet
            />
          </div>

          {/* Asset filter */}
          <button
            onClick={() => { setIsMobileAssetOpen(v => !v); setIsMobileWorkerOpen(false); }}
            className={`flex items-center gap-1.5 h-11 px-4 rounded-2xl border text-sm font-semibold shadow-sm transition-all shrink-0 ${
              mobileAssetFilter
                ? "border-brand/40 bg-brand/5 text-brand"
                : "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80"
            }`}
          >
            {mobileAssetFilter ? (
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <Ship className="w-3 h-3 text-brand" />
              </div>
            ) : (
              <>
                <span>{t.services.table.asset}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </>
            )}
          </button>

          {/* User filter */}
          <button
            onClick={() => { setIsMobileWorkerOpen(v => !v); setIsMobileAssetOpen(false); }}
            className={`flex items-center gap-1.5 h-11 px-4 rounded-2xl border text-sm font-semibold shadow-sm transition-all shrink-0 ${
              mobileWorkerFilter
                ? "border-brand/40 bg-brand/5 text-brand"
                : "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80"
            }`}
          >
            {mobileWorkerFilter ? (
              <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
                <span className="text-[9px] font-black text-white leading-none">
                  {getInitials(workerOptions.find(w => w.id === mobileWorkerFilter)?.name ?? "")}
                </span>
              </div>
            ) : (
              <>
                <span>{t.services.table.operator}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </>
            )}
          </button>

        </div>

        {/* Asset bottom sheet */}
        {isMobileAssetOpen && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[200] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => { setIsMobileAssetOpen(false); setMobileAssetSearch(""); }} />
            <div className="relative bg-white rounded-t-3xl pb-safe animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className="text-base font-black text-title">{t.services.table.asset}</span>
                <button onClick={() => { setIsMobileAssetOpen(false); setMobileAssetSearch(""); }} className="p-1.5 rounded-full hover:bg-app-bg text-subtitle/40">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtitle/40" />
                  <input
                    autoFocus
                    type="text"
                    value={mobileAssetSearch}
                    onChange={e => setMobileAssetSearch(e.target.value)}
                    placeholder={t.common.search}
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-app-bg rounded-2xl border border-border-theme/30 focus:outline-none focus:border-brand/40 font-medium text-title placeholder:text-subtitle/30"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto pb-6">
                {assetOptions
                  .filter(a => !mobileAssetSearch.trim() || a.name.toLowerCase().includes(mobileAssetSearch.toLowerCase()))
                  .map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => { setMobileAssetFilter(asset.id); setMobilePage(1); setIsMobileAssetOpen(false); setMobileAssetSearch(""); }}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${mobileAssetFilter === asset.id ? "bg-brand/5" : "hover:bg-app-bg"}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                        <Ship className="w-3.5 h-3.5 text-brand" />
                      </div>
                      <span className={`text-sm font-semibold truncate ${mobileAssetFilter === asset.id ? "text-brand" : "text-title"}`}>{asset.name}</span>
                    </button>
                  ))}
                {assetOptions.filter(a => !mobileAssetSearch.trim() || a.name.toLowerCase().includes(mobileAssetSearch.toLowerCase())).length === 0 && (
                  <p className="px-5 py-4 text-sm text-subtitle/50 text-center font-medium">{t.common.no_results}</p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Worker bottom sheet */}
        {isMobileWorkerOpen && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[200] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => { setIsMobileWorkerOpen(false); setMobileWorkerSearch(""); }} />
            <div className="relative bg-white rounded-t-3xl pb-safe animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className="text-base font-black text-title">{t.services.table.operator}</span>
                <button onClick={() => { setIsMobileWorkerOpen(false); setMobileWorkerSearch(""); }} className="p-1.5 rounded-full hover:bg-app-bg text-subtitle/40">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtitle/40" />
                  <input
                    autoFocus
                    type="text"
                    value={mobileWorkerSearch}
                    onChange={e => setMobileWorkerSearch(e.target.value)}
                    placeholder={t.common.search}
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-app-bg rounded-2xl border border-border-theme/30 focus:outline-none focus:border-brand/40 font-medium text-title placeholder:text-subtitle/30"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto pb-6">
                {workerOptions
                  .filter(w => !mobileWorkerSearch.trim() || w.name.toLowerCase().includes(mobileWorkerSearch.toLowerCase()))
                  .map(worker => (
                    <button
                      key={worker.id}
                      onClick={() => { setMobileWorkerFilter(worker.id); setMobilePage(1); setIsMobileWorkerOpen(false); setMobileWorkerSearch(""); }}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${mobileWorkerFilter === worker.id ? "bg-brand/5" : "hover:bg-app-bg"}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-black text-brand">{getInitials(worker.name)}</span>
                      </div>
                      <span className={`text-sm font-semibold ${mobileWorkerFilter === worker.id ? "text-brand" : "text-title"}`}>{worker.name}</span>
                    </button>
                  ))}
                {workerOptions.filter(w => !mobileWorkerSearch.trim() || w.name.toLowerCase().includes(mobileWorkerSearch.toLowerCase())).length === 0 && (
                  <p className="px-5 py-4 text-sm text-subtitle/50 text-center font-medium">{t.common.no_results}</p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Active filter chips */}
        {(mobileDateFilter.preset === "Personalizado" && mobileDateFilter.start && mobileDateFilter.end) || mobileWorkerFilter || mobileAssetFilter ? (
          <div className="flex flex-wrap gap-2">
            {mobileDateFilter.preset === "Personalizado" && mobileDateFilter.start && mobileDateFilter.end && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/5 border border-brand/20">
                <Calendar className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-xs font-semibold text-brand">
                  {new Date(mobileDateFilter.start + "T00:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" })}
                  {" – "}
                  {new Date(mobileDateFilter.end + "T00:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" })}
                </span>
                <button onClick={() => { setMobileDateFilter({ preset: "Todo" }); setMobilePage(1); }} className="text-brand/40 hover:text-brand transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {mobileWorkerFilter && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/5 border border-brand/20">
                <div className="w-4 h-4 rounded-full bg-brand flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-black text-white leading-none">
                    {getInitials(workerOptions.find(w => w.id === mobileWorkerFilter)?.name ?? "")}
                  </span>
                </div>
                <span className="text-xs font-semibold text-brand">
                  {workerOptions.find(w => w.id === mobileWorkerFilter)?.name ?? ""}
                </span>
                <button onClick={() => { setMobileWorkerFilter(""); setMobilePage(1); }} className="text-brand/40 hover:text-brand transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {mobileAssetFilter && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/5 border border-brand/20">
                <Ship className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-xs font-semibold text-brand">
                  {assetOptions.find(a => a.id === mobileAssetFilter)?.name ?? ""}
                </span>
                <button onClick={() => { setMobileAssetFilter(""); setMobilePage(1); }} className="text-brand/40 hover:text-brand transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Mobile card list */}
        {isMobileListLoading && mobileItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
            <p className="text-xs font-bold text-subtitle/40 uppercase tracking-wider animate-pulse">{t.services.states.loading}</p>
          </div>
        ) : mobileItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="p-5 bg-white border-2 border-brand/5 shadow-xl shadow-brand/5 rounded-4xl">
              <Inbox className="w-10 h-10 text-brand/20" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-title text-lg tracking-tight">{t.services.states.empty_title}</p>
              <p className="text-subtitle/60 text-sm font-medium">{t.services.states.empty_subtitle}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mobileItems.map((item: Service) => (
              <ServiceCard key={item.id} item={item} onClick={() => setSelectedService(item)} />
            ))}
          </div>
        )}

        {/* View more */}
        {mobileItems.length > 0 && mobilePage < mobileMeta.totalPages && (
          <button
            onClick={() => setMobilePage(p => p + 1)}
            disabled={isMobileListLoading}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-border-theme/30 bg-white text-sm font-bold text-subtitle/60 hover:text-brand hover:border-brand/30 hover:bg-brand/5 active:scale-[0.99] transition-all shadow-sm disabled:opacity-50"
          >
            {isMobileListLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {isMobileListLoading ? t.services.states.loading : t.common.view_more}
          </button>
        )}
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:flex flex-col space-y-8">
        <div className="hidden sm:grid sm:grid-cols-4 gap-4">
          <KPICard
            title={t.services.kpis.total}
            value={stats?.total_services ?? 0}
            icon={LayoutList}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
          />
          <KPICard
            title={t.services.kpis.period}
            value={stats?.period_services ?? 0}
            icon={CheckSquare}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
          />
          <KPICard
            title={t.services.kpis.assets}
            value={stats?.assets_serviced ?? 0}
            icon={Ship}
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
            roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
          />
          <KPICard
            title={t.services.kpis.operators}
            value={stats?.active_operators ?? 0}
            icon={User}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
          />
        </div>

        <FiltersBar
          searchPlaceholder={t.services.search_placeholder}
          onSearchChange={setSearch}
          showQuickFilters={false}
          hasExternalFilter={!!activeSortKey || !!desktopWorkerFilter || dateFilter.preset !== "Todo"}
          onClearAll={() => { setResetKey(k => k + 1); setActiveSortKey(null); setDesktopWorkerFilter(""); handleDateChange("Todo"); }}
          actions={
            <div className="flex items-center gap-3">
              <FilterDropdown
                value={desktopWorkerFilter}
                onChange={setDesktopWorkerFilter}
                options={workerOptions.map(w => ({ value: w.id, label: w.name }))}
                placeholder={t.services.table.operator}
              />
              <DateFilterDropdown
                value={dateFilter.preset === "Todo" ? "" : dateFilter.preset}
                customStart={dateFilter.start}
                customEnd={dateFilter.end}
                onChange={(preset, start, end) => handleDateChange(preset || "Todo", start, end)}
                options={[
                  { value: "Hoy", label: t.date_filters.today },
                  { value: "Mes", label: t.date_filters.month },
                  { value: "Año", label: t.date_filters.year },
                ]}
                placeholder={t.date_filters.date}
              />
              {canCreate && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 bg-brand hover:bg-brand/90 active:scale-95 text-white h-11 px-5 rounded-2xl font-black text-sm transition-all shadow-lg shadow-brand/25"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  {t.services.add_new}
                </button>
              )}
            </div>
          }
        />

        <div className="flex-1 min-h-100">
          {isDesktopListLoading ? (
            <div className="w-full flex flex-col items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
              <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.services.states.loading}</p>
            </div>
          ) : isError ? (
            <ModuleContainer roundedClass="rounded-2xl">
              <div className="w-full flex flex-col items-center justify-center py-20 space-y-4">
                <div className="p-4 bg-error/10 rounded-full">
                  <AlertCircle className="w-8 h-8 text-error" />
                </div>
                <div className="text-center">
                  <p className="font-black text-title text-xl">{t.services.states.error_title}</p>
                  <p className="text-subtitle font-medium">{t.services.states.error_subtitle}</p>
                </div>
                <button
                  onClick={() => refetchActiveServices()}
                  className="px-6 py-2 bg-app-bg border border-border-theme/40 rounded-xl text-subtitle font-bold text-sm hover:bg-border-theme/5"
                >
                  {t.common.retry}
                </button>
              </div>
            </ModuleContainer>
          ) : servicesList.length === 0 ? (
            <ModuleContainer roundedClass="rounded-2xl">
              <div className="w-full flex flex-col items-center justify-center py-24 space-y-6 text-center">
                <div className="p-6 bg-app-bg/50 rounded-full">
                  <Inbox className="w-12 h-12 text-subtitle/20" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-title tracking-tight">{t.services.states.empty_title}</h3>
                  <p className="text-subtitle font-medium max-w-xs mx-auto text-sm leading-relaxed">
                    {t.services.states.empty_subtitle}
                  </p>
                </div>
              </div>
            </ModuleContainer>
          ) : (
            <ModuleContainer roundedClass="rounded-2xl">
              <DataTable
                data={servicesList}
                columns={columns}
                keyExtractor={(item) => item.id}
                footer={pagination}
                onRowClick={(item: any) => setSelectedService(item)}
                onSortChange={setActiveSortKey}
                resetSortTrigger={resetKey}
              />
            </ModuleContainer>
          )}
        </div>
      </div>

      <ServiceDrawer
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />

      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetchActiveServices}
      />

      <ConfirmModal
        isOpen={!!serviceToDelete}
        onClose={() => setServiceToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t.confirm_modal.delete_service_title}
        description={t.confirm_modal.delete_description}
        confirmText={t.confirm_modal.confirm_delete}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
      />
    </div>
  );
}
