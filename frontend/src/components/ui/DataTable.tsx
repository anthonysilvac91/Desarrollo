import React from "react";

export interface ColumnDef<T> {
  key: string;
  header: string;
  cell?: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
  footer?: React.ReactNode;
  onRowClick?: (item: T) => void; // Added onRowClick prop
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = "No hay resultados disponibles.",
  footer,
  onRowClick,
}: DataTableProps<T>) {
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
                  className={`px-4 sm:px-10 py-6 text-${col.align || "left"} text-[13.5px] font-bold text-subtitle uppercase tracking-[0.1em] ${col.width || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-theme/30">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-10 py-16 text-center text-base text-subtitle/60 font-medium"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
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
