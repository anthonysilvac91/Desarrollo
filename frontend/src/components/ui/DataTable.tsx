import React, { useState, useMemo, useEffect, useRef } from "react";
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export interface ColumnDef<T> {
  key: string;
  header: string;
  cell?: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor?: (item: T) => string | number;
  emptyMessage?: string;
  emptyState?: { title: string; subtitle: string };
  isLoading?: boolean;
  footer?: React.ReactNode;
  onRowClick?: (item: T) => void;
  onSortChange?: (key: string | null) => void;
  resetSortTrigger?: number;
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor = (item: any) => item.id || Math.random(),
  emptyMessage = "No hay resultados disponibles.",
  emptyState,
  isLoading,
  footer,
  onRowClick,
  onSortChange,
  resetSortTrigger,
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const prevResetTrigger = useRef(resetSortTrigger);

  useEffect(() => {
    if (resetSortTrigger !== prevResetTrigger.current) {
      prevResetTrigger.current = resetSortTrigger;
      setSortKey(null);
      setSortDir("asc");
      onSortChange?.(null);
    }
  }, [resetSortTrigger]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      const newDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(newDir);
    } else {
      setSortKey(key);
      setSortDir("asc");
      onSortChange?.(key);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find(c => c.key === sortKey);
    return [...data].sort((a, b) => {
      const av = col?.sortValue ? col.sortValue(a) : (a as any)[sortKey] ?? "";
      const bv = col?.sortValue ? col.sortValue(b) : (b as any)[sortKey] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  return (
    <div className="flex flex-col min-h-0 bg-surface transition-colors">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-app-bg/60 border-b border-border-theme/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 sm:px-10 py-6 text-${col.align || "left"} ${col.width || ""}`}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      title={sortKey === col.key ? (sortDir === "asc" ? t.common.sorted_asc : t.common.sorted_desc) : t.common.sort_column}
                      className={`inline-flex items-center space-x-1.5 group transition-colors ${
                        sortKey === col.key ? "text-brand" : "text-subtitle hover:text-title"
                      }`}
                    >
                      <span className="text-[13.5px] font-bold uppercase tracking-widest">
                        {col.header}
                      </span>
                      <span className={`transition-colors ${sortKey === col.key ? "text-brand" : "text-subtitle/30 group-hover:text-subtitle/60"}`}>
                        {sortKey === col.key
                          ? sortDir === "asc"
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronsUpDown className="w-3.5 h-3.5" />
                        }
                      </span>
                    </button>
                  ) : (
                    <span className="text-[13.5px] font-bold text-subtitle uppercase tracking-widest">
                      {col.header}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-theme/30">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  {columns.map((col) => (
                    <td key={`skeleton-cell-${col.key}`} className="px-10 py-7">
                      <div className="h-5 bg-gray-100 rounded-lg animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-10 py-24">
                  <div className="flex flex-col items-center justify-center text-center space-y-2">
                    {emptyState ? (
                      <>
                        <h3 className="text-xl font-black text-title">{emptyState.title}</h3>
                        <p className="text-subtitle/60 font-medium max-w-xs">{emptyState.subtitle}</p>
                      </>
                    ) : (
                      <p className="text-subtitle/60 font-medium">{emptyMessage}</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={`transition-colors group ${onRowClick ? "cursor-pointer hover:bg-app-bg/40" : "hover:bg-app-bg/20"}`}
                >
                  {columns.map((col) => (
                    <td
                      key={`${keyExtractor(item)}-${col.key}`}
                      className={`px-4 sm:px-10 py-7 whitespace-nowrap text-base text-title font-medium text-${col.align || "left"}`}
                    >
                      {col.cell ? col.cell(item) : (item as Record<string, unknown>)[col.key] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {footer && (
        <div className="px-10 py-6 border-t border-border-theme/50 flex items-center justify-between bg-surface text-subtitle transition-colors">
          {footer}
        </div>
      )}
    </div>
  );
}
