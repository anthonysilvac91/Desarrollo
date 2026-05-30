"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import AssetModal from "@/components/assets/AssetModal";
import AssetDrawer from "@/components/assets/AssetDrawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Plus, MapPin, ChevronLeft, ChevronRight, Pencil, Trash2, Calendar, ToggleLeft, ToggleRight, Wrench, ChevronDown, X, Search } from "lucide-react";
import { formatDate } from "@/lib/formatDate";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { assetsService, Asset } from "@/services/assets.service";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/lib/ToastContext";
import { useDebounce } from "@/hooks/useDebounce";
import AssetIcon from "@/components/ui/AssetIcon";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { AUTO_REFETCH_INTERVALS, AUTO_REFETCH_OPTIONS } from "@/lib/queryAutoRefetch";

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

const AssetImage = ({ src, alt, iconId }: { src: string; alt: string | undefined; iconId?: string | null }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return <AssetIcon iconId={iconId} className="w-9 h-9 text-brand" strokeWidth={1.5} />;
  }
  return <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setError(true)} />;
};

interface AssetCardProps {
  item: Asset;
  canManage: boolean;
  iconId?: string | null;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggle: () => void;
  onClick: () => void;
}

const AssetCard = ({ item, canManage, iconId, onEdit, onDelete, onToggle, onClick }: AssetCardProps) => (
  <div
    onClick={onClick}
    className="bg-surface rounded-2xl border border-border-theme/40 shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
  >
    <div className="flex items-center gap-4 p-4">
      {/* Thumbnail */}
      <div className={`w-16 h-16 rounded-full overflow-hidden border-2 border-app-bg shadow-sm shrink-0 bg-app-bg flex items-center justify-center ${!item.is_active ? "grayscale opacity-40" : ""}`}>
        <AssetImage src={item.thumbnail_url || ""} alt={item.name} iconId={iconId} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Name + badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-bold text-title text-sm truncate flex-1 ${!item.is_active ? "opacity-40" : ""}`}>
            {item.name}
          </span>
          {item.is_active
            ? <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-700 border border-green-200">activo</span>
            : <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">inactivo</span>
          }
        </div>
        {/* Owner */}
        <p className="text-xs font-bold text-brand truncate mb-0.5">{item.owner?.name || "---"}</p>
        {/* Location */}
        {item.location && (
          <div className="flex items-center mt-1">
            <MapPin className="w-3 h-3 mr-1 text-subtitle/40 shrink-0" />
            <span className="text-xs text-subtitle/60 truncate">{item.location}</span>
          </div>
        )}
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center text-brand">
        <ChevronRight className="w-5 h-5 shrink-0" />
      </div>
    </div>

  </div>
);

export default function AssetsPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [resetKey, setResetKey] = useState(0);
  const [activeSortKey, setActiveSortKey] = useState<string | null>(null);
  const [mobileOwnerFilter, setMobileOwnerFilter] = useState<string | null>(null);
  const [mobileStatusFilter, setMobileStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const ownerDropdownRef = useRef<HTMLDivElement>(null);

  const queryParams = { page, limit, search: debouncedSearch };

  const { data: responseData, isLoading, isError, refetch } = useQuery({
    queryKey: ["assets", queryParams],
    queryFn: () => assetsService.findAll(queryParams),
    refetchInterval: AUTO_REFETCH_INTERVALS.fast,
    ...AUTO_REFETCH_OPTIONS,
  });

  const rawAssets = Array.isArray(responseData) ? responseData : responseData?.data || [];
  const meta = !Array.isArray(responseData) && responseData?.meta
    ? responseData.meta
    : { total: rawAssets.length, page: 1, limit: 10, totalPages: 1 };

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const filteredData = useMemo(() => {
    return rawAssets.filter((item: any) => {
      const ownerName = item.owner?.name;
      const matchesOwner = selectedOwners.length === 0 || (ownerName && selectedOwners.includes(ownerName));
      const matchesCategory = selectedCategories.length === 0 || (item.category && selectedCategories.includes(item.category));
      return matchesOwner && matchesCategory;
    });
  }, [selectedOwners, selectedCategories, rawAssets]);

  // Mobile: infinite scroll query (independiente del desktop)
  const {
    data: mobileData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMobile,
  } = useInfiniteQuery({
    queryKey: ["assets-mobile", { search: debouncedSearch }],
    queryFn: ({ pageParam }) =>
      assetsService.findAll({ page: pageParam as number, limit: 10, search: debouncedSearch }),
    initialPageParam: 1,
    refetchInterval: AUTO_REFETCH_INTERVALS.fast,
    ...AUTO_REFETCH_OPTIONS,
    getNextPageParam: (lastPage) => {
      if (Array.isArray(lastPage)) return undefined;
      const m = lastPage?.meta;
      if (m && m.page < m.totalPages) return m.page + 1;
      return undefined;
    },
  });

  const uniqueOwners = useMemo(() => {
    const pages = mobileData?.pages ?? [];
    const all: Asset[] = pages.flatMap((p: any) => (Array.isArray(p) ? p : p.data ?? []));
    const map = new Map<string, { id: string; name: string }>();
    all.forEach(item => {
      if (item.owner?.id && !map.has(item.owner.id)) {
        map.set(item.owner.id, { id: item.owner.id, name: item.owner.name });
      }
    });
    return Array.from(map.values());
  }, [mobileData]);

  const mobileAssets = useMemo(() => {
    const pages = mobileData?.pages ?? [];
    const all: Asset[] = pages.flatMap((p: any) => (Array.isArray(p) ? p : p.data ?? []));
    return all.filter((item) => {
      const matchesOwner = !mobileOwnerFilter || item.owner?.id === mobileOwnerFilter;
      const matchesStatus = mobileStatusFilter === "all" || (mobileStatusFilter === "active" ? item.is_active : !item.is_active);
      const matchesCategory = selectedCategories.length === 0 || (item.category && selectedCategories.includes(item.category));
      return matchesOwner && matchesStatus && matchesCategory;
    });
  }, [mobileData, mobileOwnerFilter, mobileStatusFilter, selectedCategories]);

  useEffect(() => {
    if (!isOwnerDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
        setIsOwnerDropdownOpen(false);
        setOwnerSearch("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOwnerDropdownOpen]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const canManage = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const iconId = user?.organization?.default_asset_icon;

  const handleToggleStatus = async (asset: Asset) => {
    try {
      await assetsService.toggleStatus(asset.id, !asset.is_active);
      showToast(asset.is_active ? "Activo desactivado" : "Activo activado", "success");
      refetch(); refetchMobile();
    } catch {
      showToast(t.feedback.generic_error, "error");
    }
  };

  const handleDeleteRequest = (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation();
    setAssetToDelete(asset);
  };

  const handleConfirmDelete = async () => {
    if (assetToDelete) {
      try {
        await assetsService.delete(assetToDelete.id);
        showToast(t.feedback.delete_asset_success, "success");
        setAssetToDelete(null);
        refetch(); refetchMobile();
      } catch {
        showToast(t.feedback.delete_asset_error, "error");
      }
    }
  };

  const displayData = filteredData;

  const columns: ColumnDef<Asset>[] = [
    {
      key: "asset",
      header: t.assets.table.asset,
      sortable: true,
      sortValue: (item) => item.name,
      cell: (item) => (
        <div className="flex items-center space-x-5">
          <div className={`w-14 h-14 rounded-full overflow-hidden border-2 border-surface shadow-sm shrink-0 bg-app-bg flex items-center justify-center ${!item.is_active ? "grayscale opacity-40" : ""}`}>
            <AssetImage src={item.thumbnail_url || ""} alt={item.name} iconId={iconId} />
          </div>
          <span className={`font-bold text-title text-sm ${!item.is_active ? "opacity-40" : ""}`}>{item.name}</span>
        </div>
      ),
    },
    {
      key: "owner",
      header: t.assets.table.owner,
      sortable: true,
      sortValue: (item) => item.owner?.name || "",
      cell: (item) => <span className="font-bold text-subtitle/80 text-sm">{item.owner?.name || "---"}</span>,
    },
    {
      key: "location",
      header: t.assets.table.location,
      sortable: true,
      sortValue: (item) => item.location || "",
      cell: (item) => (
        <div className="flex items-center text-subtitle/70">
          <MapPin className="w-4 h-4 mr-2 text-brand" />
          <span className="text-sm font-semibold">{item.location || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "jobs",
      header: t.assets.table.services,
      align: "center",
      sortable: true,
      sortValue: (item: any) => item._count?.services || 0,
      cell: (item: any) => (
        <div className="flex items-center justify-center">
          <span className="min-w-[50px] h-9 flex items-center justify-center text-sm font-bold text-title bg-app-bg rounded-lg border border-border-theme/40 px-2">
            {item._count?.services || 0}
          </span>
        </div>
      ),
    },
    {
      key: "last_job",
      header: t.assets.table.last_service,
      align: "center",
      sortable: true,
      sortValue: (item) => item.last_service?.date || "",
      cell: (item) => (
        <div className="flex items-center justify-center text-subtitle/70">
          <Calendar className="w-4 h-4 mr-2" />
          <span className="font-semibold text-sm">
            {item.last_service?.date ? formatDate(item.last_service.date) : "---"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: t.assets.table.status,
      align: "center",
      cell: (item) =>
        item.is_active
          ? <span className="inline-flex justify-center w-20 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-green-100 text-green-700 border-green-200">{t.common.active}</span>
          : <span className="inline-flex justify-center w-20 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-red-100 text-red-700 border-red-200">{t.common.inactive}</span>,
    },
    {
      key: "actions",
      header: t.assets.table.actions,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center space-x-3">
          {canManage && (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
              className={`p-2.5 transition-all rounded-full ${item.is_active ? "text-emerald-500 hover:bg-emerald-50" : "text-subtitle/20 hover:text-subtitle/40 hover:bg-gray-50"}`}
            >
              {item.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setAssetToEdit(item); setIsModalOpen(true); }}
            className="p-2.5 text-subtitle/40 hover:text-brand transition-colors"
          >
            <Pencil className="w-5 h-5" />
          </button>
          {canManage && (
            <button
              onClick={(e) => handleDeleteRequest(e, item)}
              className="p-2.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const pagination = (
    <>
      <div className="flex items-center space-x-3">
        <div className="text-[15px] text-subtitle font-medium tracking-tight">
          {t.assets.pagination.showing}{" "}
          <span className="text-title font-bold">{displayData.length}</span>{" "}
          {t.assets.pagination.of}{" "}
          <span className="text-title font-bold">{meta.total}</span>{" "}
          {t.assets.pagination.assets}
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
  );

  const mobilePagination = (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-subtitle/60 font-semibold">
        {displayData.length} de {meta.total}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-2 rounded-xl border border-border-theme/40 text-subtitle disabled:opacity-20"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-black text-title w-6 text-center">{page}</span>
        <button
          onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
          disabled={page >= meta.totalPages}
          className="p-2 rounded-xl border border-border-theme/40 text-subtitle disabled:opacity-20"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const emptyState = (
    <div className="w-full flex flex-col items-center justify-center py-20 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full" />
        <div className="relative p-6 bg-white border-2 border-brand/5 shadow-2xl shadow-brand/5 rounded-[40px]">
          <Inbox className="w-12 h-12 text-brand/20" />
        </div>
      </div>
      <div className="text-center space-y-2 max-w-xs">
        <p className="font-black text-title text-2xl tracking-tight">{t.assets.states.empty_title}</p>
        <p className="text-subtitle font-medium leading-relaxed">{t.assets.states.empty_subtitle}</p>
      </div>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center space-x-3 bg-brand text-white px-8 py-4 rounded-full text-base font-black transition-all shadow-xl shadow-brand/20 hover:scale-105 active:scale-95"
      >
        <Plus className="w-5 h-5 stroke-[3px]" />
        <span>{t.assets.add_new}</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col space-y-4 lg:space-y-10">
      <h1 className="lg:hidden text-2xl font-black text-title tracking-tight text-center">{t.topbar.titles.assets}</h1>
      <FiltersBar
        searchPlaceholder={t.assets.search_placeholder}
        onSearchChange={setSearch}
        hasExternalFilter={!!activeSortKey}
        onClearAll={() => { setResetKey(k => k + 1); setActiveSortKey(null); }}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="hidden lg:flex items-center justify-center bg-brand hover:bg-brand/90 active:scale-95 text-white w-12 h-12 rounded-full font-black transition-all shadow-lg shadow-brand/25"
            aria-label={t.assets.add_new}
          >
            <Plus className="w-5 h-5 stroke-[4px]" />
          </button>
        }
      />

      <div className="flex-1 min-h-[400px]">
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-20 animate-pulse">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.assets.states.loading}</p>
          </div>
        ) : isError ? (
          <ModuleContainer>
            <div className="w-full flex flex-col items-center justify-center py-20 space-y-4">
              <div className="p-4 bg-error/10 rounded-full">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <div className="text-center">
                <p className="font-black text-title text-xl">{t.assets.states.error_title}</p>
                <p className="text-subtitle font-medium">{t.assets.states.error_subtitle}</p>
              </div>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-app-bg hover:bg-border-theme/20 border border-border-theme/40 rounded-xl text-title font-bold text-sm transition-all"
              >
                {t.common.retry}
              </button>
            </div>
          </ModuleContainer>
        ) : rawAssets.length === 0 ? (
          <>
            <div className="hidden lg:block"><ModuleContainer>{emptyState}</ModuleContainer></div>
            <div className="block lg:hidden">{emptyState}</div>
          </>
        ) : (
          <>
            {/* Desktop: tabla */}
            <div className="hidden lg:block">
              <ModuleContainer>
                <DataTable
                  data={displayData}
                  columns={columns}
                  keyExtractor={(item) => item.id}
                  footer={pagination}
                  onRowClick={(item) => setSelectedAsset(item)}
                  onSortChange={setActiveSortKey}
                  resetSortTrigger={resetKey}
                />
              </ModuleContainer>
            </div>

            {/* Mobile: infinite scroll */}
            <div className="block lg:hidden">
              {/* Filtros mobile */}
              <div className="flex items-center gap-2 mb-4">
                {/* Status pills */}
                <div className="flex items-center bg-app-bg rounded-full px-1 border border-border-theme/30 shrink-0">
                  {(["all", "active", "inactive"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setMobileStatusFilter(s)}
                      className={`px-3 py-2 rounded-full text-xs font-bold transition-all ${
                        mobileStatusFilter === s
                          ? "bg-white text-brand shadow-sm ring-1 ring-black/5"
                          : "text-subtitle/50"
                      }`}
                    >
                      {s === "all" ? t.common.all : s === "active" ? t.common.active : t.common.inactive}
                    </button>
                  ))}
                </div>

                {/* Owner dropdown */}
                <div ref={ownerDropdownRef} className="relative flex-1 min-w-0">
                  {mobileOwnerFilter ? (
                    <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full pl-1 pr-3 py-1 max-w-full">
                      <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-white">
                          {getInitials(uniqueOwners.find(o => o.id === mobileOwnerFilter)?.name ?? "")}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-brand truncate min-w-0">
                        {uniqueOwners.find(o => o.id === mobileOwnerFilter)?.name}
                      </span>
                      <button onClick={() => setMobileOwnerFilter(null)} className="text-brand/50 hover:text-brand transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsOwnerDropdownOpen(v => !v)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-theme/50 bg-surface text-subtitle/60 text-sm font-semibold transition-colors hover:border-brand/30 w-full justify-between"
                    >
                      <span>{t.assets.detail.owner}</span>
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  )}

                  {isOwnerDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-20 w-64 overflow-hidden">
                      {/* Search input */}
                      <div className="p-3 border-b border-border-theme/20">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-subtitle/40" />
                          <input
                            autoFocus
                            type="text"
                            value={ownerSearch}
                            onChange={e => setOwnerSearch(e.target.value)}
                            placeholder={t.assets.filters.search_owner}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-app-bg rounded-xl border border-border-theme/30 focus:outline-none focus:border-brand/40 font-medium text-title placeholder:text-subtitle/30"
                          />
                        </div>
                      </div>
                      {/* Owner list */}
                      <div className="max-h-52 overflow-y-auto">
                        {uniqueOwners
                          .filter(o => !ownerSearch.trim() || o.name.toLowerCase().includes(ownerSearch.toLowerCase()))
                          .map(owner => (
                            <button
                              key={owner.id}
                              onClick={() => { setMobileOwnerFilter(owner.id); setIsOwnerDropdownOpen(false); setOwnerSearch(""); }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-bg transition-colors text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                                <span className="text-[11px] font-black text-brand">{getInitials(owner.name)}</span>
                              </div>
                              <span className="text-sm font-semibold text-title">{owner.name}</span>
                            </button>
                          ))}
                        {uniqueOwners.filter(o => !ownerSearch.trim() || o.name.toLowerCase().includes(ownerSearch.toLowerCase())).length === 0 && (
                          <p className="px-4 py-4 text-sm text-subtitle/50 text-center font-medium">{t.common.no_results}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
              {mobileAssets.map((item: Asset) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  iconId={iconId}
                  onEdit={() => { setAssetToEdit(item); setIsModalOpen(true); }}
                  onDelete={(e) => handleDeleteRequest(e, item)}
                  onToggle={() => handleToggleStatus(item)}
                  onClick={() => setSelectedAsset(item)}
                />
              ))}
              <div ref={sentinelRef} className="h-4" />
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 text-brand animate-spin" />
                </div>
              )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* FAB móvil para agregar */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-6 lg:hidden z-20 w-14 h-14 bg-brand text-white rounded-full shadow-xl shadow-brand/30 flex items-center justify-center active:scale-95 transition-all"
        aria-label={t.assets.add_new}
      >
        <Plus className="w-6 h-6 stroke-[3px]" />
      </button>

      <AssetModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setAssetToEdit(null); }}
        asset={assetToEdit}
        onSuccess={() => { setIsModalOpen(false); setAssetToEdit(null); refetch(); refetchMobile(); }}
      />

      <AssetDrawer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

      <ConfirmModal
        isOpen={!!assetToDelete}
        onClose={() => setAssetToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t.confirm_modal.delete_asset_title}
        description={t.confirm_modal.delete_description}
        confirmText={t.confirm_modal.confirm_delete}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
      />
    </div>
  );
}
