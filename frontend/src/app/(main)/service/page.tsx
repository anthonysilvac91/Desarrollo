"use client";

import React, { useState, useMemo } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import { Trash2, Wrench, User, Calendar, ChevronLeft, ChevronRight, Loader2, AlertCircle, Inbox, Ship } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import ServiceDrawer from "@/components/services/ServiceDrawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useQuery } from "@tanstack/react-query";
import { servicesService, Service } from "@/services/services.service";
import { useToast } from "@/lib/ToastContext";

export default function ServicesPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<{preset: string, start?: string, end?: string}>({ preset: "Todo" });
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  const { data: services = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: () => servicesService.findAll(),
  });

  // Filter logic
  const filteredData = useMemo(() => {
    return services.filter((item) => {
      // 1. Text Search
      const searchLower = search.toLowerCase();
      const matchesSearch = search === "" || (
        item.title.toLowerCase().includes(searchLower) ||
        (item.asset?.name || "").toLowerCase().includes(searchLower) ||
        (item.worker?.name || "").toLowerCase().includes(searchLower)
      );

      if (!matchesSearch) return false;

      // 2. Date Filtering
      const itemDate = new Date(item.created_at);
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const itemDateNoTime = new Date(itemDate);
      itemDateNoTime.setHours(0, 0, 0, 0);

      if (dateFilter.preset === "Hoy") {
        return itemDateNoTime.getTime() === now.getTime();
      }
      
      if (dateFilter.preset === "Mes") {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      
      if (dateFilter.preset === "Año") {
        return itemDate.getFullYear() === now.getFullYear();
      }
      
      if (dateFilter.preset === "Personalizado" && dateFilter.start && dateFilter.end) {
        const start = new Date(dateFilter.start);
        const end = new Date(dateFilter.end);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return itemDate >= start && itemDate <= end;
      }

      return true;
    });
  }, [search, dateFilter, services]);

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

  const displayData = filteredData.slice(0, 10);

  const columns: ColumnDef<Service>[] = [
    { 
      key: "service", 
      header: t.services.table.service,
      cell: (item) => (
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand flex-shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-title text-[17px] leading-tight">{item.title}</span>
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider mt-0.5">COMPLETED</span>
          </div>
        </div>
      )
    },
    { 
      key: "asset", 
      header: t.services.table.asset,
      cell: (item) => (
        <div className="flex items-center text-subtitle/80 font-semibold group cursor-pointer hover:text-brand transition-colors">
          <Ship className="w-4 h-4 mr-2 opacity-40" />
          <span className="text-[15px]">{item.asset?.name || "---"}</span>
        </div>
      )
    },
    { 
      key: "worker", 
      header: t.services.table.operator,
      cell: (item) => (
        <div className="flex items-center text-subtitle/80">
          <div className="w-6 h-6 rounded-full bg-app-bg border border-border-theme/40 flex items-center justify-center mr-2 overflow-hidden">
            <User className="w-3.5 h-3.5 opacity-40" />
          </div>
          <span className="font-semibold text-[14px]">{item.worker?.name || "---"}</span>
        </div>
      )
    },
    { 
      key: "date", 
      header: t.services.table.date,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center text-subtitle/70">
          <Calendar className="w-4 h-4 mr-2" />
          <span className="font-semibold text-[15px]">{new Date(item.created_at).toLocaleDateString()}</span>
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
            className="p-2.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
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
      <div className="text-[15px] text-subtitle font-medium">
        {t.services.pagination.showing} <span className="text-title font-bold">{displayData.length}</span> {t.services.pagination.of} <span className="text-title font-bold">{filteredData.length}</span> {t.services.pagination.services}
      </div>
      <div className="flex items-center space-x-2">
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20" disabled>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-lg shadow-brand/20">1</button>
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col space-y-8">
      <FiltersBar 
        searchPlaceholder={t.services.search_placeholder}
        onSearchChange={setSearch}
        onDateChange={handleDateChange}
        showQuickFilters={true}
      />

      <div className="flex-1 min-h-[400px]">
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.services.states.loading}</p>
          </div>
        ) : isError ? (
          <ModuleContainer>
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
        ) : filteredData.length === 0 ? (
          <ModuleContainer>
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
          <ModuleContainer>
            <DataTable 
              data={filteredData} 
              columns={columns} 
              keyExtractor={(item) => item.id}
              footer={pagination}
              onRowClick={(item: any) => setSelectedService(item)}
            />
          </ModuleContainer>
        )}
      </div>

      <ServiceDrawer 
        service={selectedService} 
        onClose={() => setSelectedService(null)} 
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
