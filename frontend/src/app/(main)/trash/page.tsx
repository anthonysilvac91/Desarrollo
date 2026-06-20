"use client";

import React, { useState, useMemo } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trashService, TrashItem } from "@/services/trash.service";
import { useToast } from "@/lib/ToastContext";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate } from "@/lib/formatDate";
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

const MODULE_LABELS: Record<string, Record<string, string>> = {
  en: { assets: "Assets", services: "Services", users: "Users", owners: "Owners" },
  es: { assets: "Activos", services: "Servicios", users: "Usuarios", owners: "Owners" },
};

export default function TrashPage() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ type: "restore" | "delete"; item: TrashItem } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 15;

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["trash", debouncedSearch, filterType, page],
    queryFn: () =>
      trashService.findAll({
        search: debouncedSearch || undefined,
        entity_type: filterType || undefined,
        page,
        limit,
      }),
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

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
              <Icon className="w-3.5 h-3.5" />
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
        key: "module",
        header: t.trash.table.module,
        sortable: true,
        cell: (item) => (
          <span className="text-subtitle text-sm">
            {MODULE_LABELS[language]?.[item.module] || item.module}
          </span>
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
        sortable: false,
        cell: (item) => (
          <div className="flex items-center gap-1">
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
    [t, language]
  );

  const filterTabs = [
    { label: t.trash.filter_all, value: "" },
    { label: t.trash.categories.asset, value: "asset" },
    { label: t.trash.categories.service, value: "service" },
    { label: t.trash.categories.user, value: "user" },
    { label: t.trash.categories.owner, value: "owner" },
  ];

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

  return (
    <ModuleContainer>
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border-theme/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-title tracking-tight">{t.trash.title}</h2>
            <p className="text-subtitle text-sm mt-1">{t.trash.subtitle}</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <FiltersBar
              onSearchChange={(val) => { setSearch(val); setPage(1); }}
              searchPlaceholder={t.trash.search_placeholder}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setFilterType(tab.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterType === tab.value
                    ? "bg-brand text-white shadow-sm"
                    : "bg-app-bg text-subtitle hover:bg-brand/10 hover:text-brand"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scroll">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-16">
            <div className="w-16 h-16 bg-app-bg rounded-2xl flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-subtitle/40" />
            </div>
            <h3 className="text-lg font-bold text-title">{t.trash.states.empty_title}</h3>
            <p className="text-subtitle text-sm">{t.trash.states.empty_subtitle}</p>
          </div>
        ) : (
          <DataTable columns={columns} data={items} />
        )}
      </div>

      {/* Pagination */}
      {meta && (meta.total ?? 0) > 0 && (
        <div className="px-6 py-4 border-t border-border-theme/40 flex items-center justify-between">
          <p className="text-xs text-subtitle font-medium">
            {t.trash.pagination.showing}{" "}
            <span className="text-title font-bold">{items.length}</span>{" "}
            {t.trash.pagination.of}{" "}
            <span className="text-title font-bold">{meta.total}</span>{" "}
            {t.trash.pagination.items}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-xl hover:bg-app-bg disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-title">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-xl hover:bg-app-bg disabled:opacity-30 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

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
    </ModuleContainer>
  );
}
