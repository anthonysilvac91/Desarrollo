"use client";

import React, { useState, useMemo } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import UserModal from "@/components/users/UserModal";
import UserDrawer from "@/components/users/UserDrawer";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { usersService, User } from "@/services/users.service";
import { useToast } from "@/lib/ToastContext";
import { Loader2, AlertCircle, Users as UsersIcon, Plus, Mail, Shield, Trash2, Pencil, Calendar, ChevronLeft, ChevronRight, Building2 } from "lucide-react";

export default function UsersPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersService.findAll(),
  });

  // Extract unique companies for the modal dropdown (Fallback a string vacío si no hay datos)
  const existingCompanies = useMemo(() => {
    return Array.from(new Set(users.map(() => "Recall Co"))).sort(); // Provisional hasta tener datos reales de compañía
  }, [users]);

  // Filter logic
  const filteredData = useMemo(() => {
    return users.filter((item) => {
      const searchLower = search.toLowerCase();
      return search === "" || (
        item.name.toLowerCase().includes(searchLower) ||
        item.role.toLowerCase().includes(searchLower) ||
        item.email.toLowerCase().includes(searchLower)
      );
    });
  }, [search, users]);

  const handleAddUser = async () => {
    try {
      // Por ahora simulamos la invitación exitosa
      showToast("Invitación enviada con éxito!", "success");
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      showToast("Error al procesar la solicitud", "error");
    }
  };

  const handleDeleteRequest = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (userToDelete) {
      try {
        showToast("Usuario eliminado con éxito", "success");
        setUserToDelete(null);
        refetch();
      } catch (err) {
        showToast("Error al eliminar usuario", "error");
      }
    }
  };

  const displayData = filteredData.slice(0, 10);

  const columns: ColumnDef<User>[] = [
    { 
      key: "name", 
      header: t.users.table.name,
      cell: (item) => (
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand flex-shrink-0 font-black text-xs border border-brand/5">
            {item.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-title text-[17px] tracking-tight">{item.name}</span>
            <div className="flex items-center space-x-1 text-subtitle/40">
              <Mail className="w-3 h-3" />
              <span className="text-xs font-semibold tracking-tight">{item.email}</span>
            </div>
          </div>
        </div>
      )
    },
    { 
      key: "role", 
      header: t.users.table.role,
      cell: (item) => {
        const roleStyles: Record<string, string> = {
          SUPER_ADMIN: "bg-indigo-50 text-indigo-600 border-indigo-100",
          ADMIN: "bg-indigo-50 text-indigo-600 border-indigo-100",
          WORKER: "bg-amber-50 text-amber-600 border-amber-100",
          CLIENT: "bg-slate-100 text-slate-600 border-slate-200",
        };
        const currentStyle = roleStyles[item.role] || "bg-gray-50 text-gray-600 border-gray-100";
        
        return (
          <div className={`px-3 py-1.5 rounded-xl border text-[13px] font-black uppercase tracking-wider w-fit ${currentStyle}`}>
            {item.role}
          </div>
        );
      }
    },
    { 
      key: "company", 
      header: t.users.table.company,
      cell: () => (
        <div className="flex items-center text-subtitle/80">
          <Building2 className="w-4 h-4 mr-2" />
          <span className="font-semibold text-[15px]">Recall Organization</span>
        </div>
      )
    },
    { 
      key: "status", 
      header: t.users.table.status,
      align: "center",
      cell: () => {
        return (
          <div className="flex items-center justify-center">
            <div className={`flex items-center space-x-2.5 font-black uppercase tracking-[0.1em] text-[12px] text-emerald-500`}>
              <div className={`w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
              <span>{t.common.active}</span>
            </div>
          </div>
        );
      }
    },
    { 
      key: "last_access", 
      header: t.users.table.last_access,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center text-subtitle/70">
          <Calendar className="w-4 h-4 mr-2 text-brand" />
          <span className="font-semibold text-[15px]">{item.created_at.slice(0, 10)}</span>
        </div>
      )
    },
    {
      key: "actions",
      header: t.users.table.actions,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center space-x-3">
          <button className="p-2.5 text-subtitle/40 hover:text-brand transition-colors">
            <Pencil className="w-5 h-5" />
          </button>
          <button 
            onClick={(e) => handleDeleteRequest(e, item)}
            className="p-2.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
            title="Eliminar usuario"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  const pagination = (
    <>
      <div className="text-[15px] text-subtitle font-medium">
        {t.users.pagination.showing} <span className="text-title font-bold">{displayData.length}</span> {t.users.pagination.of} <span className="text-title font-bold">{filteredData.length}</span> {t.users.pagination.users}
      </div>
      <div className="flex items-center space-x-2">
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20" disabled>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-lg shadow-brand/20">1</button>
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 translate-x-1" disabled>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col space-y-8">
      <FiltersBar 
        searchPlaceholder={t.users.search_placeholder}
        onSearchChange={setSearch}
        showQuickFilters={false}
        actions={
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25"
          >
            <Plus className="w-5 h-5 stroke-[4px]" />
            <span>{t.users.add_new}</span>
          </button>
        }
      />

      <div className="flex-1 min-h-[400px]">
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">Conectando con la organización...</p>
          </div>
        ) : isError ? (
          <ModuleContainer>
            <div className="w-full flex flex-col items-center justify-center py-20 space-y-4">
              <div className="p-4 bg-error/10 rounded-full">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <div className="text-center">
                <p className="font-black text-title text-xl tracking-tight">Error al cargar equipo</p>
                <p className="text-subtitle font-medium">No pudimos sincronizar la lista de usuarios</p>
              </div>
              <button 
                onClick={() => refetch()}
                className="px-6 py-2 bg-app-bg border border-border-theme/40 rounded-xl text-subtitle font-bold text-sm hover:bg-border-theme/10 transition-all"
              >
                Reintentar
              </button>
            </div>
          </ModuleContainer>
        ) : filteredData.length === 0 ? (
          <ModuleContainer>
            <div className="w-full flex flex-col items-center justify-center py-24 space-y-6 text-center">
              <div className="p-6 bg-app-bg/50 rounded-full">
                <UsersIcon className="w-12 h-12 text-subtitle/20" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-title tracking-tight">Directorio vacío</h3>
                <p className="text-subtitle font-medium max-w-xs mx-auto text-sm leading-relaxed">
                  No se encontraron resultados. Empieza invitando a nuevos miembros a tu equipo de trabajo.
                </p>
              </div>
            </div>
          </ModuleContainer>
        ) : (
          <ModuleContainer>
            <DataTable 
              data={filteredData} 
              columns={columns} 
              keyExtractor={(item) => item.id}
              footer={pagination}
              onRowClick={(item: any) => setSelectedUser(item)}
            />
          </ModuleContainer>
        )}
      </div>

      <UserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleAddUser} 
        existingCompanies={existingCompanies}
      />

      <UserDrawer 
        user={selectedUser as any} 
        onClose={() => setSelectedUser(null)} 
      />

      <ConfirmModal 
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t.confirm_modal.delete_user_title}
        description={t.confirm_modal.delete_description}
        confirmText={t.confirm_modal.confirm_delete}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
      />
    </div>
  );
}
