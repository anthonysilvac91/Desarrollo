"use client";

import React, { useState } from "react";
import { Plus, Building2, ToggleLeft, ToggleRight, Trash2, Pencil, Loader2, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import FiltersBar from "@/components/ui/FiltersBar";
import FilterDropdown from "@/components/ui/FilterDropdown";
import ModuleContainer from "@/components/ui/ModuleContainer";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { ownersService, Owner } from "@/services/owners.service";
import OwnerModal from "@/components/owners/OwnerModal";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function OwnersPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null);
  const [ownerToDeactivate, setOwnerToDeactivate] = useState<Owner | null>(null);

  const getQueryParams = () => {
    const params: { page: number; limit: number; search?: string; is_active?: string } = { page, limit };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.is_active = statusFilter;
    return params;
  };

  const { data: responseData, isLoading } = useQuery({
    queryKey: ["owners", getQueryParams()],
    queryFn: () => ownersService.findAll(getQueryParams()),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => ownersService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      showToast(t.owners.states.deactivate_success, "success");
      setOwnerToDeactivate(null);
    },
    onError: () => {
      showToast(t.owners.states.error_deactivate, "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ownersService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      showToast(t.owners.states.delete_success, "success");
      setOwnerToDelete(null);
    },
    onError: () => {
      showToast(t.owners.states.error_delete, "error");
    }
  });

  const ownersList: Owner[] = Array.isArray(responseData) ? responseData : responseData?.data || [];
  const meta = !Array.isArray(responseData) && responseData?.meta
    ? responseData.meta
    : { total: ownersList.length, page: 1, limit: 10, totalPages: 1 };

  const columns: ColumnDef<Owner>[] = [
    {
      header: t.owners.table.name.toUpperCase(),
      key: "name",
      cell: (item: Owner) => (
        <div className="flex items-center space-x-3">
          <div
            className={`rounded-full overflow-hidden border-2 border-surface shadow-sm bg-brand/10 flex items-center justify-center shrink-0 ${!item.is_active ? "grayscale opacity-40" : ""}`}
            style={{ width: 52, height: 52 }}
          >
            {item.logo_url ? (
              <img src={item.logo_url} alt={item.name} className="w-full h-full object-contain p-2" loading="lazy" />
            ) : (
              <Building2 className="w-5 h-5 text-brand" />
            )}
          </div>
          <span className={`font-bold text-xs text-title ${!item.is_active ? "opacity-40" : ""}`}>{item.name}</span>
        </div>
      )
    },
    {
      header: t.owners.table.assets.toUpperCase(),
      key: "assets_count",
      align: "center",
      cell: (item: Owner) => (
        <div className="flex items-center justify-center">
          <span className="min-w-[40px] h-7 flex items-center justify-center text-xs font-bold text-title bg-app-bg rounded-lg border border-border-theme/40 px-2">
            {item.assets_count ?? 0}
          </span>
        </div>
      )
    },
    {
      header: t.owners.table.services.toUpperCase(),
      key: "services_count",
      align: "center",
      cell: (item: Owner) => (
        <div className="flex items-center justify-center">
          <span className="min-w-[40px] h-7 flex items-center justify-center text-xs font-bold text-title bg-app-bg rounded-lg border border-border-theme/40 px-2">
            {item.services_count ?? 0}
          </span>
        </div>
      )
    },
    {
      header: t.owners.table.status.toUpperCase(),
      key: "is_active",
      align: "center",
      cell: (item: Owner) => item.is_active
        ? <span className="inline-flex justify-center w-20 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-green-100 text-green-700 border-green-200">{t.common.active}</span>
        : <span className="inline-flex justify-center w-20 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-red-100 text-red-700 border-red-200">{t.common.inactive}</span>
    },
    {
      header: t.owners.table.actions.toUpperCase(),
      key: "actions",
      align: "center",
      cell: (item: Owner) => (
        <div className="flex items-center justify-center space-x-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setOwnerToDeactivate(item); }}
            className={`p-1.5 transition-all rounded-full ${item.is_active ? "text-emerald-500 hover:bg-emerald-50" : "text-subtitle/20 hover:text-subtitle/40 hover:bg-gray-50"}`}
            title={t.owners.actions.deactivate}
          >
            {item.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditingOwner(item); setIsModalOpen(true); }}
            className="p-1.5 text-subtitle/40 hover:text-brand transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOwnerToDelete(item); }}
            className="p-1.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
            title={t.owners.actions.delete}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const emptyState = (
    <div className="w-full flex flex-col items-center justify-center py-20 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full" />
        <div className="relative p-6 bg-white border-2 border-brand/5 shadow-2xl shadow-brand/5 rounded-[40px]">
          <Inbox className="w-12 h-12 text-brand/20" />
        </div>
      </div>
      <div className="text-center space-y-2 max-w-xs">
        <p className="font-black text-title text-2xl tracking-tight">{t.owners.states.empty_title}</p>
        <p className="text-subtitle font-medium leading-relaxed">{t.owners.states.empty_subtitle}</p>
      </div>
      <button
        onClick={() => { setEditingOwner(null); setIsModalOpen(true); }}
        className="flex items-center space-x-3 bg-brand text-white px-8 py-4 rounded-full text-base font-black transition-all shadow-xl shadow-brand/20 hover:scale-105 active:scale-95"
      >
        <Plus className="w-5 h-5 stroke-[3px]" />
        <span>{t.owners.add_new}</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col space-y-4 lg:space-y-8">
      <FiltersBar
        searchPlaceholder={t.owners.search_placeholder}
        onSearchChange={(value) => { setSearchTerm(value); setPage(1); }}
        hasExternalFilter={!!statusFilter}
        onClearAll={() => setStatusFilter("")}
        showQuickFilters={false}
        actions={
          <div className="hidden lg:flex items-center gap-3">
            <FilterDropdown
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[
                { value: "true",  label: t.common.active },
                { value: "false", label: t.common.inactive },
              ]}
              placeholder={t.assets.filters.all_statuses}
            />
            <button
              onClick={() => { setEditingOwner(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 bg-brand hover:bg-brand/90 active:scale-95 text-white h-11 px-5 rounded-2xl font-black text-sm transition-all shadow-lg shadow-brand/25"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              {t.owners.add_new}
            </button>
          </div>
        }
      />

      <ModuleContainer>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
            <p className="text-subtitle font-medium animate-pulse">{t.owners.states.loading}</p>
          </div>
        ) : ownersList.length === 0 ? (
          emptyState
        ) : (
          <DataTable
            columns={columns}
            data={ownersList}
            footer={
              <>
                <div className="flex items-center space-x-3">
                  <div className="text-xs text-subtitle/40 font-medium tracking-tight">
                    {t.owners.pagination.showing}{" "}
                    <span className="text-subtitle/70 font-bold">{ownersList.length}</span>{" "}
                    {t.owners.pagination.of}{" "}
                    <span className="text-subtitle/70 font-bold">{meta.total}</span>{" "}
                    {t.owners.pagination.owners}
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
                  <button className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-md shadow-brand/20">
                    {page}
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                    disabled={page >= meta.totalPages}
                    className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            }
          />
        )}
      </ModuleContainer>

      <OwnerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ownerToEdit={editingOwner}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["owners"] })}
      />

      <ConfirmModal
        isOpen={!!ownerToDeactivate}
        onClose={() => setOwnerToDeactivate(null)}
        onConfirm={() => ownerToDeactivate && deactivateMutation.mutate(ownerToDeactivate.id)}
        title={t.owners.deactivate_modal.title}
        description={t.owners.deactivate_modal.description}
        confirmText={t.owners.deactivate_modal.confirm}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!ownerToDelete}
        onClose={() => setOwnerToDelete(null)}
        onConfirm={() => ownerToDelete && deleteMutation.mutate(ownerToDelete.id)}
        title={t.owners.delete_modal.title}
        description={t.owners.delete_modal.description}
        confirmText={t.owners.delete_modal.confirm}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
      />
    </div>
  );
}
