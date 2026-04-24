"use client";

import React, { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersService } from "@/services/users.service";
import DataTable, { Column } from "@/components/ui/DataTable";
import FiltersBar from "@/components/ui/FiltersBar";
import { Plus, Search, MoreHorizontal, User, Mail, Phone, Trash2, Edit2, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import ClientModal from "@/components/clients/ClientModal";
import { useToast } from "@/lib/ToastContext";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function ClientsPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  // Fetch clients only (Role CLIENT)
  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["clients"],
    queryFn: () => usersService.findAll("CLIENT"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      showToast(t.clients.states.delete_success, "success");
    },
    onError: () => showToast(t.feedback.generic_error, "error"),
  });

  const filteredData = clients.filter((client) => {
    const searchLower = search.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      (client.email || "").toLowerCase().includes(searchLower) ||
      (client.phone || "").toLowerCase().includes(searchLower)
    );
  });

  const displayData = filteredData.slice(0, 10);

  const pagination = (
    <>
      <div className="text-[15px] text-subtitle font-medium tracking-tight">
        {t.clients.pagination.showing} <span className="text-title font-bold">{displayData.length}</span> {t.clients.pagination.of} <span className="text-title font-bold">{filteredData.length}</span> {t.clients.pagination.clients}
      </div>
      <div className="flex items-center space-x-2">
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center" disabled>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-md shadow-brand/20">1</button>
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  const columns: Column[] = [
    { 
      key: "name", 
      header: t.clients.table.name,
      cell: (item) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/5 flex items-center justify-center text-brand font-black text-sm">
            {item.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-bold text-title text-[15px]">{item.name}</span>
        </div>
      )
    },
    { 
      key: "address", 
      header: t.clients.modal.address,
      cell: (item) => (
        <div className="flex items-center space-x-2 text-subtitle/60">
          <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-subtitle/40" />
          </div>
          <span className="text-[14px] font-medium">{item.address || "---"}</span>
        </div>
      )
    },
    { 
      key: "status", 
      header: t.clients.table.status,
      cell: (item) => (
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <span className="text-[13px] font-bold text-emerald-600/80 uppercase tracking-widest">{t.common.active}</span>
        </div>
      )
    },
    { 
      key: "actions", 
      header: t.clients.table.actions,
      cell: (item) => (
        <div className="flex items-center justify-end space-x-2">
          <button 
            onClick={() => {
              setSelectedClient(item);
              setIsModalOpen(true);
            }}
            className="p-2.5 rounded-xl hover:bg-brand/5 text-subtitle/40 hover:text-brand transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              setClientToDelete(item.id);
              setIsDeleteModalOpen(true);
            }}
            className="p-2.5 rounded-xl hover:bg-rose-50 text-subtitle/40 hover:text-rose-500 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  if (error) return <div>Error loading clients</div>;

  return (
    <div className="flex flex-col space-y-6 h-full">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <FiltersBar 
          searchPlaceholder={t.clients.search_placeholder}
          searchValue={search}
          onSearchChange={setSearch}
        />
        
        <button 
          onClick={() => {
            setSelectedClient(null);
            setIsModalOpen(true);
          }}
          className="bg-brand text-white px-6 py-4 rounded-[22px] font-black text-sm shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>{t.clients.add_new}</span>
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <DataTable 
          columns={columns} 
          data={displayData} 
          isLoading={isLoading}
          keyExtractor={(item) => item.id}
          footer={pagination}
          emptyState={{
            title: t.clients.states.empty_title,
            subtitle: t.clients.states.empty_subtitle
          }}
        />
      </div>



      {/* Modals */}
      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["clients"] })}
        client={selectedClient}
      />

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => clientToDelete && deleteMutation.mutate(clientToDelete)}
        title={t.confirm_modal.delete_user_title}
        description={t.confirm_modal.delete_description}
      />
    </div>
  );
}
