"use client";

import React, { useState, useMemo } from "react";
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
import { formatDate } from "@/lib/formatDate";
import AssetIcon from "@/components/ui/AssetIcon";
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

  const debouncedSearch = useDebounce(search, 300);

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
  });

  const items = data?.data ?? [];
  const meta = data?.meta;
  const hasExternalFilter = !!categoryFilter || !!deletedByFilter;

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
        key: "name",
        header: t.trash.table.name,
        sortable: true,
        cell: (item) => (
          <span className="font-semibold text-title text-sm">{item.name}</span>
        ),
      },
      {
        key: "deleted_at",
        header: t.trash.table.deleted_at,
        sortable: true,
        cell: (item) => (
          <span className="text-subtitle text-sm">{formatDate(item.deleted_at)}</span>
        ),
      },
      {
        key: "deleted_by",
        header: t.trash.table.deleted_by,
        sortable: false,
        cell: (item) => (
          <span className="text-subtitle text-sm">
            {item.deleted_by?.name || "—"}
          </span>
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
              className="p-2 rounded-xl text-brand hover:bg-brand/10 transition-colors"
              title={t.trash.actions.restore}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ type: "delete", item });
              }}
              className="p-2 rounded-xl text-error hover:bg-error/10 transition-colors"
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

  if (isLoading) {
    return (
      <ModuleContainer>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <p className="text-subtitle font-medium">{t.trash.states.loading}</p>
        </div>
      </ModuleContainer>
    );
  }

  if (isError) {
    return (
      <ModuleContainer>
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
      </ModuleContainer>
    );
  }

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
      <h1 className="lg:hidden text-2xl font-black text-title tracking-tight text-center">{t.trash.title}</h1>

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
        <DataTable
          columns={columns}
          data={items}
          emptyState={{
            title: t.trash.states.empty_title,
            subtitle: t.trash.states.empty_subtitle,
          }}
          footer={pagination}
        />
      </ModuleContainer>

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
    </div>
  );
}
