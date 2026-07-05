"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import ConfirmModal from "@/components/ui/ConfirmModal";
import KPICard from "@/components/dashboard/KPICard";
import FilterDropdown from "@/components/ui/FilterDropdown";
import UserModal from "@/components/users/UserModal";
import UserDrawer from "@/components/users/UserDrawer";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usersService, User } from "@/services/users.service";
import { authService } from "@/services/auth.service";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { Loader2, AlertCircle, Users as UsersIcon, Plus, Mail, Trash2, Pencil, Calendar, ChevronLeft, ChevronRight, Building2, ToggleLeft, ToggleRight, ChevronDown, X, ShieldCheck, ShieldUser, HardHat } from "lucide-react";
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

const getRoleCircleStyle = (role: User["role"]) => {
  const styles: Record<User["role"], string> = {
    SUPER_ADMIN: "bg-indigo-50 text-indigo-600",
    ADMIN:       "bg-indigo-50 text-indigo-600",
    WORKER:      "bg-amber-50 text-amber-600",
    EXTERNAL:    "bg-slate-100 text-slate-600",
  };
  return styles[role] ?? "bg-gray-50 text-gray-600";
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
          <img src={item.avatar_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [resetKey, setResetKey] = useState(0);
  const [activeSortKey, setActiveSortKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<User["role"] | null>(null);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

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

  const { data: userStats, refetch: refetchUserStats } = useQuery({
    queryKey: ["users-stats", user?.id, user?.role, user?.organization_id],
    queryFn: () => usersService.getStats(),
    enabled: !!user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN"),
  });

  const usersList = useMemo(() => {
    return Array.isArray(responseData) ? responseData : responseData?.data || [];
  }, [responseData]);

  const meta = useMemo(() => {
    return !Array.isArray(responseData) && responseData?.meta
      ? responseData.meta
      : { total: usersList.length, page: 1, limit: 10, totalPages: 1 };
  }, [responseData, usersList.length]);

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
      await usersService.delete(userToDelete.id);
      showToast(t.users.states.delete_success, "success");
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      refetch();
      refetchUserStats();
    } catch (err) {
      showToast(getServerErrorMessage(err, t.users.states.error_delete), "error");
    } finally {
      setUserToDelete(null);
    }
  };

  const handleConfirmPasswordReset = async () => {
    if (!userToResetPassword) return;

    try {
      await authService.forgotPassword(userToResetPassword.email);
      showToast(t.confirm_modal.reset_password_sent, "success");
    } catch (err) {
      showToast(getServerErrorMessage(err, t.confirm_modal.reset_password_error), "error");
    } finally {
      setUserToResetPassword(null);
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
      refetchUserStats();
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
        <div className="flex items-center space-x-3">
          <div className={`rounded-full bg-brand/10 flex items-center justify-center text-brand shrink-0 font-black text-xs border-2 border-surface shadow-sm overflow-hidden ${!item.is_active ? 'grayscale opacity-40' : ''}`} style={{ width: 52, height: 52 }}>
            {item.avatar_url ? (
              <img src={item.avatar_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              item.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex flex-col">
            <span className={`font-bold text-title text-xs ${!item.is_active ? 'opacity-40' : ''}`}>{item.name}</span>
          </div>
        </div>
      )
    },
    {
      key: "email",
      header: t.users.table.email,
      sortable: true,
      sortValue: (item) => item.email,
      cell: (item) => (
        <div className={`flex items-center text-subtitle/70 ${!item.is_active ? 'opacity-40' : ''}`}>
          <Mail className="w-3.5 h-3.5 mr-1.5 text-brand shrink-0" />
          <span className="text-xs font-semibold truncate max-w-56">{item.email}</span>
        </div>
      )
    },
    {
      key: "role",
      header: t.users.table.role,
      align: "center",
      sortable: true,
      sortValue: (item) => item.role,
      cell: (item) => {
        return (
          <div className={`inline-flex justify-center w-24 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${getRoleStyle(item.role)}`}>
            {getRoleLabel(item.role, t)}
          </div>
        );
      }
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
          <Calendar className="w-3.5 h-3.5 mr-1.5 text-brand" />
          <span className="font-semibold text-xs">
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
        <div className="flex items-center justify-center space-x-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
            className={`p-1.5 transition-all rounded-full ${item.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-subtitle/20 hover:text-subtitle/40 hover:bg-gray-50'}`}
            title={item.is_active ? "Desactivar" : "Activar"}
          >
            {item.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditingUser(item); setIsModalOpen(true); }}
            className="p-1.5 text-subtitle/40 hover:text-brand transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setUserToDelete(item);
            }}
            className="p-1.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
            title="Eliminar usuario"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const hasUserFilters = statusFilter !== "all" || !!roleFilter || !!activeSortKey;

  const clearUserFilters = () => {
    setResetKey(k => k + 1);
    setActiveSortKey(null);
    setStatusFilter("all");
    setRoleFilter(null);
    setPage(1);
  };


  const pagination = (
    <>
      <div className="flex items-center space-x-3">
        <div className="text-xs text-subtitle/40 font-medium tracking-tight">
          {t.users.pagination.showing}{" "}
          <span className="text-subtitle/70 font-bold">{displayData.length}</span>{" "}
          {t.users.pagination.of}{" "}
          <span className="text-subtitle/70 font-bold">{meta.total}</span>{" "}
          {t.users.pagination.users}
        </div>
        <FilterDropdown
          value={String(limit)}
          onChange={(v) => { setLimit(Number(v)); setPage(1); }}
          options={[5, 10, 20, 50].map(n => ({ value: String(n), label: `${n} / ${t.common.per_page}` }))}
          placeholder=""
          showReset={false}
          compact
          neutral
          up
        />
      </div>
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-md shadow-brand/20">{page}</button>
        <button 
          onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
          disabled={page >= meta.totalPages}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div>
      <div className="lg:hidden flex flex-col gap-4 pb-8">
        <h1 className="text-2xl font-black text-title tracking-tight text-center">{t.topbar.titles.users}</h1>
        <FiltersBar
          searchPlaceholder={t.users.search_placeholder}
          onSearchChange={(value) => { setSearch(value); setPage(1); }}
          showQuickFilters={false}
          showClearAll={false}
          hasExternalFilter={hasUserFilters}
          onClearAll={clearUserFilters}
        />

        {/* Mobile filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`h-11 px-4 rounded-2xl border text-sm font-semibold shadow-sm transition-all shrink-0 ${
                statusFilter === s
                  ? "bg-brand/10 border-brand/20 text-brand shadow-sm"
                  : "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80"
              }`}
            >
              {s === "all" ? t.common.all : s === "active" ? t.common.active : t.common.inactive}
            </button>
          ))}

          <button
            onClick={() => setIsRoleDropdownOpen(v => !v)}
            className={`flex items-center gap-1.5 h-11 px-4 rounded-2xl border text-sm font-semibold shadow-sm transition-all shrink-0 ${
              roleFilter
                ? "border-brand/40 bg-brand/5 text-brand"
                : "border-border-theme/50 bg-white text-subtitle/50 hover:border-border-theme/80"
            }`}
          >
            {roleFilter ? (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${getRoleCircleStyle(roleFilter)}`}>
                <span className="text-[9px] font-black leading-none">
                  {getRoleLabel(roleFilter, t).slice(0, 1)}
                </span>
              </div>
            ) : (
              <>
                <span>{t.users.table.role}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </>
            )}
          </button>
        </div>

        {/* Role chip */}
        {roleFilter && (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/5 border border-brand/20">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${getRoleCircleStyle(roleFilter)}`}>
                <span className="text-[8px] font-black leading-none">
                  {getRoleLabel(roleFilter, t).slice(0, 1)}
                </span>
              </div>
              <span className="text-xs font-semibold text-brand">{getRoleLabel(roleFilter, t)}</span>
              <button onClick={() => { setRoleFilter(null); setPage(1); }} className="text-brand/40 hover:text-brand transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Role bottom sheet */}
        {isRoleDropdownOpen && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="fixed inset-0 z-200 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => setIsRoleDropdownOpen(false)} />
            <div className="relative bg-white rounded-t-3xl animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className="text-base font-black text-title">{t.users.table.role}</span>
                <button onClick={() => setIsRoleDropdownOpen(false)} className="p-1.5 rounded-full hover:bg-app-bg text-subtitle/40">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="pb-8">
                {visibleRoleOptions.map(role => (
                  <button
                    key={role}
                    onClick={() => { setRoleFilter(role); setIsRoleDropdownOpen(false); setPage(1); }}
                    className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${roleFilter === role ? "bg-brand/5" : "hover:bg-app-bg"}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getRoleCircleStyle(role)}`}>
                      <span className="text-[11px] font-black">{getRoleLabel(role, t).slice(0, 1)}</span>
                    </div>
                    <span className={`text-sm font-semibold ${roleFilter === role ? "text-brand" : "text-title"}`}>
                      {getRoleLabel(role, t)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

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
            <button onClick={() => refetch()} className="px-6 py-2 bg-app-bg border border-border-theme/40 rounded-xl text-subtitle font-bold text-sm hover:bg-border-theme/10 transition-all">
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
              <p className="text-sm font-medium leading-relaxed text-subtitle/60 max-w-xs mx-auto">{t.users.states.empty_subtitle}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {usersList.map((item: User) => (
              <UserCard key={item.id} item={item} t={t} onClick={() => setSelectedUser(item)} />
            ))}
          </div>
        )}
      </div>

      <div className="hidden lg:flex flex-col space-y-8">
        <div className={`grid gap-4 ${user?.role === "SUPER_ADMIN" ? "grid-cols-5" : "grid-cols-4"}`}>
          <KPICard
            title={t.users.kpis.total}
            value={userStats?.total_users ?? 0}
            icon={UsersIcon}
            iconBg="bg-violet-50"
            iconColor="text-violet-500"
            roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
          />
          {user?.role === "SUPER_ADMIN" && (
            <KPICard
              title={t.users.kpis.super_admins}
              value={userStats?.super_admins ?? 0}
              icon={ShieldCheck}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
              roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
            />
          )}
          <KPICard
            title={t.users.kpis.admins}
            value={userStats?.admins ?? 0}
            icon={ShieldUser}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
          />
          <KPICard
            title={t.users.kpis.workers}
            value={userStats?.workers ?? 0}
            icon={HardHat}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
          />
          <KPICard
            title={t.users.kpis.external}
            value={userStats?.external_users ?? 0}
            icon={Building2}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            roundedClass="rounded-xl sm:rounded-2xl lg:rounded-[20px]"
          />
        </div>

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
          <div className="flex items-center gap-3">
            <FilterDropdown
              value={roleFilter ?? ""}
              onChange={(value) => {
                setRoleFilter(value ? value as User["role"] : null);
                setPage(1);
              }}
              options={visibleRoleOptions.map(role => ({
                value: role,
                label: getRoleLabel(role, t),
              }))}
              placeholder={t.users.table.role}
              className="w-44"
            />
            <FilterDropdown
              value={statusFilter === "all" ? "" : statusFilter}
              onChange={(value) => {
                setStatusFilter(value ? value as "active" | "inactive" : "all");
                setPage(1);
              }}
              options={[
                { value: "active", label: t.common.active },
                { value: "inactive", label: t.common.inactive },
              ]}
              placeholder={t.users.table.status}
              className="w-40"
            />
            <button
              onClick={() => {
                setEditingUser(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-brand hover:bg-brand/90 active:scale-95 text-white h-11 px-5 rounded-2xl font-black text-sm transition-all shadow-lg shadow-brand/25"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>{t.users.add_new}</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 min-h-100">
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.users.states.loading}</p>
          </div>
        ) : isError ? (
          <ModuleContainer roundedClass="rounded-2xl">
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
          <ModuleContainer roundedClass="rounded-2xl">
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
          <ModuleContainer roundedClass="rounded-2xl">
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
        onEdit={(targetUser) => {
          setSelectedUser(null);
          setEditingUser(targetUser);
          setIsModalOpen(true);
        }}
        onDelete={(targetUser) => {
          setSelectedUser(null);
          setUserToDelete(targetUser);
        }}
        onResetPassword={(targetUser) => {
          setSelectedUser(null);
          setUserToResetPassword(targetUser);
        }}
        onToggleStatus={(targetUser) => {
          setSelectedUser(null);
          handleToggleStatus(targetUser);
        }}
      />

      <UserModal
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingUser(null); }} 
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingUser(null);
          refetch();
          refetchUserStats();
        }}
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

      <ConfirmModal
        isOpen={!!userToResetPassword}
        onClose={() => setUserToResetPassword(null)}
        onConfirm={handleConfirmPasswordReset}
        title={t.confirm_modal.reset_password_title}
        description={
          userToResetPassword
            ? `${t.confirm_modal.reset_password_description} (${userToResetPassword.email})`
            : t.confirm_modal.reset_password_description
        }
        confirmText={t.confirm_modal.confirm_reset_password}
        cancelText={t.confirm_modal.cancel_delete}
        variant="brand"
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
