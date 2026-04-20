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
import { organizationsService } from "@/services/organizations.service";
import { useToast } from "@/lib/ToastContext";
import { Loader2, AlertCircle, Users as UsersIcon, Plus, Mail, Trash2, Pencil, Calendar, ChevronLeft, ChevronRight, Building2 } from "lucide-react";

export default function MasterUsersPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["master-users"],
    queryFn: () => usersService.findAll(),
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsService.findAll(),
  });

  const existingCompanies = useMemo(() => {
    return organizations.map(org => org.name);
  }, [organizations]);

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

  const handleCreateUser = async (data: any) => {
    try {
      // Encontrar el orgId basado en el nombre de la empresa seleccionado
      const selectedOrg = organizations.find(o => o.name === data.company);
      
      await usersService.create({
        ...data,
        role: data.role.toUpperCase(),
        organization_id: selectedOrg?.id
      });
      
      showToast("Usuario creado correctamente", "success");
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      showToast("Error al crear usuario", "error");
    }
  };

  const handleToggleStatus = async () => {
    if (userToDelete) {
      try {
        await usersService.toggleStatus(userToDelete.id);
        showToast("Estado de usuario actualizado", "success");
        setUserToDelete(null);
        refetch();
      } catch (err) {
        showToast("Error al actualizar estado", "error");
      }
    }
  };

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
      cell: (item) => {
        const orgName = organizations.find(o => o.id === item.organization_id)?.name || "Sistema (Global)";
        return (
          <div className="flex items-center text-subtitle/80">
            <Building2 className="w-4 h-4 mr-2" />
            <span className="font-semibold text-[15px]">{orgName}</span>
          </div>
        );
      }
    },
    { 
      key: "status", 
      header: t.users.table.status,
      align: "center",
      cell: (item) => {
        return (
          <div className="flex items-center justify-center">
            <div className={`flex items-center space-x-2.5 font-black uppercase tracking-[0.1em] text-[12px] ${item.is_active ? 'text-emerald-500' : 'text-error/40'}`}>
              <div className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-error/40'}`} />
              <span>{item.is_active ? t.common.active : t.common.inactive}</span>
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
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(item);
            }}
            className="p-2.5 text-subtitle/40 hover:text-brand transition-colors"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setUserToDelete(item);
            }}
            className={`p-2.5 rounded-full transition-all ${item.is_active ? 'text-error/40 hover:text-error hover:bg-error/5' : 'text-brand/40 hover:text-brand hover:bg-brand/5'}`}
            title={item.is_active ? "Desactivar" : "Activar"}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-title tracking-tight">Gestión Global de Usuarios</h2>
          <p className="text-subtitle/60 font-medium">Control maestro de todos los operadores del sistema</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25"
        >
          <Plus className="w-5 h-5 stroke-[4px]" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      <FiltersBar 
        searchPlaceholder="Buscar por nombre, email o rol..."
        onSearchChange={setSearch}
        showQuickFilters={false}
      />

      <div className="flex-1 min-h-[400px]">
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">Buscando usuarios...</p>
          </div>
        ) : isError ? (
          <ModuleContainer>
            <div className="w-full flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="w-10 h-10 text-error mb-4" />
              <p className="font-bold text-title">Error al cargar usuarios globales</p>
              <button onClick={() => refetch()} className="mt-4 text-brand font-bold uppercase text-xs tracking-widest">Reintentar</button>
            </div>
          </ModuleContainer>
        ) : (
          <ModuleContainer>
            <DataTable 
              data={filteredData} 
              columns={columns} 
              keyExtractor={(item) => item.id}
              onRowClick={(item: any) => setSelectedUser(item)}
            />
          </ModuleContainer>
        )}
      </div>

      <UserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateUser} 
        existingCompanies={existingCompanies}
      />

      <UserDrawer 
        user={selectedUser as any} 
        onClose={() => setSelectedUser(null)} 
      />

      <ConfirmModal 
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleToggleStatus}
        title={userToDelete?.is_active ? "Desactivar Usuario" : "Activar Usuario"}
        description={`¿Estás seguro de que deseas ${userToDelete?.is_active ? 'desactivar' : 'activar'} a este usuario?`}
        confirmText={userToDelete?.is_active ? "Desactivar" : "Activar"}
        cancelText="Cancelar"
        variant={userToDelete?.is_active ? "danger" : "primary"}
      />
    </div>
  );
}
