"use client";

import React, { useState } from "react";
import { Plus, Building2, ToggleLeft, ToggleRight, Trash2, Pencil, Loader2, ChevronLeft, ChevronRight, Inbox, AlertCircle, Wrench, Ship } from "lucide-react";
import FiltersBar from "@/components/ui/FiltersBar";
import FilterDropdown from "@/components/ui/FilterDropdown";
import ModuleContainer from "@/components/ui/ModuleContainer";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { assetsService, Asset } from "@/services/assets.service";
import { ownersService, Owner, OwnerAsset } from "@/services/owners.service";
import OwnerModal from "@/components/owners/OwnerModal";
import OwnerDrawer from "@/components/owners/OwnerDrawer";
import AssetModal from "@/components/assets/AssetModal";
import AssetDrawer from "@/components/assets/AssetDrawer";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface OwnerCardProps {
  item: Owner;
  t: ReturnType<typeof useLanguage>["t"];
  onClick: () => void;
}

const OwnerLogo = ({ item, className = "w-16 h-16" }: { item: Owner; className?: string }) => (
  <div
    className={`${className} rounded-full overflow-hidden border-2 border-app-bg shadow-sm shrink-0 bg-brand/10 flex items-center justify-center ${!item.is_active ? "grayscale opacity-40" : ""}`}
  >
    {item.logo_url ? (
      <img src={item.logo_url} alt={item.name} className="w-full h-full object-contain p-2" loading="lazy" />
    ) : (
      <Building2 className="w-6 h-6 text-brand" />
    )}
  </div>
);

