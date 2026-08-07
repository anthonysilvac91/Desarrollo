"use client";

import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import FilterDropdown from "@/components/ui/FilterDropdown";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trashService, TrashItem } from "@/services/trash.service";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDate } from "@/lib/formatDate";
import AssetIcon from "@/components/ui/AssetIcon";
import ServiceDrawer from "@/components/services/ServiceDrawer";
import AssetDrawer from "@/components/assets/AssetDrawer";
import OwnerDrawer from "@/components/owners/OwnerDrawer";
import UserDrawer from "@/components/users/UserDrawer";
import {
  Loader2,
  AlertCircle,
  Trash2,
  RotateCcw,
  Package,
  Wrench,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Inbox,
  Search,
  X,
  Calendar,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  asset: Package,
  service: Wrench,
  user: Users,
  owner: Building2,
};

const CATEGORY_STYLES: Record<string, string> = {
  asset: "bg-blue-50 text-blue-600 border-blue-100",
  service: "bg-amber-50 text-amber-600 border-amber-100",
  user: "bg-indigo-50 text-indigo-600 border-indigo-100",
  owner: "bg-emerald-50 text-emerald-600 border-emerald-100",
};

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

interface TrashCardProps {
  item: TrashItem;
  assetIconId?: string | null;
  categoryLabel: string;
  onClick: () => void;
}

