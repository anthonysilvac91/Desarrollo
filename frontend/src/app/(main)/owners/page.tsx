"use client";

import React, { useState } from "react";
import { Plus, Building2, ToggleRight, Trash2, Pencil, Loader2, ChevronLeft, ChevronRight, Package, ClipboardList } from "lucide-react";
import FiltersBar from "@/components/ui/FiltersBar";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { ownersService, Owner } from "@/services/owners.service";
import OwnerModal from "@/components/owners/OwnerModal";
import DataTable from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function OwnersPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null);
  const [ownerToDeactivate, setOwnerToDeactivate] = useState<Owner | null>(null);

  const getQueryParams = () => {
    const params: { page: number; limit: number; search?: string } = { page, limit };
    if (debouncedSearch) params.search = debouncedSearch;
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

  const columns = [
    {
      header: t.owners.table.name.toUpperCase(),
      key: "name",
      cell: (item: Owner) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {item.logo_url ? (
              <img src={item.logo_url} alt={item.name} className="w-full h-full object-contain p-2" />
            ) : (
              <Building2 className="w-5 h-5 text-brand" />
            )}
          </div>
          <span className="font-bold text-sm text-title">{item.name}</span>
        </div>
      )
    },
    {
      header: t.owners.table.assets.toUpperCase(),
      key: "assets_count",
      cell: (item: Owner) => (
        <div className="flex items-center space-x-2 text-title">
          <Package className="w-4 h-4 text-brand/60" />
          <span className="font-black text-sm">{item.assets_count ?? 0}</span>
        </div>
      )
    },
    {
      header: t.owners.table.services.toUpperCase(),
      key: "services_count",
      cell: (item: Owner) => (
        <div className="flex items-center space-x-2 text-title">
          <ClipboardList className="w-4 h-4 text-brand/60" />
          <span className="font-black text-sm">{item.services_count ?? 0}</span>
        </div>
      )
    },
    {
      header: t.owners.table.status.toUpperCase(),
      key: "is_active",
      cell: (item: Owner) => (
        <div className="flex items-center space-x-2">
          {item.is_active ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="text-[13px] font-bold text-emerald-600/80 uppercase tracking-widest">{t.common.active}</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
              <span className="text-[13px] font-bold text-red-600/80 uppercase tracking-widest">{t.common.inactive}</span>
            </>
          )}
        </div>
      )
    },
    {
      header: t.owners.table.actions.toUpperCase(),
      key: "actions",
      align: "center",
      cell: (item: Owner) => (
        <div className="flex items-center justify-center space-x-3">
          <button
            onClick={(e) => { e.stopPropagation(); setOwnerToDeactivate(item); }}
            className="p-2.5 transition-all rounded-full text-emerald-500 hover:bg-emerald-50"
            title={t.owners.actions.deactivate}
          >
            <ToggleRight className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditingOwner(item); setIsModalOpen(true); }}
            className="p-2.5 text-subtitle/40 hover:text-brand transition-colors"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOwnerToDelete(item); }}
            className="p-2.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
            title={t.owners.actions.delete}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col space-y-8">
      <FiltersBar
        searchPlaceholder={t.owners.search_placeholder}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setPage(1);
        }}
        showQuickFilters={false}
        actions={
          <button
            onClick={() => {
              setEditingOwner(null);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25"
          >
            <Plus className="w-5 h-5 stroke-[4px]" />
            <span>{t.owners.add_new}</span>
          </button>
        }
      />

      <div className="bg-white rounded-[32px] border border-border-theme/40 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand mb-4" />
            <p className="text-subtitle font-medium animate-pulse">{t.owners.states.loading}</p>
          </div>
        ) : ownersList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-10 h-10 text-subtitle/30" />
            </div>
            <h3 className="text-lg font-black text-title mb-1">{t.owners.states.empty_title}</h3>
            <p className="text-subtitle font-medium max-w-sm">{t.owners.states.empty_subtitle}</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={ownersList}
            footer={
              <>
                <div className="flex items-center space-x-3">
                  <div className="text-[15px] text-subtitle font-medium tracking-tight">
                    {t.owners.pagination.showing} <span className="text-title font-bold">{ownersList.length}</span> {t.owners.pagination.of} <span className="text-title font-bold">{meta.total}</span> {t.owners.pagination.owners}
                  </div>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="text-xs font-bold text-subtitle border border-border-theme/40 rounded-lg px-2 py-1 bg-app-bg focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n} / pág</option>)}
                  </select>
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
      </div>

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
