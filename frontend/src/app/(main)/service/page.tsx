"use client";

import React, { useState, useMemo } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import MobileDevBanner from "@/components/ui/MobileDevBanner";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import { Trash2, Wrench, User, Calendar, ChevronLeft, ChevronRight, Loader2, AlertCircle, Inbox, Ship, Plus, CheckSquare, LayoutList } from "lucide-react";
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
import { formatDate } from "@/lib/formatDate";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";

export default function ServicesPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canCreate = user?.role === "ADMIN" || user?.role === "WORKER";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [dateFilter, setDateFilter] = useState<{preset: string, start?: string, end?: string}>({ preset: "Todo" });
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [resetKey, setResetKey] = useState(0);
  const [activeSortKey, setActiveSortKey] = useState<string | null>(null);
  const [desktopWorkerFilter, setDesktopWorkerFilter] = useState("");

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

  const queryParams = {
    ...getQueryParams(),
    ...(desktopWorkerFilter ? { worker_id: desktopWorkerFilter } : {}),
  };

  const { data: responseData, isLoading, isError, refetch } = useQuery({
    queryKey: ["services", queryParams],
    queryFn: () => servicesService.findAll(queryParams),
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

  const { data: allServicesData } = useQuery({
    queryKey: ["services-workers-list"],
    queryFn: () => servicesService.findAll(),
    staleTime: 120000,
    ...AUTO_REFETCH_OPTIONS,
  });

  const workerOptions = useMemo(() => {
    const all: Service[] = Array.isArray(allServicesData) ? allServicesData : (allServicesData as any)?.data ?? [];
    const map = new Map<string, { id: string; name: string }>();
    all.forEach((s: Service) => {
      if (s.worker?.id) map.set(s.worker.id, { id: s.worker.id, name: s.worker.name ?? "" });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allServicesData]);

  const servicesList = Array.isArray(responseData) ? responseData : responseData?.data || [];
  const meta = !Array.isArray(responseData) && responseData?.meta ? responseData.meta : { total: servicesList.length, page: 1, limit: 10, totalPages: 1 };

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFilter, limit, desktopWorkerFilter]);

  const handleDateChange = (preset: string, start?: string, end?: string) => {
    setDateFilter({ preset, start, end });
  };

  const handleConfirmDelete = async () => {
    if (serviceToDelete) {
      try {
        await servicesService.delete(serviceToDelete.id);
        showToast("Servicio eliminado con éxito.", "success");
        setServiceToDelete(null);
        refetch();
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
              {item.worker?.name ? item.worker.name.split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("") : "?"}
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
          <span className="min-w-[40px] h-7 flex items-center justify-center text-xs font-bold text-title bg-app-bg rounded-lg border border-border-theme/40 px-2">
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
          <Calendar className="w-3.5 h-3.5 mr-1.5" />
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
          options={[5, 10, 20, 50].map(n => ({ value: String(n), label: `${n} / pág` }))}
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
      <MobileDevBanner />
      <div className="hidden lg:flex flex-col space-y-8">

      {/* KPI Cards */}
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

      <div className="flex-1 min-h-[400px]">
        {isLoading ? (
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
                onClick={() => refetch()}
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

      <ServiceDrawer
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />

      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetch}
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
    </div>
  );
}