const OwnerCard = ({ item, t, onClick }: OwnerCardProps) => (
  <div
    onClick={onClick}
    className="bg-surface rounded-2xl border border-border-theme/40 shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
  >
    <div className="flex items-center gap-4 p-4">
      <OwnerLogo item={item} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-bold text-title text-sm truncate flex-1 ${!item.is_active ? "opacity-40" : ""}`}>
            {item.name}
          </span>
          {item.is_active
            ? <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-700 border border-green-200">{t.common.active}</span>
            : <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">{t.common.inactive}</span>
          }
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-theme/40 bg-app-bg px-2.5 py-1 text-[10px] font-black text-subtitle/70">
            <Ship className="w-3 h-3 text-brand" />
            {item.assets_count ?? 0} {t.owners.table.assets}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-theme/40 bg-app-bg px-2.5 py-1 text-[10px] font-black text-subtitle/70">
            <Wrench className="w-3 h-3 text-brand" />
            {item.services_count ?? 0} {t.owners.table.services}
          </span>
        </div>
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center text-brand">
        <ChevronRight className="w-5 h-5 shrink-0" />
      </div>
    </div>
  </div>
);

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
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null);
  const [ownerToDeactivate, setOwnerToDeactivate] = useState<Owner | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const getQueryParams = () => {
    const params: { page: number; limit: number; search?: string; is_active?: string } = { page, limit };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.is_active = statusFilter;
    return params;
  };

  const { data: responseData, isLoading, isError, refetch } = useQuery({
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

  const deleteAssetMutation = useMutation({
    mutationFn: (id: string) => assetsService.delete(id),
    onSuccess: async () => {
      showToast(t.feedback.delete_asset_success, "success");
      if (assetToDelete?.id === selectedAsset?.id) {
        setSelectedAsset(null);
      }
      setAssetToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      await queryClient.invalidateQueries({ queryKey: ["assets-mobile"] });
      await queryClient.invalidateQueries({ queryKey: ["owners"] });
      if (selectedOwner?.id) {
        await queryClient.invalidateQueries({ queryKey: ["owner", selectedOwner.id] });
      }
    },
    onError: () => {
      showToast(t.feedback.delete_asset_error, "error");
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

  const handleOwnerAssetClick = (asset: OwnerAsset, owner: Owner) => {
    setSelectedAsset({
      id: asset.id,
      name: asset.name,
      category: asset.category ?? undefined,
      location: asset.location ?? undefined,
      thumbnail_url: asset.thumbnail_url ?? undefined,
      is_active: asset.is_active ?? true,
      owner_id: owner.id,
      owner: { id: owner.id, name: owner.name },
    });
  };

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

  const pagination = (
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
  );

  return (
    <div className="flex flex-col space-y-4 lg:space-y-8">
      <div className="lg:hidden flex flex-col gap-4 pb-8">
        <h1 className="text-2xl font-black text-title tracking-tight text-center">{t.sidebar.owners}</h1>
        <FiltersBar
          searchPlaceholder={t.owners.search_placeholder}
          onSearchChange={(value) => { setSearchTerm(value); setPage(1); }}
          hasExternalFilter={!!statusFilter}
          onClearAll={() => setStatusFilter("")}
          showQuickFilters={false}
          showClearAll={false}
        />

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: "", label: t.common.all },
            { value: "true", label: t.common.active },
            { value: "false", label: t.common.inactive },
          ].map((option) => (
            <button
              key={option.value || "all"}
              onClick={() => { setStatusFilter(option.value); setPage(1); }}
              className={`h-11 px-4 rounded-2xl border text-sm font-semibold shadow-sm transition-all shrink-0 ${
                statusFilter === option.value
                  ? "bg-brand/10 border-brand/20 text-brand shadow-sm"
                  : "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.owners.states.loading}</p>
          </div>
        ) : isError ? (
          <div className="w-full flex flex-col items-center justify-center py-20 space-y-4">
            <div className="p-4 bg-error/10 rounded-full">
              <AlertCircle className="w-8 h-8 text-error" />
            </div>
            <div className="text-center">
              <p className="font-black text-title text-xl tracking-tight">{t.owners.states.error_title}</p>
              <p className="text-subtitle font-medium text-sm">{t.owners.states.error_subtitle}</p>
            </div>
            <button onClick={() => refetch()} className="px-6 py-2 bg-app-bg border border-border-theme/40 rounded-xl text-subtitle font-bold text-sm hover:bg-border-theme/10 transition-all">
              {t.common.retry}
            </button>
          </div>
        ) : ownersList.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 space-y-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/8 text-brand/40 ring-8 ring-brand/5">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black tracking-tight text-title">{t.owners.states.empty_title}</h3>
              <p className="text-sm font-medium leading-relaxed text-subtitle/60 max-w-xs mx-auto">{t.owners.states.empty_subtitle}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ownersList.map((item) => (
              <OwnerCard
                key={item.id}
                item={item}
                t={t}
                onClick={() => setSelectedOwner(item)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hidden lg:flex flex-col space-y-8">
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
              footer={pagination}
              onRowClick={(item) => setSelectedOwner(item)}
            />
          )}
        </ModuleContainer>
      </div>

      <OwnerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ownerToEdit={editingOwner}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["owners"] })}
      />

      <OwnerDrawer
        owner={selectedOwner}
        onClose={() => setSelectedOwner(null)}
        onAssetClick={handleOwnerAssetClick}
        onEdit={(owner) => {
          setSelectedOwner(null);
          setEditingOwner(owner);
          setIsModalOpen(true);
        }}
        onDelete={(owner) => {
          setSelectedOwner(null);
          setOwnerToDelete(owner);
        }}
        onToggleStatus={(owner) => {
          setSelectedOwner(null);
          setOwnerToDeactivate(owner);
        }}
      />

      <AssetDrawer
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onEdit={(asset) => {
          setAssetToEdit(asset);
          setIsAssetModalOpen(true);
        }}
        onDelete={(asset) => setAssetToDelete(asset)}
      />

      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => { setIsAssetModalOpen(false); setAssetToEdit(null); }}
        asset={assetToEdit}
        onSuccess={async () => {
          setIsAssetModalOpen(false);
          setAssetToEdit(null);
          await queryClient.invalidateQueries({ queryKey: ["assets"] });
          await queryClient.invalidateQueries({ queryKey: ["assets-mobile"] });
          await queryClient.invalidateQueries({ queryKey: ["owners"] });
          if (selectedOwner?.id) {
            await queryClient.invalidateQueries({ queryKey: ["owner", selectedOwner.id] });
          }
          if (selectedAsset?.id) {
            await queryClient.invalidateQueries({ queryKey: ["asset", selectedAsset.id] });
          }
        }}
      />

      <ConfirmModal
        isOpen={!!assetToDelete}
        onClose={() => setAssetToDelete(null)}
        onConfirm={() => assetToDelete && deleteAssetMutation.mutate(assetToDelete.id)}
        title={t.confirm_modal.delete_asset_title}
        description={t.confirm_modal.delete_description}
        confirmText={t.confirm_modal.confirm_delete}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
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

      <button
        onClick={() => { setEditingOwner(null); setIsModalOpen(true); }}
        className="fixed bottom-24 right-6 lg:hidden z-20 w-14 h-14 bg-brand text-white rounded-full shadow-xl shadow-brand/30 flex items-center justify-center active:scale-95 transition-all"
        aria-label={t.owners.add_new}
      >
        <Plus className="w-6 h-6 stroke-[3px]" />
      </button>
    </div>
  );
}
