"use client";

import React, { useState, useEffect } from "react";
import {
  X, User, Mail, Building2, Eye, EyeOff, ChevronDown, Loader2,
  Send, Lock, Globe, Layers, ShieldCheck, Search, Check, CheckCircle2,
  Anchor, Info,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import { usersService } from "@/services/users.service";
import { ownersService } from "@/services/owners.service";
import { assetsService } from "@/services/assets.service";
import { invitationsService } from "@/services/invitations.service";
import Combobox from "@/components/ui/Combobox";
import { organizationsService, Organization } from "@/services/organizations.service";

export interface UserFormData {
  name: string;
  email: string;
  organization_id: string;
  owner_id: string;
  role: string;
  password?: string;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit?: any | null;
}

type LoginMethod = "invite" | "password";
type AssetScope = "ALL" | "SPECIFIC" | "NONE";

const ROLE_ICONS: Record<string, React.ElementType> = {
  ADMIN: ShieldCheck,
  WORKER: User,
  EXTERNAL: User,
  SUPER_ADMIN: ShieldCheck,
};

function ScopeCard({
  icon: Icon,
  title,
  desc,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
        selected ? "border-brand bg-brand/5" : "border-border-theme/40 bg-app-bg hover:border-border-theme/70"
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? "bg-brand/10 text-brand" : "bg-white text-subtitle/40"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-black text-title">{title}</p>
      <p className="text-xs text-subtitle/50 leading-snug">{desc}</p>
    </button>
  );
}

function WorkerAccessPanel({
  t,
  assetScope,
  setAssetScope,
  assets,
  assetSearch,
  setAssetSearch,
  selectedAssetIds,
  setSelectedAssetIds,
}: {
  t: ReturnType<typeof useLanguage>["t"];
  assetScope: AssetScope;
  setAssetScope: (scope: AssetScope) => void;
  assets: { id: string; name: string; category?: string; thumbnail_url?: string; is_active: boolean }[];
  assetSearch: string;
  setAssetSearch: (v: string) => void;
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const access = t.users.modal.access;
  const filtered = assets.filter((a) => a.name.toLowerCase().includes(assetSearch.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black text-title uppercase tracking-wider">{access.section_worker}</h3>
        <p className="mt-1 text-xs text-subtitle/50">{access.subtitle_worker}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ScopeCard icon={Globe} title={access.scope_all_title} desc={access.scope_all_desc} selected={assetScope === "ALL"} onClick={() => setAssetScope("ALL")} />
        <ScopeCard icon={Layers} title={access.scope_specific_title} desc={access.scope_specific_desc} selected={assetScope === "SPECIFIC"} onClick={() => setAssetScope("SPECIFIC")} />
        <ScopeCard icon={Lock} title={access.scope_none_title} desc={access.scope_none_desc} selected={assetScope === "NONE"} onClick={() => setAssetScope("NONE")} />
      </div>

      {assetScope === "SPECIFIC" && (
        <div className="rounded-2xl border border-border-theme/40 bg-white overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 border-b border-border-theme/30">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-subtitle/30" />
              <input
                type="text"
                placeholder={t.users.modal.asset_access_search_placeholder}
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-app-bg border border-border-theme/40 rounded-xl text-sm font-medium placeholder:text-subtitle/30 focus:outline-none focus:border-brand transition-all"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
              <span className="text-subtitle/40">{selectedAssetIds.length} {access.assets_selected}</span>
              <button type="button" onClick={() => setSelectedAssetIds(assets.map((a) => a.id))} className="text-brand">
                {access.select_all}
              </button>
              <button type="button" onClick={() => setSelectedAssetIds([])} className="text-subtitle/50">
                {access.clear}
              </button>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto custom-scroll divide-y divide-border-theme/10">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-sm text-subtitle/40 text-center">{t.common.no_results}</p>
            ) : (
              filtered.map((asset) => {
                const checked = selectedAssetIds.includes(asset.id);
                return (
                  <label key={asset.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-app-bg/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedAssetIds((prev) => (checked ? prev.filter((id) => id !== asset.id) : [...prev, asset.id]))
                      }
                      className="w-4 h-4 rounded accent-brand shrink-0"
                    />
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-app-bg border border-border-theme/30 shrink-0 flex items-center justify-center">
                      {asset.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Anchor className="w-4 h-4 text-subtitle/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-title truncate">{asset.name}</p>
                      {asset.category && <p className="text-xs text-subtitle/40">{asset.category}</p>}
                    </div>
                    <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${asset.is_active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                      {asset.is_active ? t.common.active : t.common.inactive}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-subtitle/40">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>{access.footer_note}</p>
      </div>
    </div>
  );
}

function OwnerAccessPanel({
  t,
  owners,
  ownerId,
  setOwnerId,
  assets,
}: {
  t: ReturnType<typeof useLanguage>["t"];
  owners: { id: string; name: string }[];
  ownerId: string;
  setOwnerId: (id: string) => void;
  assets: { id: string; name: string; category?: string; owner_id?: string | null; is_active: boolean }[];
}) {
  const access = t.users.modal.access;
  const selectedOwner = owners.find((o) => o.id === ownerId);
  const linkedAssets = assets.filter((a) => a.owner_id === ownerId);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black text-title uppercase tracking-wider">{access.section_external}</h3>
        <p className="mt-1 text-xs text-subtitle/50">{access.subtitle_external}</p>
      </div>

      <Combobox
        label={t.users.modal.owner}
        options={owners}
        value={ownerId}
        onChange={setOwnerId}
        placeholder={t.users.modal.owner_select_placeholder}
      />

      {selectedOwner && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-title text-white">
            <Anchor className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-title truncate">{selectedOwner.name}</p>
            <p className="text-xs font-bold text-brand">{linkedAssets.length} {access.assets_count}</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-brand shrink-0" />
        </div>
      )}

      <div>
        <h4 className="text-sm font-black text-title">{access.linked_assets_title}</h4>
        <p className="mt-0.5 text-xs text-subtitle/50">{access.linked_assets_subtitle}</p>
        <div className="mt-2 rounded-2xl border border-border-theme/40 bg-white divide-y divide-border-theme/10 max-h-48 overflow-y-auto custom-scroll">
          {linkedAssets.length === 0 ? (
            <p className="px-4 py-4 text-sm text-subtitle/40 text-center">{t.assets.states.empty_title}</p>
          ) : (
            linkedAssets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-9 h-9 rounded-xl bg-app-bg border border-border-theme/30 shrink-0 flex items-center justify-center">
                  <Anchor className="w-4 h-4 text-subtitle/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-title truncate">{asset.name}</p>
                  {asset.category && <p className="text-xs text-subtitle/40">{asset.category}</p>}
                </div>
                <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${asset.is_active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                  {asset.is_active ? t.common.active : t.common.inactive}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-subtitle/40">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>{access.linked_assets_note}</p>
      </div>
    </div>
  );
}

function AdminAccessPanel({ t }: { t: ReturnType<typeof useLanguage>["t"] }) {
  const access = t.users.modal.access;
  const perms = [
    access.admin_perm_assets,
    access.admin_perm_users,
    access.admin_perm_services,
    access.admin_perm_reports,
    access.admin_perm_settings,
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black text-title uppercase tracking-wider">{access.section_admin}</h3>
        <p className="mt-1 text-xs text-subtitle/50">{access.subtitle_admin}</p>
      </div>

      <div className="rounded-3xl border-2 border-brand/15 bg-brand/5 p-6 space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-base font-black text-title">{access.admin_panel_title}</p>
          <p className="text-sm text-subtitle/55 max-w-xs">{access.admin_panel_desc}</p>
        </div>

        <div className="space-y-2 border-t border-brand/10 pt-4">
          {perms.map((perm) => (
            <div key={perm} className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-brand shrink-0" />
              <span className="text-sm font-semibold text-title">{perm}</span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-white p-3 text-xs text-subtitle/55">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-brand" />
          <p>{access.admin_footer_note}</p>
        </div>
      </div>
    </div>
  );
}

export default function UserModal({ isOpen, onClose, onSuccess, userToEdit }: UserModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isEditMode = !!userToEdit;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("invite");
  const [assetScope, setAssetScope] = useState<AssetScope>("ALL");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization_id: "",
    owner_id: "",
    role: "WORKER",
    password: ""
  });

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; name: string; category?: string; thumbnail_url?: string; owner_id?: string | null; is_active: boolean }[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (isSuperAdmin) {
        organizationsService.findAll().then(setOrganizations).catch(() => {});
      }

      ownersService.findAll().then((data: any) => {
        const list = Array.isArray(data) ? data : data.data || [];
        setOwners(list);
      }).catch(() => {});

      assetsService.findAll().then((data: any) => {
        const list = Array.isArray(data) ? data : data.data || [];
        setAssets(list);
      }).catch(() => {});

      setAssetSearch("");
      setLoginMethod("invite");

      if (userToEdit) {
        setFormData({
          name: userToEdit.name || "",
          email: userToEdit.email || "",
          organization_id: userToEdit.organization_id || "",
          owner_id: userToEdit.owner_id || "",
          role: userToEdit.role || "WORKER",
          password: ""
        });
        if (userToEdit.role === "WORKER") {
          usersService.findOne(userToEdit.id)
            .then((detail) => {
              setSelectedAssetIds(detail.asset_access || []);
              setAssetScope(
                detail.asset_access_mode === "RESTRICTED"
                  ? (detail.asset_access && detail.asset_access.length > 0 ? "SPECIFIC" : "NONE")
                  : "ALL",
              );
            })
            .catch(() => setSelectedAssetIds([]));
        } else {
          setSelectedAssetIds([]);
          setAssetScope("ALL");
        }
      } else {
        setFormData({ name: "", email: "", organization_id: "", owner_id: "", role: "WORKER", password: "" });
        setSelectedAssetIds([]);
        setAssetScope("ALL");
      }
    }
  }, [isOpen, userToEdit, isSuperAdmin]);

  if (!isOpen) return null;

  const showNameField = isEditMode || loginMethod === "password";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.role === "EXTERNAL" && !formData.owner_id) {
      showToast(t.users.modal.owner_required, "error");
      return;
    }
    setLoading(true);
    try {
      if (isEditMode) {
        const payload: Record<string, string> = {
          name: formData.name,
          email: formData.email,
        };
        if (isSuperAdmin && formData.role !== "SUPER_ADMIN") {
          payload.organization_id = formData.organization_id;
        }
        await usersService.update(userToEdit.id, payload);
        if (formData.role === "WORKER") {
          const mode = assetScope === "ALL" ? "UNRESTRICTED" : "RESTRICTED";
          const ids = assetScope === "SPECIFIC" ? selectedAssetIds : [];
          await usersService.setAssetAccess(userToEdit.id, ids, mode);
        }
        showToast(t.users.states.update_success, "success");
      } else if (loginMethod === "invite") {
        const invitePayload: Record<string, unknown> = {
          email: formData.email,
          role: formData.role,
        };
        if (isSuperAdmin && formData.role !== "SUPER_ADMIN") invitePayload.organization_id = formData.organization_id;
        if (formData.role === "EXTERNAL") invitePayload.owner_id = formData.owner_id;
        if (formData.role === "WORKER") {
          invitePayload.asset_access_mode = assetScope === "ALL" ? "UNRESTRICTED" : "RESTRICTED";
          invitePayload.asset_ids = assetScope === "SPECIFIC" ? selectedAssetIds : [];
        }
        await invitationsService.create(invitePayload as any);
        showToast(t.users.states.invite_success, "success");
      } else {
        const payload: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
        };
        if (isSuperAdmin && formData.role !== "SUPER_ADMIN") payload.organization_id = formData.organization_id;
        if (formData.role === "EXTERNAL" && formData.owner_id) payload.owner_id = formData.owner_id;
        if (formData.role === "WORKER") {
          payload.asset_access_mode = assetScope === "ALL" ? "UNRESTRICTED" : "RESTRICTED";
        }
        const created = await usersService.create(payload);
        if (formData.role === "WORKER" && assetScope === "SPECIFIC" && selectedAssetIds.length > 0) {
          await usersService.setAssetAccess(created.id, selectedAssetIds, "RESTRICTED");
        }
        showToast(t.users.states.invite_success, "success");
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.message)
          ? error.response.data.message.join(", ")
          : null);
      showToast(
        backendMsg || (isEditMode ? t.users.states.error_update : t.users.states.error_invite),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = isEditMode ? t.users.modal.submit_edit : t.users.modal.submit;

  const RoleIcon = ROLE_ICONS[formData.role] ?? User;
  const infoBanner =
    formData.role === "WORKER" ? t.users.modal.info_worker
    : formData.role === "EXTERNAL" ? t.users.modal.info_external
    : t.users.modal.info_admin;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 max-h-[92vh] flex flex-col">
        <div className="px-8 pt-10 pb-6 flex justify-between items-center border-b border-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black text-title tracking-tight">
              {isEditMode ? t.users.modal.title_edit : t.users.modal.title}
            </h2>
            <p className="text-subtitle/50 text-sm font-medium mt-1">
              {isEditMode ? t.users.modal.subtitle_edit : t.users.modal.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scroll flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-subtitle/50 uppercase tracking-[0.15em]">{t.users.modal.identity_section}</h3>

                {showNameField && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.full_name}</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-brand">
                        <User className="h-5 w-5 opacity-30" />
                      </div>
                      <input
                        required
                        type="text"
                        className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm"
                        placeholder={t.users.modal.full_name_placeholder}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.email}</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-brand">
                      <Mail className="h-5 w-5 opacity-30" />
                    </div>
                    <input
                      required
                      type="email"
                      disabled={isEditMode}
                      className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm disabled:opacity-60"
                      placeholder={t.users.modal.email_placeholder}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                {isSuperAdmin && formData.role !== "SUPER_ADMIN" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.organization}</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-brand">
                        <Building2 className="h-5 w-5 opacity-30" />
                      </div>
                      <select
                        required
                        className="block w-full pl-14 pr-10 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm appearance-none"
                        value={formData.organization_id}
                        onChange={(e) => setFormData({ ...formData, organization_id: e.target.value, owner_id: "" })}
                      >
                        <option value="" disabled>{t.users.modal.organization_placeholder}</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <ChevronDown className="h-4 w-4 text-subtitle/50" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black text-subtitle/50 uppercase tracking-[0.15em]">{t.users.modal.role_section}</h3>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.role}</label>
                  {!isEditMode ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                        className="w-full px-5 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold text-sm flex items-center justify-between focus:outline-none focus:border-brand transition-all"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                            <RoleIcon className="h-4 w-4" />
                          </span>
                          {t.users.modal.roles[formData.role.toLowerCase() as keyof typeof t.users.modal.roles] ?? formData.role}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-subtitle transition-transform duration-300 ${isRoleDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isRoleDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsRoleDropdownOpen(false)} />
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border-theme/40 rounded-2xl shadow-2xl z-20 py-2 animate-in fade-in zoom-in-95 duration-200">
                            {[
                              { id: "ADMIN", label: t.users.modal.roles.admin },
                              { id: "WORKER", label: t.users.modal.roles.worker },
                              { id: "EXTERNAL", label: t.users.modal.roles.external }
                            ].map((role) => {
                              const Icon = ROLE_ICONS[role.id] ?? User;
                              return (
                                <button
                                  key={role.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      role: role.id,
                                      owner_id: role.id === "EXTERNAL" ? formData.owner_id : "",
                                    });
                                    setAssetScope("ALL");
                                    setIsRoleDropdownOpen(false);
                                  }}
                                  className={`w-full px-5 py-3 text-left text-sm font-bold transition-colors hover:bg-brand/5 flex items-center gap-2.5 ${
                                    formData.role === role.id ? "text-brand bg-brand/5" : "text-title/70"
                                  }`}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="flex-1">{role.label}</span>
                                  {formData.role === role.id && <div className="w-1.5 h-1.5 rounded-full bg-brand" />}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="w-full px-5 py-4 border border-border-theme/40 rounded-2xl bg-app-bg/50 text-title font-bold text-sm flex items-center gap-2.5 opacity-70">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <RoleIcon className="h-4 w-4" />
                      </span>
                      {t.users.modal.roles[formData.role.toLowerCase() as keyof typeof t.users.modal.roles] ?? formData.role}
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2.5 rounded-2xl bg-brand/5 border border-brand/10 p-3.5 text-xs font-medium text-title/70">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-brand" />
                  <p>{infoBanner}</p>
                </div>
              </div>

              {!isEditMode && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-subtitle/50 uppercase tracking-[0.15em]">{t.users.modal.login_section}</h3>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.login_method_label}</label>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setLoginMethod("invite")}
                        className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all ${
                          loginMethod === "invite" ? "border-brand bg-brand/5" : "border-border-theme/40 bg-app-bg hover:border-border-theme/70"
                        }`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${loginMethod === "invite" ? "border-brand" : "border-border-theme/40"}`}>
                          {loginMethod === "invite" && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                        </span>
                        <Send className="h-4 w-4 text-subtitle/40 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-title">{t.users.modal.invite_option_title}</p>
                          <p className="text-xs text-subtitle/50">{t.users.modal.invite_option_desc}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoginMethod("password")}
                        className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all ${
                          loginMethod === "password" ? "border-brand bg-brand/5" : "border-border-theme/40 bg-app-bg hover:border-border-theme/70"
                        }`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${loginMethod === "password" ? "border-brand" : "border-border-theme/40"}`}>
                          {loginMethod === "password" && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                        </span>
                        <Lock className="h-4 w-4 text-subtitle/40 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-title">{t.users.modal.password_option_title}</p>
                          <p className="text-xs text-subtitle/50">{t.users.modal.password_option_desc}</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {loginMethod === "password" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.users.modal.password}</label>
                      <div className="relative group">
                        <input
                          required
                          minLength={8}
                          type={showPassword ? "text" : "password"}
                          className="block w-full px-6 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:border-brand transition-all text-sm"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-6 flex items-center text-subtitle/30 hover:text-brand transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {formData.password.length > 0 && formData.password.length < 8 && (
                        <p className="text-[11px] font-bold text-error/70 ml-1">
                          Minimum 8 characters ({formData.password.length}/8)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:border-l lg:border-border-theme/20 lg:pl-10">
              {formData.role === "WORKER" && (
                <WorkerAccessPanel
                  t={t}
                  assetScope={assetScope}
                  setAssetScope={setAssetScope}
                  assets={assets}
                  assetSearch={assetSearch}
                  setAssetSearch={setAssetSearch}
                  selectedAssetIds={selectedAssetIds}
                  setSelectedAssetIds={setSelectedAssetIds}
                />
              )}
              {formData.role === "EXTERNAL" && (
                <OwnerAccessPanel
                  t={t}
                  owners={owners}
                  ownerId={formData.owner_id}
                  setOwnerId={(id) => setFormData({ ...formData, owner_id: id })}
                  assets={assets}
                />
              )}
              {(formData.role === "ADMIN" || formData.role === "SUPER_ADMIN") && (
                <AdminAccessPanel t={t} />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-8 mt-2 border-t border-border-theme/20">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 rounded-2xl text-sm font-bold text-subtitle/60 hover:bg-app-bg transition-all"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3.5 bg-brand text-white rounded-2xl text-sm font-black shadow-xl shadow-brand/20 hover:bg-brand/90 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 min-w-40"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
