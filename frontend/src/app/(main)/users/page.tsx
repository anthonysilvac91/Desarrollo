"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import UserModal from "@/components/users/UserModal";
import UserDrawer from "@/components/users/UserDrawer";
import InvitationModal from "@/components/users/InvitationModal";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { usersService, User } from "@/services/users.service";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { Loader2, AlertCircle, Users as UsersIcon, Plus, Mail, Trash2, Pencil, Calendar, ChevronLeft, ChevronRight, Building2, ToggleLeft, ToggleRight, Send, ChevronDown, X } from "lucide-react";
import { formatDate } from "@/lib/formatDate";

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

const getUserOwnerName = (item: User) =>
  item.organization?.name || item.owner?.name || "Global";

const getRoleLabel = (role: User["role"], t: any) => {
  const roleLabels: Record<User["role"], string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: t.users.modal.roles.admin,
    WORKER: t.users.modal.roles.worker,
    EXTERNAL: t.users.modal.roles.external,
  };

  return roleLabels[role] ?? role;
};

const getRoleStyle = (role: User["role"]) => {
  const roleStyles: Record<User["role"], string> = {
    SUPER_ADMIN: "bg-indigo-50 text-indigo-600 border-indigo-100",
    ADMIN: "bg-indigo-50 text-indigo-600 border-indigo-100",
    WORKER: "bg-amber-50 text-amber-600 border-amber-100",
    EXTERNAL: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return roleStyles[role] || "bg-gray-50 text-gray-600 border-gray-100";
};

const ROLE_OPTIONS: User["role"][] = ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"];

interface UserCardProps {
  item: User;
  t: any;
  onClick: () => void;
}

const UserCard = ({ item, t, onClick }: UserCardProps) => (
  <div
    onClick={onClick}
    className="bg-surface rounded-2xl border border-border-theme/40 shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
  >
    <div className="flex items-center gap-4 p-4">
      <div className={`w-16 h-16 rounded-full overflow-hidden border-2 border-app-bg shadow-sm shrink-0 bg-brand/10 text-brand flex items-center justify-center font-black text-sm ${!item.is_active ? "grayscale opacity-40" : ""}`}>
        {item.avatar_url ? (
          <img src={item.avatar_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          getInitials(item.name)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-bold text-title text-sm truncate flex-1 ${!item.is_active ? "opacity-40" : ""}`}>
            {item.name}
          </span>
          {item.is_active
            ? <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-700 border border-green-200">{t.common.active}</span>
            : <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">{t.common.inactive}</span>
          }
        </div>

        <div className={`flex items-center gap-1 mb-1 text-subtitle/60 ${!item.is_active ? "opacity-40" : ""}`}>
          <Mail className="w-3 h-3 shrink-0" />
          <span className="text-xs font-semibold truncate">{item.email}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex h-5 w-20 items-center justify-center rounded-full border text-[9px] font-black uppercase tracking-wider ${getRoleStyle(item.role)}`}>
            {getRoleLabel(item.role, t)}
          </span>
        </div>
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center text-brand">
        <ChevronRight className="w-5 h-5 shrink-0" />
      </div>
    </div>
  </div>
);

export default function UsersPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [resetKey, setResetKey] = useState(0);
  const [activeSortKey, setActiveSortKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [roleFilter, setRoleFilter] = useState<User["role"] | null>(null);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const mobileRoleDropdownRef = useRef<HTMLDivElement>(null);
  const desktopRoleDropdownRef = useRef<HTMLDivElement>(null);

  const queryParams = {
    page,
    limit,
    search: debouncedSearch,
    isActive: statusFilter === "active" ? "true" : statusFilter === "inactive" ? "false" : undefined,
    role: roleFilter ?? undefined,
  };

  const { data: responseData, isLoading, isError, refetch } = useQuery({
    queryKey: ["users", user?.id, user?.role, user?.organization_id, queryParams],
    queryFn: () => usersService.findAll(queryParams),
    enabled: !!user,
  });

  const usersList = useMemo(() => {
    return Array.isArray(responseData) ? responseData : responseData?.data || [];
  }, [responseData]);

  const meta = useMemo(() => {
    return !Array.isArray(responseData) && responseData?.meta
      ? responseData.meta
      : { total: usersList.length, page: 1, limit: 10, totalPages: 1 };
  }, [responseData, usersList.length]);

  const existingOwners = useMemo(() => {
    return Array.from(new Set<string>(usersList.map(() => "Recall Co"))).sort();
  }, [usersList]);

  const visibleRoleOptions = useMemo(() => {
    return user?.role === "SUPER_ADMIN"
      ? ROLE_OPTIONS
      : ROLE_OPTIONS.filter(role => role !== "SUPER_ADMIN");
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN" && roleFilter === "SUPER_ADMIN") {
      setRoleFilter(null);
      setPage(1);
    }
  }, [roleFilter, user?.role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideMobile = mobileRoleDropdownRef.current?.contains(target);
      const clickedInsideDesktop = desktopRoleDropdownRef.current?.contains(target);

      if (!clickedInsideMobile && !clickedInsideDesktop) {
        setIsRoleDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // .slice(0,10) was removed since backend paginates
  const displayData = usersList;

  const ownUserStatusMessage = "No puedes desactivar tu propio usuario";

  const getServerErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof error.response === "object" &&
      error.response !== null &&
      "data" in error.response &&
      typeof error.response.data === "object" &&
      error.response.data !== null &&
      "message" in error.response.data
    ) {
      const message = error.response.data.message;
      return Array.isArray(message) ? message[0] : String(message);
    }

    return fallback;
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    if (userToDelete.id === user?.id) {
      showToast(ownUserStatusMessage, "error");
      setUserToDelete(null);
      return;
    }
    
    try {
      // Si el usuario ya está inactivo, el toggle lo activaría.
      // En un sistema sin DELETE físico, "Eliminar" debe asegurar la desactivación.
      if (userToDelete.is_active) {
        await usersService.toggleStatus(userToDelete.id);
        showToast(t.users.states.delete_success, "success");
      } else {
        // Si ya está inactivo, informamos que ya ha sido "eliminado" lógicamente
        showToast("El usuario ya se encuentra desactivado", "info");
      }
      refetch();
    } catch (err) {
      showToast(getServerErrorMessage(err, t.users.states.error_delete), "error");
    } finally {
      setUserToDelete(null);
    }
  };

  const handleToggleStatus = async (targetUser: User) => {
    if (targetUser.id === user?.id && targetUser.is_active) {
      showToast(ownUserStatusMessage, "error");
      return;
    }

    try {
      await usersService.toggleStatus(targetUser.id);
      showToast(targetUser.is_active ? "Usuario desactivado" : "Usuario activado", "success");
      refetch();
    } catch (err) {
      showToast(getServerErrorMessage(err, "Error al cambiar estado"), "error");
    }
  };



  const columns: ColumnDef<User>[] = [
    {
      key: "name",
      header: t.users.table.name,
      sortable: true,
      sortValue: (item) => item.name,
      cell: (item) => (
        <div className="flex items-center space-x-4">
          <div className={`w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand shrink-0 font-black text-xs border border-brand/5 overflow-hidden ${!item.is_active ? 'grayscale opacity-40' : ''}`}>
            {item.avatar_url ? (
              <img src={item.avatar_url} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              item.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex flex-col">
            <span className={`font-bold text-title text-sm tracking-tight ${!item.is_active ? 'opacity-40' : ''}`}>{item.name}</span>
            <div className={`flex items-center space-x-1 text-subtitle/40 ${!item.is_active ? 'opacity-40' : ''}`}>
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
      sortable: true,
      sortValue: (item) => item.role,
      cell: (item) => {
        return (
          <div className={`inline-flex justify-center w-28 py-1.5 rounded-xl border text-[13px] font-black uppercase tracking-wider ${getRoleStyle(item.role)}`}>
            {getRoleLabel(item.role, t)}
          </div>
        );
      }
    },
    {
      key: "owner",
      header: t.users.table.owner,
      sortable: true,
      sortValue: (item) => item.organization?.name || item.owner?.name || "",
      cell: (item) => (
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-theme/40 bg-app-bg text-[11px] font-black text-subtitle/70 uppercase tracking-wider ${!item.is_active ? 'opacity-40' : ''}`}>
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-25">{getUserOwnerName(item)}</span>
        </div>
      )
    },
    {
      key: "status",
      header: t.users.table.status,
      align: "center",
      sortable: true,
      sortValue: (item) => (item.is_active ? 1 : 0),
      cell: (item) => item.is_active
        ? <span className="inline-flex justify-center w-20 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-green-100 text-green-700 border-green-200">{t.common.active}</span>
        : <span className="inline-flex justify-center w-20 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-red-100 text-red-700 border-red-200">{t.common.inactive}</span>
    },
    {
      key: "last_access",
      header: t.users.table.last_access,
      align: "center",
      sortable: true,
      sortValue: (item) => item.last_login_at || "",
      cell: (item) => (
        <div className="flex items-center justify-center text-subtitle/70">
          <Calendar className="w-4 h-4 mr-2 text-brand" />
          <span className="font-semibold text-sm">
            {item.last_login_at ? formatDate(item.last_login_at) : "---"}
          </span>
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
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
            className={`p-2.5 transition-all rounded-full ${item.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-subtitle/20 hover:text-subtitle/40 hover:bg-gray-50'}`}
            title={item.is_active ? "Desactivar" : "Activar"}
          >
            {item.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditingUser(item); setIsModalOpen(true); }}
            className="p-2.5 text-subtitle/40 hover:text-brand transition-colors"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setUserToDelete(item);
            }}
            className="p-2.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
            title="Eliminar usuario"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  const hasUserFilters = statusFilter !== "active" || !!roleFilter || !!activeSortKey;

  const clearUserFilters = () => {
    setResetKey(k => k + 1);
    setActiveSortKey(null);
    setStatusFilter("active");
    setRoleFilter(null);
    setPage(1);
  };

  const renderUserFilters = (dropdownRef: React.RefObject<HTMLDivElement | null>) => (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-app-bg rounded-full px-1 border border-border-theme/30 shrink-0">
        {(["all", "active", "inactive"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
            className={`px-3 py-2 rounded-full border text-xs font-bold transition-all ${
              statusFilter === s
                ? "bg-brand/10 border-brand/20 text-brand shadow-sm"
                : "border-transparent text-subtitle/50"
            }`}
          >
            {s === "all" ? t.common.all : s === "active" ? t.common.active : t.common.inactive}
          </button>
        ))}
      </div>

      <div ref={dropdownRef} className="relative flex-1 min-w-0">
        {roleFilter ? (
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full pl-1 pr-3 py-1 max-w-full">
            <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0">
              <span className="text-[10px] font-black text-white">
                {getRoleLabel(roleFilter, t).slice(0, 1)}
              </span>
            </div>
            <span className="text-sm font-bold text-brand truncate min-w-0">
              {getRoleLabel(roleFilter, t)}
            </span>
            <button
              onClick={() => {
                setRoleFilter(null);
                setPage(1);
              }}
              className="text-brand/50 hover:text-brand transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsRoleDropdownOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-theme/50 bg-surface text-subtitle/60 text-sm font-semibold transition-colors hover:border-brand/30 w-full justify-between"
          >
            <span>{t.users.table.role}</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}

        {isRoleDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-20 w-full overflow-hidden">
            <div className="max-h-60 overflow-y-auto py-1">
              {visibleRoleOptions.map(role => (
                <button
                  key={role}
                  onClick={() => {
                    setRoleFilter(role);
                    setIsRoleDropdownOpen(false);
                    setPage(1);
                  }}
                  className="w-full flex items-center px-4 py-3 hover:bg-app-bg transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-title">
                    {getRoleLabel(role, t)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const pagination = (
    <>
      <div className="flex items-center space-x-3">
        <div className="text-[15px] text-subtitle font-medium">
          {t.users.pagination.showing} <span className="text-title font-bold">{displayData.length}</span> {t.users.pagination.of} <span className="text-title font-bold">{meta.total}</span> {t.users.pagination.users}
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
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-lg shadow-brand/20">{page}</button>
        <button 
          onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
          disabled={page >= meta.totalPages}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 translate-x-1"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div>
      <div className="lg:hidden flex flex-col space-y-4">
        <h1 className="text-2xl font-black text-title tracking-tight text-center">{t.topbar.titles.users}</h1>
        <FiltersBar
          searchPlaceholder={t.users.search_placeholder}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          showQuickFilters={false}
          showClearAll={false}
          hasExternalFilter={hasUserFilters}
          onClearAll={clearUserFilters}
        />

        {renderUserFilters(mobileRoleDropdownRef)}

        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="w-full flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
              <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.users.states.loading}</p>
            </div>
          ) : isError ? (
            <div className="w-full flex flex-col items-center justify-center py-20 space-y-4">
              <div className="p-4 bg-error/10 rounded-full">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <div className="text-center">
                <p className="font-black text-title text-xl tracking-tight">{t.users.states.error_title}</p>
                <p className="text-subtitle font-medium text-sm">{t.users.states.error_subtitle}</p>
              </div>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-app-bg border border-border-theme/40 rounded-xl text-subtitle font-bold text-sm hover:bg-border-theme/10 transition-all"
              >
                {t.common.retry}
              </button>
            </div>
          ) : usersList.length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center py-20 space-y-5 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/8 text-brand/40 ring-8 ring-brand/5">
                <UsersIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight text-title">{t.users.states.empty_title}</h3>
                <p className="text-sm font-medium leading-relaxed text-subtitle/60 max-w-xs mx-auto">
                  {t.users.states.empty_subtitle}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {usersList.map((item: User) => (
                <UserCard
                  key={item.id}
                  item={item}
                  t={t}
                  onClick={() => setSelectedUser(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-col space-y-8">
      <FiltersBar
        searchPlaceholder={t.users.search_placeholder}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        showQuickFilters={false}
        hasExternalFilter={hasUserFilters}
        onClearAll={clearUserFilters}
        actions={
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center space-x-2 border-2 border-brand text-brand px-6 py-3.5 rounded-full text-base font-black transition-all hover:bg-brand/5 active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>{t.invitations.modal.invite_button}</span>
            </button>
            <button
              onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
              className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25"
            >
              <Plus className="w-5 h-5 stroke-[4px]" />
              <span>{t.users.add_new}</span>
            </button>
          </div>
        }
      />

      {renderUserFilters(desktopRoleDropdownRef)}

      <div className="flex-1 min-h-100">
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.users.states.loading}</p>
          </div>
        ) : isError ? (
          <ModuleContainer>
            <div className="w-full flex flex-col items-center justify-center py-20 space-y-4">
              <div className="p-4 bg-error/10 rounded-full">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <div className="text-center">
                <p className="font-black text-title text-xl tracking-tight">{t.users.states.error_title}</p>
                <p className="text-subtitle font-medium">{t.users.states.error_subtitle}</p>
              </div>
              <button 
                onClick={() => refetch()}
                className="px-6 py-2 bg-app-bg border border-border-theme/40 rounded-xl text-subtitle font-bold text-sm hover:bg-border-theme/10 transition-all"
              >
                {t.common.retry}
              </button>
            </div>
          </ModuleContainer>
        ) : usersList.length === 0 ? (
          <ModuleContainer>
            <div className="w-full flex flex-col items-center justify-center py-24 space-y-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/8 text-brand/40 ring-8 ring-brand/5">
                <UsersIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight text-title">{t.users.states.empty_title}</h3>
                <p className="text-sm font-medium leading-relaxed text-subtitle/60 max-w-xs mx-auto">
                  {t.users.states.empty_subtitle}
                </p>
              </div>
            </div>
          </ModuleContainer>
        ) : (
          <ModuleContainer>
            <DataTable
              data={displayData}
              columns={columns}
              keyExtractor={(item) => item.id}
              footer={pagination}
              onRowClick={(item) => setSelectedUser(item)}
              onSortChange={setActiveSortKey}
              resetSortTrigger={resetKey}
            />
          </ModuleContainer>
        )}
      </div>

      </div>

      <UserDrawer
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
      />

      <UserModal
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingUser(null); }} 
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingUser(null);
          refetch();
        }}
        existingOwners={existingOwners}
        userToEdit={editingUser}
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

      <InvitationModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <button
        onClick={() => {
          setEditingUser(null);
          setIsModalOpen(true);
        }}
        className="fixed bottom-24 right-6 lg:hidden z-20 w-14 h-14 bg-brand text-white rounded-full shadow-xl shadow-brand/30 flex items-center justify-center active:scale-95 transition-all"
        aria-label={t.users.add_new}
      >
        <Plus className="w-6 h-6 stroke-[3px]" />
      </button>
    </div>
  );
}
