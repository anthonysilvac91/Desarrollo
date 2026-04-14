"use client";

import React, { useState, useMemo } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import { Plus, Calendar, Pencil, Trash2, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import UserModal, { UserFormData } from "@/components/users/UserModal";
import UserDrawer from "@/components/users/UserDrawer";

// Helper to format Date to dd-mm-yyyy
const formatDateToString = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Types for User Display
interface UserDisplay {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  status: "Active" | "Inactive";
  last_access: string;
}

// Initial Mock Data
const INITIAL_USERS: UserDisplay[] = [
  { 
    id: "u1", 
    name: "Alex Thompson", 
    email: "alex@vjyachts.com",
    role: "Admin", 
    company: "V&J Yacht Services", 
    status: "Active",
    last_access: formatDateToString(new Date())
  },
  { 
    id: "u2", 
    name: "Juan Pérez", 
    email: "juan.perez@expert-marine.com",
    role: "Operator", 
    company: "Expert Marine", 
    status: "Active",
    last_access: formatDateToString(new Date(Date.now() - 24 * 60 * 60 * 1000))
  },
  { 
    id: "u3", 
    name: "Roberto García", 
    email: "roberto@garcia-yachts.es",
    role: "Client", 
    company: "Private", 
    status: "Active",
    last_access: "12-03-2024"
  },
  { 
    id: "u4", 
    name: "Maria Silva", 
    email: "msilva@cleaning-pros.com",
    role: "Operator", 
    company: "Cleaning Pros", 
    status: "Inactive",
    last_access: "05-02-2024"
  },
  { 
    id: "u5", 
    name: "Thomas Müller", 
    email: "t.muller@vjyachts.com",
    role: "Admin", 
    company: "V&J Yacht Services", 
    status: "Active",
    last_access: formatDateToString(new Date())
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserDisplay[]>(INITIAL_USERS);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDisplay | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserDisplay | null>(null);
  const { t } = useLanguage();

  // Extract unique companies for the modal dropdown
  const existingCompanies = useMemo(() => {
    return Array.from(new Set(users.map(u => u.company))).sort();
  }, [users]);

  // Filter logic
  const filteredData = useMemo(() => {
    return users.filter((item) => {
      const searchLower = search.toLowerCase();
      return search === "" || (
        item.name.toLowerCase().includes(searchLower) ||
        item.role.toLowerCase().includes(searchLower) ||
        item.company.toLowerCase().includes(searchLower) ||
        item.email.toLowerCase().includes(searchLower)
      );
    });
  }, [search, users]);

  const handleAddUser = (data: UserFormData) => {
    const newUser: UserDisplay = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name,
      email: data.email,
      role: data.role,
      company: data.company,
      status: "Active",
      last_access: "Sin acceso",
    };
    setUsers(prev => [newUser, ...prev]);
  };

  const handleDeleteRequest = (e: React.MouseEvent, user: UserDisplay) => {
    e.stopPropagation();
    setUserToDelete(user);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null);
    }
  };

  const displayData = filteredData.slice(0, 5);

  const columns: ColumnDef<UserDisplay>[] = [
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
            <span className="text-xs font-semibold text-subtitle/40 tracking-tight">{item.email}</span>
          </div>
        </div>
      )
    },
    { 
      key: "role", 
      header: t.users.table.role,
      cell: (item) => {
        const roleStyles = {
          Admin: "bg-indigo-50 text-indigo-600 border-indigo-100",
          Operator: "bg-blue-50 text-blue-600 border-blue-100",
          Client: "bg-slate-100 text-slate-600 border-slate-200",
        };
        const currentStyle = roleStyles[item.role as keyof typeof roleStyles] || "bg-gray-50 text-gray-600 border-gray-100";
        
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
      cell: (item) => (
        <div className="flex items-center text-subtitle/80">
          <Building2 className="w-4 h-4 mr-2" />
          <span className="font-semibold text-[15px]">{item.company}</span>
        </div>
      )
    },
    { 
      key: "status", 
      header: t.users.table.status,
      align: "center",
      cell: (item) => {
        const isActive = item.status === "Active";
        const statusLabel = isActive ? t.common.active : t.common.inactive;
        return (
          <div className="flex items-center justify-center">
            <div className={`flex items-center space-x-2.5 font-black uppercase tracking-[0.1em] text-[12px] ${isActive ? "text-emerald-500" : "text-rose-500"}`}>
              <div className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500"}`} />
              <span>{statusLabel}</span>
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
          <span className="font-semibold text-[15px]">{item.last_access}</span>
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
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20">
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

      <div className="flex-1">
        <ModuleContainer>
          <DataTable 
            data={displayData} 
            columns={columns} 
            keyExtractor={(item) => item.id}
            footer={pagination}
            onRowClick={(item) => setSelectedUser(item)}
          />
        </ModuleContainer>
      </div>

      <UserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleAddUser} 
        existingCompanies={existingCompanies}
      />

      <UserDrawer 
        user={selectedUser} 
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
