"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, Building2, Trash2, Edit2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { customersService, Customer } from "@/services/customers.service";
import CustomerModal from "@/components/customers/CustomerModal";
import DataTable from "@/components/ui/DataTable";
import DeleteConfirmModal from "@/components/ui/DeleteConfirmModal";
import useDebounce from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function CustomersPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const getQueryParams = () => {
    const params: any = { page, limit };
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  };

  const { data: responseData, isLoading } = useQuery({
    queryKey: ["customers", getQueryParams()],
    queryFn: () => customersService.findAll(getQueryParams()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      showToast("Empresa eliminada", "success");
      setCustomerToDelete(null);
    },
    onError: () => {
      showToast("Error al eliminar", "error");
    }
  });

  // Efecto para volver a la página 1 al buscar
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const customersList: Customer[] = Array.isArray(responseData) ? responseData : responseData?.data || [];
  const meta = !Array.isArray(responseData) && responseData?.meta ? responseData.meta : { total: customersList.length, page: 1, limit: 10, totalPages: 1 };

  const columns = [
    {
      header: "EMPRESA",
      accessor: "name" as keyof Customer,
      cell: (item: Customer) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/5 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-brand" />
          </div>
          <div>
            <div className="font-bold text-sm text-title">{item.name}</div>
            <div className="text-xs text-subtitle font-medium">Registrado: {new Date(item.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      )
    },
    {
      header: "ESTADO",
      accessor: "is_active" as keyof Customer,
      cell: (item: Customer) => (
        <div className="flex items-center space-x-2">
          {item.is_active ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="text-[13px] font-bold text-emerald-600/80 uppercase tracking-widest">Activo</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
              <span className="text-[13px] font-bold text-red-600/80 uppercase tracking-widest">Inactivo</span>
            </>
          )}
        </div>
      )
    },
    {
      header: "ACCIONES",
      accessor: "id" as keyof Customer,
      cell: (item: Customer) => (
        <div className="flex justify-end space-x-2">
          <button 
            onClick={() => {
              setEditingCustomer(item);
              setIsModalOpen(true);
            }}
            className="p-2 hover:bg-brand/5 text-subtitle hover:text-brand rounded-xl transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setCustomerToDelete(item)}
            className="p-2 hover:bg-error/5 text-subtitle hover:text-error rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-title tracking-tight">Empresas (Clientes)</h1>
          <p className="text-subtitle font-medium mt-1">
            Administra a las empresas a las que brindas servicios
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingCustomer(null);
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 bg-brand text-white px-6 py-3.5 rounded-[20px] font-bold shadow-xl shadow-brand/20 hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Empresa</span>
        </button>
      </header>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-subtitle/50" />
          <input 
            type="text" 
            placeholder="Buscar empresa por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-border-theme/60 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-title placeholder:text-subtitle/40 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/30 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-[32px] border border-border-theme/40 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand mb-4" />
            <p className="text-subtitle font-medium animate-pulse">Cargando empresas...</p>
          </div>
        ) : customersList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-10 h-10 text-subtitle/30" />
            </div>
            <h3 className="text-lg font-black text-title mb-1">No hay empresas registradas</h3>
            <p className="text-subtitle font-medium max-w-sm">
              Crea tu primera empresa para empezar a asignarle usuarios y activos.
            </p>
          </div>
        ) : (
          <>
            <DataTable 
              columns={columns} 
              data={customersList}
              onRowClick={(item) => {
                setEditingCustomer(item);
                setIsModalOpen(true);
              }}
            />
            {/* Pagination UI */}
            {meta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <span className="text-xs font-bold text-subtitle">
                  Mostrando {(meta.page - 1) * meta.limit + 1} - {Math.min(meta.page * meta.limit, meta.total)} de {meta.total}
                </span>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-md hover:bg-white border border-transparent hover:border-gray-200 text-subtitle transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="px-4 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-black text-brand shadow-sm">
                    {page}
                  </div>
                  <button 
                    onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                    disabled={page >= meta.totalPages}
                    className="p-2 rounded-md hover:bg-white border border-transparent hover:border-gray-200 text-subtitle transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CustomerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customerToEdit={editingCustomer}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
      />

      <DeleteConfirmModal
        isOpen={!!customerToDelete}
        onClose={() => setCustomerToDelete(null)}
        onConfirm={() => customerToDelete && deleteMutation.mutate(customerToDelete.id)}
        title="Eliminar Empresa"
        message={`¿Estás seguro de que deseas eliminar la empresa "${customerToDelete?.name}"? Sus usuarios y activos asociados quedarán huérfanos.`}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
