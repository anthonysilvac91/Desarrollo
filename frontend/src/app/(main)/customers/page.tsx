"use client";

import React, { useState, useEffect } from "react";
import { Plus, Building2, Trash2, Edit2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import FiltersBar from "@/components/ui/FiltersBar";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { companiesService, Company } from "@/services/companies.service";
import CompanyModal from "@/components/companies/CompanyModal";
import DataTable from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function CompaniesPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const getQueryParams = () => {
    const params: any = { page, limit };
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  };

  const { data: responseData, isLoading } = useQuery({
    queryKey: ["companies", getQueryParams()],
    queryFn: () => companiesService.findAll(getQueryParams()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      showToast(t.clients.states.delete_success, "success");
      setCompanyToDelete(null);
    },
    onError: () => {
      showToast(t.clients.states.error_delete, "error");
    }
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const companiesList: Company[] = Array.isArray(responseData) ? responseData : responseData?.data || [];
  const meta = !Array.isArray(responseData) && responseData?.meta
    ? responseData.meta
    : { total: companiesList.length, page: 1, limit: 10, totalPages: 1 };

  const columns = [
    {
      header: t.clients.table.name.toUpperCase(),
      key: "name",
      cell: (item: Company) => (
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
      header: t.clients.table.status.toUpperCase(),
      key: "is_active",
      cell: (item: Company) => (
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
      header: t.clients.table.actions.toUpperCase(),
      key: "actions",
      cell: (item: Company) => (
        <div className="flex justify-end space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); setEditingCompany(item); setIsModalOpen(true); }}
            className="p-2 hover:bg-brand/5 text-subtitle hover:text-brand rounded-xl transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCompanyToDelete(item); }}
            className="p-2 hover:bg-error/5 text-subtitle hover:text-error rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col space-y-8">
      <FiltersBar
        searchPlaceholder={t.clients.search_placeholder}
        onSearchChange={setSearchTerm}
        showQuickFilters={false}
        actions={
          <button
            onClick={() => {
              setEditingCompany(null);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25"
          >
            <Plus className="w-5 h-5 stroke-[4px]" />
            <span>{t.clients.add_new}</span>
          </button>
        }
      />

      <div className="bg-white rounded-[32px] border border-border-theme/40 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand mb-4" />
            <p className="text-subtitle font-medium animate-pulse">{t.clients.states.loading}</p>
          </div>
        ) : companiesList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-10 h-10 text-subtitle/30" />
            </div>
            <h3 className="text-lg font-black text-title mb-1">{t.clients.states.empty_title}</h3>
            <p className="text-subtitle font-medium max-w-sm">{t.clients.states.empty_subtitle}</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={companiesList}
            footer={
              <>
                <div className="flex items-center space-x-3">
                  <div className="text-[15px] text-subtitle font-medium tracking-tight">
                    {t.clients.pagination.showing} <span className="text-title font-bold">{companiesList.length}</span> {t.clients.pagination.of} <span className="text-title font-bold">{meta.total}</span> {t.clients.pagination.clients}
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

      <CompanyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        companyToEdit={editingCompany}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["companies"] })}
      />

      <ConfirmModal
        isOpen={!!companyToDelete}
        onClose={() => setCompanyToDelete(null)}
        onConfirm={() => companyToDelete && deleteMutation.mutate(companyToDelete.id)}
        title={t.confirm_modal.delete_user_title}
        description={t.confirm_modal.delete_description}
        confirmText={t.confirm_modal.confirm_delete}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
      />
    </div>
  );
}