const TrashCard = ({ item, assetIconId, categoryLabel, onClick }: TrashCardProps) => {
  const Icon = CATEGORY_ICONS[item.entity_type] || Package;
  const style = CATEGORY_STYLES[item.entity_type] || "";
  return (
    <div
      onClick={onClick}
      className="bg-surface rounded-2xl border border-border-theme/40 shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-3 p-4">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-app-bg shadow-sm shrink-0 bg-brand/10 flex items-center justify-center">
          {item.entity_type === "asset" ? (
            <AssetIcon iconId={assetIconId} className="w-6 h-6 text-brand" />
          ) : (
            <Icon className="w-6 h-6 text-brand" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-title text-sm truncate">{item.name}</p>

          <div className="mt-1.5">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${style}`}>
              {categoryLabel}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-[8px] font-black text-brand leading-none">
                  {item.deleted_by?.name ? getInitials(item.deleted_by.name) : "?"}
                </span>
              </div>
              <span className="text-[11px] text-subtitle/70 font-semibold">{item.deleted_by?.name || "---"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-brand shrink-0" />
              <span className="text-[11px] text-subtitle/70 font-semibold">{formatDate(item.deleted_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center text-brand">
          <ChevronRight className="w-5 h-5 shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default function TrashPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const assetIconId = user?.organization?.default_asset_icon;

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [deletedByFilter, setDeletedByFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [confirmAction, setConfirmAction] = useState<{ type: "restore" | "delete"; item: TrashItem } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<TrashItem | null>(null);

  const [mobileSearch, setMobileSearch] = useState("");
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState("");
  const [mobileDeletedByFilter, setMobileDeletedByFilter] = useState("");
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const [isMobileDeletedByOpen, setIsMobileDeletedByOpen] = useState(false);
  const [mobileDeletedBySearch, setMobileDeletedBySearch] = useState("");
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileItems, setMobileItems] = useState<TrashItem[]>([]);

  const debouncedSearch = useDebounce(search, 300);
  const debouncedMobileSearch = useDebounce(mobileSearch, 300);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const { data: filterOptions } = useQuery({
    queryKey: ["trash-filter-options"],
    queryFn: () => trashService.getFilterOptions(),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["trash", debouncedSearch, categoryFilter, deletedByFilter, page, limit],
    queryFn: () =>
      trashService.findAll({
        search: debouncedSearch || undefined,
        entity_type: categoryFilter || undefined,
        deleted_by_id: deletedByFilter || undefined,
        page,
        limit,
      }),
    enabled: isMobile === false,
  });

  const { data: mobileData, isLoading: mobileLoading } = useQuery({
    queryKey: ["trash-mobile", debouncedMobileSearch, mobileCategoryFilter, mobileDeletedByFilter, mobilePage],
    queryFn: () =>
      trashService.findAll({
        search: debouncedMobileSearch || undefined,
        entity_type: mobileCategoryFilter || undefined,
        deleted_by_id: mobileDeletedByFilter || undefined,
        page: mobilePage,
        limit: 10,
      }),
    enabled: isMobile === true,
  });

  useEffect(() => { setMobilePage(1); setMobileItems([]); }, [debouncedMobileSearch, mobileCategoryFilter, mobileDeletedByFilter]);

  useEffect(() => {
    if (!mobileData) return;
    const newList = mobileData.data ?? [];
    setMobileItems(prev => (mobilePage === 1 ? newList : [...prev, ...newList]));
  }, [mobileData]);

  const items = data?.data ?? [];
  const meta = data?.meta;
  const hasExternalFilter = !!categoryFilter || !!deletedByFilter;
  const mobileTotalPages = mobileData?.meta?.totalPages ?? 1;
  const isMobilePending = isMobile === null;
  const isMobileListLoading = isMobilePending || mobileLoading;

  const { data: detailData } = useQuery({
    queryKey: ["trash-detail", detailItem?.entity_type, detailItem?.id],
    queryFn: () => trashService.findOneDetail(detailItem!.entity_type, detailItem!.id),
    enabled: !!detailItem,
  });

  const handleAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === "restore") {
        await trashService.restore(confirmAction.item.entity_type, confirmAction.item.id);
        showToast(t.trash.states.restore_success, "success");
      } else {
        await trashService.permanentDelete(confirmAction.item.entity_type, confirmAction.item.id);
        showToast(t.trash.states.delete_success, "success");
      }
      setMobileItems(prev => prev.filter(i => i.id !== confirmAction.item.id));
      setDetailItem(prev => (prev?.id === confirmAction.item.id ? null : prev));
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: [confirmAction.item.module] });
      queryClient.invalidateQueries({ queryKey: [confirmAction.item.entity_type + "s"] });
    } catch {
      showToast(
        confirmAction.type === "restore" ? t.trash.states.restore_error : t.trash.states.delete_error,
        "error"
      );
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const getCategoryLabel = (type: TrashItem["entity_type"]) => {
    return t.trash.categories[type] || type;
  };

  const columns: ColumnDef<TrashItem>[] = useMemo(
    () => [
      {
        key: "name",
        header: t.trash.table.name,
        sortable: true,
        cell: (item) => {
          const Icon = CATEGORY_ICONS[item.entity_type] || Package;
          return (
            <div className="flex items-center space-x-3">
              <div
                className="rounded-full overflow-hidden border-2 border-surface shadow-sm bg-brand/10 flex items-center justify-center shrink-0"
                style={{ width: 52, height: 52 }}
              >
                {item.entity_type === "asset" ? (
                  <AssetIcon iconId={assetIconId} className="w-5 h-5 text-brand" />
                ) : (
                  <Icon className="w-5 h-5 text-brand" />
                )}
              </div>
              <span className="font-semibold text-title text-sm">{item.name}</span>
            </div>
          );
        },
      },
      {
        key: "entity_type",
        header: t.trash.table.category,
        sortable: true,
        cell: (item) => {
          const Icon = CATEGORY_ICONS[item.entity_type] || Package;
          const style = CATEGORY_STYLES[item.entity_type] || "";
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${style}`}>
              {item.entity_type === "asset" ? (
                <AssetIcon iconId={assetIconId} className="w-3.5 h-3.5" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              {getCategoryLabel(item.entity_type)}
            </span>
          );
        },
      },
      {
        key: "deleted_at",
        header: t.trash.table.deleted_at,
        sortable: true,
        cell: (item) => (
          <div className="flex items-center text-subtitle/70">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-brand" />
            <span className="text-sm font-semibold">{formatDate(item.deleted_at)}</span>
          </div>
        ),
      },
      {
        key: "deleted_by",
        header: t.trash.table.deleted_by,
        sortable: false,
        cell: (item) => (
          <div className="flex items-center text-subtitle/80">
            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center mr-2 shrink-0">
              <span className="text-[10px] font-black text-brand">
                {item.deleted_by?.name ? getInitials(item.deleted_by.name) : "?"}
              </span>
            </div>
            <span className="text-subtitle text-sm">
              {item.deleted_by?.name || "—"}
            </span>
          </div>
        ),
      },
      {
        key: "actions",
        header: t.trash.table.actions,
        align: "center",
        sortable: false,
        cell: (item) => (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ type: "restore", item });
              }}
              className="p-1.5 rounded-full text-brand/40 hover:text-brand hover:bg-brand/10 transition-all"
              title={t.trash.actions.restore}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ type: "delete", item });
              }}
              className="p-1.5 rounded-full text-error/40 hover:text-error hover:bg-error/5 transition-all"
              title={t.trash.actions.permanent_delete}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [t, assetIconId]
  );

  const totalPages = meta?.totalPages ?? 1;
  const pagination = meta && (meta.total ?? 0) > 0 ? (
    <>
      <div className="flex items-center space-x-3">
        <div className="text-xs text-subtitle/40 font-medium tracking-tight">
          {t.trash.pagination.showing}{" "}
          <span className="text-subtitle/70 font-bold">{items.length}</span>{" "}
          {t.trash.pagination.of}{" "}
          <span className="text-subtitle/70 font-bold">{meta.total}</span>{" "}
          {t.trash.pagination.items}
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
          disabled={page <= 1}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-md shadow-brand/20">
          {page}
        </button>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  ) : null;

  return (
    <div className="flex flex-col space-y-4 lg:space-y-8">
      {/* Mobile */}
      <div className="lg:hidden flex flex-col gap-4 pb-8">
        <h1 className="text-2xl font-black text-title tracking-tight text-center">{t.trash.title}</h1>

        <FiltersBar
          searchPlaceholder={t.trash.search_placeholder}
          onSearchChange={(value) => setMobileSearch(value)}
          showQuickFilters={false}
          hasExternalFilter={!!mobileCategoryFilter || !!mobileDeletedByFilter}
          onClearAll={() => { setMobileSearch(""); setMobileCategoryFilter(""); setMobileDeletedByFilter(""); }}
          showClearAll={false}
        />

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category filter */}
          <button
            onClick={() => { setIsMobileCategoryOpen(v => !v); setIsMobileDeletedByOpen(false); }}
            className={`flex items-center gap-1.5 h-11 px-4 rounded-2xl border text-sm font-semibold shadow-sm transition-all shrink-0 ${
              mobileCategoryFilter
                ? "border-brand/40 bg-brand/5 text-brand"
                : "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80"
            }`}
          >
            {mobileCategoryFilter ? (
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                {mobileCategoryFilter === "asset" ? (
                  <AssetIcon iconId={assetIconId} className="w-3 h-3 text-brand" />
                ) : (
                  (() => {
                    const CategoryIcon = CATEGORY_ICONS[mobileCategoryFilter] || Package;
                    return <CategoryIcon className="w-3 h-3 text-brand" />;
                  })()
                )}
              </div>
            ) : (
              <>
                <span>{t.trash.table.category}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </>
            )}
          </button>

          {/* Deleted by filter */}
          <button
            onClick={() => { setIsMobileDeletedByOpen(v => !v); setIsMobileCategoryOpen(false); }}
            className={`flex items-center gap-1.5 h-11 px-4 rounded-2xl border text-sm font-semibold shadow-sm transition-all shrink-0 ${
              mobileDeletedByFilter
                ? "border-brand/40 bg-brand/5 text-brand"
                : "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80"
            }`}
          >
            {mobileDeletedByFilter ? (
              <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
                <span className="text-[9px] font-black text-white leading-none">
                  {getInitials(filterOptions?.users.find(u => u.id === mobileDeletedByFilter)?.name ?? "")}
                </span>
              </div>
            ) : (
              <>
                <span>{t.trash.table.deleted_by}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </>
            )}
          </button>
        </div>

        {/* Category bottom sheet */}
        {isMobileCategoryOpen && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="fixed inset-0 z-200 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => setIsMobileCategoryOpen(false)} />
            <div className="relative bg-white rounded-t-3xl pb-safe animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className="text-base font-black text-title">{t.trash.table.category}</span>
                <button onClick={() => setIsMobileCategoryOpen(false)} className="p-1.5 rounded-full hover:bg-app-bg text-subtitle/40">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto pb-6">
                {(filterOptions?.categories ?? ["asset", "service", "user", "owner"]).map((category) => {
                  const CategoryIcon = CATEGORY_ICONS[category] || Package;
                  return (
                    <button
                      key={category}
                      onClick={() => { setMobileCategoryFilter(category); setIsMobileCategoryOpen(false); }}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${mobileCategoryFilter === category ? "bg-brand/5" : "hover:bg-app-bg"}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                        {category === "asset" ? (
                          <AssetIcon iconId={assetIconId} className="w-3.5 h-3.5 text-brand" />
                        ) : (
                          <CategoryIcon className="w-3.5 h-3.5 text-brand" />
                        )}
                      </div>
                      <span className={`text-sm font-semibold ${mobileCategoryFilter === category ? "text-brand" : "text-title"}`}>
                        {getCategoryLabel(category)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Deleted by bottom sheet */}
        {isMobileDeletedByOpen && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="fixed inset-0 z-200 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => { setIsMobileDeletedByOpen(false); setMobileDeletedBySearch(""); }} />
            <div className="relative bg-white rounded-t-3xl pb-safe animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className="text-base font-black text-title">{t.trash.table.deleted_by}</span>
                <button onClick={() => { setIsMobileDeletedByOpen(false); setMobileDeletedBySearch(""); }} className="p-1.5 rounded-full hover:bg-app-bg text-subtitle/40">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtitle/40" />
                  <input
                    autoFocus
                    type="text"
                    value={mobileDeletedBySearch}
                    onChange={e => setMobileDeletedBySearch(e.target.value)}
                    placeholder={t.common.search}
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-app-bg rounded-2xl border border-border-theme/30 focus:outline-none focus:border-brand/40 font-medium text-title placeholder:text-subtitle/30"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto pb-6">
                {(filterOptions?.users ?? [])
                  .filter(u => !mobileDeletedBySearch.trim() || u.name.toLowerCase().includes(mobileDeletedBySearch.toLowerCase()))
                  .map(deletedByUser => (
                    <button
                      key={deletedByUser.id}
                      onClick={() => { setMobileDeletedByFilter(deletedByUser.id); setIsMobileDeletedByOpen(false); setMobileDeletedBySearch(""); }}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${mobileDeletedByFilter === deletedByUser.id ? "bg-brand/5" : "hover:bg-app-bg"}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-black text-brand">{getInitials(deletedByUser.name)}</span>
                      </div>
                      <span className={`text-sm font-semibold ${mobileDeletedByFilter === deletedByUser.id ? "text-brand" : "text-title"}`}>{deletedByUser.name}</span>
                    </button>
                  ))}
                {(filterOptions?.users ?? []).filter(u => !mobileDeletedBySearch.trim() || u.name.toLowerCase().includes(mobileDeletedBySearch.toLowerCase())).length === 0 && (
                  <p className="px-5 py-4 text-sm text-subtitle/50 text-center font-medium">{t.common.no_results}</p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Active filter chips */}
        {(mobileCategoryFilter || mobileDeletedByFilter) && (
          <div className="flex flex-wrap gap-2">
            {mobileCategoryFilter && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/5 border border-brand/20">
                <span className="text-xs font-semibold text-brand">{getCategoryLabel(mobileCategoryFilter as TrashItem["entity_type"])}</span>
                <button onClick={() => setMobileCategoryFilter("")} className="text-brand/40 hover:text-brand transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {mobileDeletedByFilter && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/5 border border-brand/20">
                <div className="w-4 h-4 rounded-full bg-brand flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-black text-white leading-none">
                    {getInitials(filterOptions?.users.find(u => u.id === mobileDeletedByFilter)?.name ?? "")}
                  </span>
                </div>
                <span className="text-xs font-semibold text-brand">
                  {filterOptions?.users.find(u => u.id === mobileDeletedByFilter)?.name ?? ""}
                </span>
                <button onClick={() => setMobileDeletedByFilter("")} className="text-brand/40 hover:text-brand transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {isMobileListLoading && mobileItems.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.trash.states.loading}</p>
          </div>
        ) : mobileItems.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 space-y-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/8 text-brand/40 ring-8 ring-brand/5">
              <Inbox className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black tracking-tight text-title">{t.trash.states.empty_title}</h3>
              <p className="text-sm font-medium leading-relaxed text-subtitle/60 max-w-xs mx-auto">{t.trash.states.empty_subtitle}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mobileItems.map((item) => (
              <TrashCard
                key={item.id}
                item={item}
                assetIconId={assetIconId}
                categoryLabel={getCategoryLabel(item.entity_type)}
                onClick={() => setDetailItem(item)}
              />
            ))}
          </div>
        )}

        {mobileItems.length > 0 && mobilePage < mobileTotalPages && (
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
            {isMobileListLoading ? t.trash.states.loading : t.common.view_more}
          </button>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col space-y-8">
        <FiltersBar
          searchPlaceholder={t.trash.search_placeholder}
          onSearchChange={(value) => { setSearch(value); setPage(1); }}
          showQuickFilters={false}
          hasExternalFilter={hasExternalFilter}
          onClearAll={() => { setSearch(""); setCategoryFilter(""); setDeletedByFilter(""); setPage(1); }}
          actions={
            <div className="hidden lg:flex items-center gap-3">
              <FilterDropdown
                value={categoryFilter}
                onChange={(value) => { setCategoryFilter(value); setPage(1); }}
                options={(filterOptions?.categories ?? ["asset", "service", "user", "owner"]).map((category) => ({
                  value: category,
                  label: getCategoryLabel(category),
                }))}
                placeholder={t.trash.table.category}
              />
              <FilterDropdown
                value={deletedByFilter}
                onChange={(value) => { setDeletedByFilter(value); setPage(1); }}
                options={(filterOptions?.users ?? []).map((deletedByUser) => ({
                  value: deletedByUser.id,
                  label: deletedByUser.name,
                }))}
                placeholder={t.trash.table.deleted_by}
              />
            </div>
          }
        />

        <ModuleContainer roundedClass="rounded-2xl">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
              <p className="text-subtitle font-medium">{t.trash.states.loading}</p>
            </div>
          ) : isError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <AlertCircle className="w-12 h-12 text-error" />
              <h3 className="text-lg font-bold text-title">{t.trash.states.error_title}</h3>
              <p className="text-subtitle text-sm">{t.trash.states.error_subtitle}</p>
              <button
                onClick={() => refetch()}
                className="px-6 py-2.5 bg-brand text-white rounded-xl font-bold text-sm hover:bg-brand/90 transition"
              >
                {t.common.retry}
              </button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={items}
              onRowClick={(item) => setDetailItem(item)}
              emptyState={{
                title: t.trash.states.empty_title,
                subtitle: t.trash.states.empty_subtitle,
              }}
              footer={pagination}
            />
          )}
        </ModuleContainer>
      </div>

      {/* Confirm Modals */}
      {confirmAction?.type === "restore" && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmAction(null)}
          onConfirm={handleAction}
          title={t.trash.confirm_restore.title}
          description={t.trash.confirm_restore.description}
          confirmText={t.trash.confirm_restore.confirm}
          cancelText={t.common.cancel}
          variant="brand"
        />
      )}
      {confirmAction?.type === "delete" && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmAction(null)}
          onConfirm={handleAction}
          title={t.trash.confirm_permanent_delete.title}
          description={t.trash.confirm_permanent_delete.description}
          confirmText={t.trash.confirm_permanent_delete.confirm}
          cancelText={t.common.cancel}
          variant="danger"
        />
      )}

      {/* Detail drawers (read-only, with restore/permanent-delete actions) */}
      {detailItem?.entity_type === "service" && (
        <ServiceDrawer
          service={detailData ?? null}
          onClose={() => setDetailItem(null)}
          onRestore={() => setConfirmAction({ type: "restore", item: detailItem })}
          onPermanentDelete={() => setConfirmAction({ type: "delete", item: detailItem })}
          readOnly
        />
      )}
      {detailItem?.entity_type === "asset" && (
        <AssetDrawer
          asset={detailData ?? null}
          onClose={() => setDetailItem(null)}
          onRestore={() => setConfirmAction({ type: "restore", item: detailItem })}
          onPermanentDelete={() => setConfirmAction({ type: "delete", item: detailItem })}
          readOnly
        />
      )}
      {detailItem?.entity_type === "owner" && (
        <OwnerDrawer
          owner={detailData ?? null}
          onClose={() => setDetailItem(null)}
          onRestore={() => setConfirmAction({ type: "restore", item: detailItem })}
          onPermanentDelete={() => setConfirmAction({ type: "delete", item: detailItem })}
          readOnly
        />
      )}
      {detailItem?.entity_type === "user" && (
        <UserDrawer
          user={detailData ?? null}
          onClose={() => setDetailItem(null)}
          onRestore={() => setConfirmAction({ type: "restore", item: detailItem })}
          onPermanentDelete={() => setConfirmAction({ type: "delete", item: detailItem })}
          readOnly
        />
      )}
    </div>
  );
}
