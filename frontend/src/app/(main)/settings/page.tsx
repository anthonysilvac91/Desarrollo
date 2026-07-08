"use client";

import React, { useState } from "react";
import ReactDOM from "react-dom";
import QRCode from "qrcode";
import { 
  Building2,
  Camera,
  Ship,
  Car,
  Home,
  Square,
  Pencil,
  Save,
  ImageIcon,
  Plane,
  Truck,
  Wrench,
  Factory,
  HardHat,
  Cpu,
  Bot,
  Stethoscope,
  Leaf,
  Briefcase,
  Trophy,
  Loader2,
  User as UserIcon,
  ChevronDown,
  CreditCard,
  ShieldCheck,
  Bell,
  Smartphone,
  MessageSquare,
  Mail,
  Eye,
  EyeOff,
  Info,
  Laptop,
  Monitor,
  LogOut,
  MapPin,
  X,
  Database,
  Megaphone,
  AlignLeft,
  BrushCleaning,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import ModuleContainer from "@/components/ui/ModuleContainer";
import { organizationsService } from "@/services/organizations.service";
import { aiSettingsService, OpenAiSettings } from "@/services/ai-settings.service";
import { usersService } from "@/services/users.service";
import { authService, AuthSession, TwoFactorSetup } from "@/services/auth.service";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import LogoCropModal from "@/components/ui/LogoCropModal";
import ImageCropModal from "@/components/ui/ImageCropModal";
import PlanStatusCard from "@/components/subscriptions/PlanStatusCard";
import { compressImageFile } from "@/lib/imageCompression";

const BRAND_PALETTES = [
  { id: "fentri", name: "Fentri Blue", base: "bg-blue-600", shades: ["bg-blue-400", "bg-blue-700", "bg-blue-900"] },
  { id: "ocean", name: "Ocean Breeze", base: "bg-cyan-500", shades: ["bg-cyan-300", "bg-cyan-600", "bg-cyan-800"] },
  { id: "teal", name: "Teal Green", base: "bg-teal-500", shades: ["bg-teal-300", "bg-teal-600", "bg-teal-800"] },
  { id: "forest", name: "Forest", base: "bg-emerald-600", shades: ["bg-emerald-400", "bg-emerald-700", "bg-emerald-900"] },
  { id: "amber", name: "Amber Sun", base: "bg-amber-500", shades: ["bg-amber-300", "bg-amber-600", "bg-amber-800"] },
  { id: "orange", name: "Sunset Orange", base: "bg-orange-500", shades: ["bg-orange-300", "bg-orange-600", "bg-orange-800"] },
  { id: "rose", name: "Rose Petal", base: "bg-rose-500", shades: ["bg-rose-300", "bg-rose-600", "bg-rose-800"] },
  { id: "pink", name: "Hot Pink", base: "bg-pink-500", shades: ["bg-pink-300", "bg-pink-600", "bg-pink-800"] },
  { id: "indigo", name: "Indigo Night", base: "bg-indigo-600", shades: ["bg-indigo-400", "bg-indigo-700", "bg-indigo-900"] },
  { id: "violet", name: "Royal Violet", base: "bg-violet-600", shades: ["bg-violet-400", "bg-violet-700", "bg-violet-900"] },
  { id: "slate", name: "Slate Grey", base: "bg-slate-600", shades: ["bg-slate-400", "bg-slate-700", "bg-slate-900"] },
];

const ASSET_ICONS = [
  { id: "ship", label: "Barco / Yacht", icon: Ship },
  { id: "car", label: "Automóvil", icon: Car },
  { id: "house", label: "Inmobiliaria", icon: Home },
  { id: "building", label: "Edificio", icon: Square },
  { id: "plane", label: "Aeronave", icon: Plane },
  { id: "truck", label: "Transporte", icon: Truck },
  { id: "industry", label: "Industria", icon: Factory },
  { id: "tools", label: "Servicios", icon: Wrench },
  { id: "construction", label: "Obra", icon: HardHat },
  { id: "tech", label: "Tecnología", icon: Cpu },
  { id: "health", label: "Salud", icon: Stethoscope },
  { id: "nature", label: "Ambiente", icon: Leaf },
  { id: "corporate", label: "Corporativo", icon: Briefcase },
  { id: "leisure", label: "Ocio", icon: Trophy },
  { id: "cleaning", label: "Limpieza", icon: BrushCleaning },
  { id: "camera", label: "Inspección", icon: Camera },
];

const AVATAR_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export default function SettingsPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { refreshUser, user } = useAuth();
  const canManageOrgSettings = user?.role === "ADMIN";
  const canManageAiSettings = user?.role === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  
  // States for changes
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [showOrgName, setShowOrgName] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileTimezone, setProfileTimezone] = useState(() =>
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ["my-organization"],
    queryFn: () => organizationsService.getMyOrganization(),
    enabled: canManageOrgSettings,
  });

  const mutation = useMutation({
    mutationFn: (fd: FormData) => organizationsService.updateSettings(fd),
    onSuccess: () => {
      showToast(t.feedback.save_success, "success");
      queryClient.invalidateQueries({ queryKey: ["my-organization"] });
      refreshUser();
    },
    onError: () => showToast("Error al guardar cambios", "error"),
  });

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

  const profileMutation = useMutation({
    mutationFn: (fd: FormData) => usersService.updateMe(fd),
    onSuccess: () => {
      showToast(t.feedback.save_success, "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setAvatarFile(null);
      setRemoveAvatar(false);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      refreshUser();
    },
    onError: (error) => showToast(getServerErrorMessage(error, "Error al guardar perfil"), "error"),
  });

  React.useEffect(() => {
    if (org) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrgName(org.name || "");
      setShowOrgName(org.show_org_name ?? false);
      if (org.logo_url) setLogoPreview(org.logo_url);
      if (org.brand_color) {
        const found = BRAND_PALETTES.find(p => p.id === org.brand_color || p.name === org.brand_color);
        setSelectedPalette(found?.id || "fentri");
      }
      if (org.default_asset_icon) setSelectedIcon(org.default_asset_icon);
    }
  }, [org]);

  React.useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      setProfilePhone((user as any).phone || "");
      setAvatarPreview(user.avatar_url || null);
    }
  }, [user]);

  const handleSave = async () => {
    const fd = new FormData();
    if (logoFile) fd.append("logo", logoFile);
    if (selectedPalette) fd.append("brand_color", selectedPalette);
    if (selectedIcon) fd.append("default_asset_icon", selectedIcon);
    if (canManageOrgSettings && orgName.trim()) fd.append("name", orgName.trim());
    fd.append("show_org_name", String(showOrgName));
    mutation.mutate(fd);
  };

  const handleProfileSave = async () => {
    if (!profileName.trim()) {
      showToast("El nombre es obligatorio", "error");
      return;
    }

    if (!profileEmail.trim()) {
      showToast("El correo es obligatorio", "error");
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        showToast("Ingresa tu contraseña actual", "error");
        return;
      }

      if (newPassword.length < 6) {
        showToast("La nueva contraseña debe tener al menos 6 caracteres", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast("Las contraseñas no coinciden", "error");
        return;
      }
    }

    const fd = new FormData();
    fd.append("name", profileName.trim());
    fd.append("email", profileEmail.trim());
    fd.append("phone", profilePhone.trim());
    if (avatarFile) fd.append("avatar", avatarFile);
    if (removeAvatar && !avatarFile) fd.append("remove_avatar", "true");
    if (newPassword) {
      fd.append("current_password", currentPassword);
      fd.append("new_password", newPassword);
      fd.append("language", language);
    }
    profileMutation.mutate(fd);
  };

  const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const source = await compressImageFile(file, {
        maxDimension: 2400,
        quality: 0.85,
        maxBytes: 10 * 1024 * 1024,
        fileNamePrefix: "profile-avatar-source",
      });

      const reader = new FileReader();
      reader.onloadend = () => setAvatarCropSrc(reader.result as string);
      reader.onerror = () => showToast(t.common.image_read_error, "error");
      reader.readAsDataURL(source);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo procesar la foto de perfil", "error");
    }
  };

  const handleAvatarCropConfirm = async (croppedFile: File) => {
    try {
      const avatar = await compressImageFile(croppedFile, {
        maxDimension: 1200,
        quality: 0.85,
        maxBytes: AVATAR_IMAGE_MAX_BYTES,
        fileNamePrefix: "profile-avatar",
      });
      setAvatarFile(avatar);
      setAvatarPreview(URL.createObjectURL(avatar));
      setAvatarCropSrc(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo procesar la foto de perfil", "error");
      setAvatarCropSrc(null);
    }
  };

  const allTabs = [
    ...(canManageOrgSettings ? [{ id: "profile", label: t.settings.tabs.profile, icon: Building2 }] : []),
    ...(canManageAiSettings ? [{ id: "ai", label: t.settings.tabs.ai, icon: Bot }] : []),
    { id: "my_profile",      label: t.settings.tabs.my_profile,    icon: UserIcon    },
    ...(!canManageAiSettings ? [{ id: "plans", label: t.settings.tabs.plans, icon: CreditCard }] : []),
    { id: "security",        label: t.settings.tabs.security,       icon: ShieldCheck },
    { id: "notifications",   label: t.settings.tabs.notifications,  icon: Bell        },
  ];
  const tabs = allTabs;

  const requestedTab = searchParams.get("tab");
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : tabs[0].id;

  const handleTabClick = (tabId: string) => {
    router.replace(tabId === "profile" ? "/settings" : `/settings?tab=${tabId}`);
  };

  if (canManageOrgSettings && isLoading) return <div className="p-20 text-center animate-pulse text-subtitle/40 font-black uppercase">Cargando...</div>;

  return (
    <div>
      {logoCropSrc && (
        <LogoCropModal
          src={logoCropSrc}
          onConfirm={(file) => {
            setLogoFile(file);
            const r = new FileReader();
            r.onloadend = () => setLogoPreview(r.result as string);
            r.readAsDataURL(file);
            setLogoCropSrc(null);
          }}
          onCancel={() => setLogoCropSrc(null)}
          onError={(msg) => { showToast(msg, "error"); setLogoCropSrc(null); }}
        />
      )}
      {avatarCropSrc && (
        <ImageCropModal
          src={avatarCropSrc}
          onConfirm={handleAvatarCropConfirm}
          onCancel={() => setAvatarCropSrc(null)}
          onError={(msg) => { showToast(msg, "error"); setAvatarCropSrc(null); }}
        />
      )}
      {/* ── Mobile Settings ── */}
      <div className="lg:hidden flex flex-col">
        {/* Tab bar */}
        <div className="flex border-b border-border-theme/30">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`relative flex flex-1 items-center justify-center py-3 transition-all ${
                  isActive ? "text-brand" : "text-subtitle/40"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="pb-56">
          {activeTab === "profile" ? (
            <div className="p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">

              {/* Organization Profile card */}
              <div className="bg-white rounded-3xl border border-border-theme/30 p-5 space-y-5">
                <div>
                  <p className="text-sm font-black text-title">{t.settings.owner_section.title}</p>
                  <p className="text-xs text-subtitle/50 mt-0.5">Manage your organization&apos;s main information and visibility.</p>
                </div>

                {/* Centered logo */}
                <div className="flex justify-center">
                  <div className="relative inline-block">
                    {logoPreview ? (
                      <>
                        <div className="w-24 h-24 rounded-2xl border-2 border-border-theme/20 bg-app-bg/40 overflow-hidden">
                          <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                        </div>
                        <label className="absolute -bottom-2 -right-2 bg-brand text-white p-2 rounded-xl shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                          <input type="file" className="hidden" accept="image/*" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const r = new FileReader();
                            r.onloadend = () => setLogoCropSrc(r.result as string);
                            r.readAsDataURL(file);
                            e.target.value = "";
                          }} />
                        </label>
                      </>
                    ) : (
                      <label className="cursor-pointer group block">
                        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border-theme/40 bg-app-bg/40 flex flex-col items-center justify-center gap-1.5 group-hover:border-brand/40 group-hover:bg-brand/5 transition-all overflow-hidden">
                          <ImageIcon className="w-6 h-6 text-subtitle/30 group-hover:text-brand/40 transition-colors" strokeWidth={1.5} />
                          <span className="text-[10px] font-semibold text-subtitle/40 text-center leading-tight px-2">
                            {t.settings.owner_section.upload_logo}
                          </span>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const r = new FileReader();
                          r.onloadend = () => setLogoCropSrc(r.result as string);
                          r.readAsDataURL(file);
                          e.target.value = "";
                        }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Org name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-subtitle/50">{t.settings.owner_section.name}</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    readOnly={!canManageOrgSettings}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-sm text-title font-semibold outline-none transition-all shadow-sm ${
                      canManageOrgSettings
                        ? "bg-white border-border-theme/50 focus:ring-2 focus:ring-brand/15 focus:border-brand"
                        : "bg-app-bg/50 border-border-theme/40 opacity-70 cursor-default"
                    }`}
                  />
                </div>

                {/* Show org name toggle */}
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showOrgName}
                    onClick={() => setShowOrgName(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none mt-0.5 ${
                      showOrgName ? "bg-brand" : "bg-border-theme/40"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${showOrgName ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-title leading-tight">{t.settings.owner_section.show_org_name}</p>
                    <p className="text-xs text-subtitle/50 mt-0.5 leading-snug">
                      When enabled, the organization name will be displayed alongside your logo in the top bar and public views.
                    </p>
                  </div>
                </div>
              </div>

              {/* Brand Identity card */}
              <div className="bg-white rounded-3xl border border-border-theme/30 p-5 space-y-4">
                <div>
                  <p className="text-sm font-black text-title">{t.settings.branding_section.palette}</p>
                  <p className="text-xs text-subtitle/50 mt-0.5">{t.settings.branding_section.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {BRAND_PALETTES.map((palette) => {
                    const isSelected = selectedPalette === palette.id;
                    return (
                      <button
                        key={palette.id}
                        onClick={() => setSelectedPalette(palette.id)}
                        className={`relative w-10 h-10 rounded-2xl transition-all active:scale-95 ${palette.base} ${
                          isSelected ? "ring-2 ring-offset-2 ring-brand shadow-md" : "opacity-80"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Asset Defaults card */}
              <div className="bg-white rounded-3xl border border-border-theme/30 p-5 space-y-4">
                <div>
                  <p className="text-sm font-black text-title">{t.settings.asset_section.title}</p>
                  <p className="text-xs text-subtitle/50 mt-0.5">{t.settings.asset_section.subtitle}</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ASSET_ICONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedIcon === item.id;
                    const iconLabel = (t.settings.asset_section.icons as Record<string, string>)[item.id] || item.label;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedIcon(item.id)}
                        className={`flex flex-col items-center justify-center py-3 px-1 rounded-2xl border-2 transition-all gap-1.5 ${
                          isSelected
                            ? "bg-brand/5 border-brand shadow-sm"
                            : "bg-white border-border-theme/30"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? "text-brand" : "text-subtitle/40"}`} strokeWidth={1.5} />
                        <span className={`text-[10px] font-semibold text-center leading-tight ${isSelected ? "text-brand" : "text-subtitle/50"}`}>{iconLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : activeTab === "my_profile" ? (

            /* ── My Profile ── */
            <div className="p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">

              {/* User info card */}
              <div className="bg-white rounded-3xl border border-border-theme/30 p-5">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-brand/5 flex items-center justify-center ring-1 ring-border-theme/20">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt={profileName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-black text-brand select-none">
                          {profileName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-white shadow flex items-center justify-center cursor-pointer active:scale-95 transition-all">
                      <Pencil className="w-3 h-3" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.heic,.heif"
                        onChange={handleAvatarSelect}
                      />
                    </label>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={() => { setAvatarPreview(null); setAvatarFile(null); setRemoveAvatar(true); }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center active:scale-90 transition-all"
                        aria-label="Quitar foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Name + status */}
                  <div className="min-w-0">
                    <p className="text-base font-black text-title leading-tight truncate">{profileName || user?.email}</p>
                    <span className={`mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                      user?.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user?.is_active ? "bg-green-500" : "bg-red-500"}`} />
                      {user?.is_active ? t.common.active : t.common.inactive}
                    </span>
                  </div>
                </div>

                {/* Org + Role row */}
                <div className="mt-4 pt-4 border-t border-border-theme/15 grid grid-cols-2 gap-3">
                  {user?.organization?.name && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-subtitle/40">{t.settings.user_profile_section.organization}</p>
                      <p className="text-sm font-semibold text-title mt-0.5 truncate">{user.organization.name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-subtitle/40">{t.settings.user_profile_section.role}</p>
                    <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                      user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
                        ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                        : user?.role === "WORKER"
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {user?.role === "SUPER_ADMIN" ? "Super Admin"
                        : user?.role === "ADMIN" ? t.users.modal.roles.admin
                        : user?.role === "WORKER" ? t.users.modal.roles.worker
                        : t.users.modal.roles.external}
                    </span>
                  </div>
                </div>
              </div>

              {/* Personal Details card */}
              <div className="bg-white rounded-3xl border border-border-theme/30 p-5 space-y-4">
                <div>
                  <p className="text-sm font-black text-title">{t.settings.user_profile_section.title}</p>
                  <p className="text-xs text-subtitle/50 mt-0.5">{t.settings.user_profile_section.subtitle}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-subtitle/50">{t.settings.user_profile_section.name}</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-subtitle/50">{t.settings.user_profile_section.email}</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={e => setProfileEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-subtitle/50">{t.settings.user_profile_section.phone}</label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={e => setProfilePhone(e.target.value)}
                      placeholder="+56 9 0000 0000"
                      className="w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand placeholder:text-subtitle/30 placeholder:font-normal"
                    />
                  </div>

                </div>
              </div>

            </div>

          ) : activeTab === "security" ? (

            /* ── Security ── */
            <MobileSecurityTab t={t} />

          ) : activeTab === "notifications" ? (

            /* ── Notifications ── */
            <MobileNotificationsTab t={t} />
          ) : activeTab === "ai" && canManageAiSettings ? (
            <MobileAiSettingsTab />

          ) : activeTab === "plans" ? (
            <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <PlanStatusCard />
            </div>

          ) : (
            /* Coming soon for other tabs */
            <div className="flex flex-col items-center justify-center gap-3 py-32 text-center animate-in fade-in duration-300">
              {(() => {
                const activeTabData = tabs.find(tb => tb.id === activeTab);
                const Icon = activeTabData?.icon;
                return (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-app-bg/80 border border-border-theme/30 flex items-center justify-center">
                      {Icon && <Icon className="w-6 h-6 text-subtitle/30" strokeWidth={1.5} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-title/60">{activeTabData?.label}</p>
                      <p className="text-xs text-subtitle/40 mt-0.5">Próximamente</p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Sticky bottom actions — profile & my_profile tabs */}
        {(activeTab === "profile" || activeTab === "my_profile") && (
          <div className="fixed bottom-[4.5rem] left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border-theme/20 px-4 py-4 flex items-center gap-3 z-30">
            <button
              type="button"
              onClick={() => {
                if (activeTab === "profile" && org) {
                  setOrgName(org.name || "");
                  setShowOrgName(org.show_org_name ?? false);
                  setLogoPreview(org.logo_url || null);
                  setLogoFile(null);
                  const found = BRAND_PALETTES.find(p => p.id === org.brand_color || p.name === org.brand_color);
                  setSelectedPalette(found?.id || "fentri");
                  if (org.default_asset_icon) setSelectedIcon(org.default_asset_icon);
                } else if (activeTab === "my_profile" && user) {
                  setProfileName(user.name || "");
                  setProfileEmail(user.email || "");
                  setProfilePhone((user as any).phone || "");
                  setAvatarFile(null);
                  setAvatarPreview(user.avatar_url || null);
                }
              }}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-subtitle/60 border border-border-theme/40 hover:bg-app-bg/80 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={activeTab === "profile" ? handleSave : handleProfileSave}
              disabled={activeTab === "profile" ? mutation.isPending : profileMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 active:scale-95 text-white py-3 rounded-2xl text-sm font-semibold transition-all shadow-sm shadow-brand/20 disabled:opacity-50"
            >
              {(activeTab === "profile" ? mutation.isPending : profileMutation.isPending)
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop Settings ── */}
      <div className="hidden lg:flex flex-col space-y-6">
      {/* Horizontal Tabs Navigation */}
      <div className="flex items-center border-b border-border-theme/30">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "text-brand"
                  : "text-subtitle/50 hover:text-subtitle"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <div className="w-full">
        {/* Profile Section */}
        {activeTab === "profile" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ModuleContainer>
              <div className="divide-y divide-border-theme/20">

                {/* Organization profile */}
                <div className="px-8 py-7 space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-title">{t.settings.owner_section.title}</p>
                  </div>
                  <div className="flex items-stretch gap-0">
                    {/* Logo upload box */}
                    <div className="pr-8 shrink-0">
                      <div className="relative inline-block">
                        {logoPreview ? (
                          <>
                            <div className="w-52 h-44 rounded-2xl border-2 border-border-theme/20 bg-app-bg/40 overflow-hidden">
                              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-4" />
                            </div>
                            <label className="absolute -bottom-2 -right-2 bg-brand text-white p-3 rounded-2xl shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all">
                              <Pencil className="w-4 h-4" />
                              <input type="file" className="hidden" accept="image/*" onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const r = new FileReader();
                                r.onloadend = () => setLogoCropSrc(r.result as string);
                                r.readAsDataURL(file);
                                e.target.value = "";
                              }} />
                            </label>
                          </>
                        ) : (
                          <label className="cursor-pointer group block">
                            <div className="w-52 h-44 rounded-2xl border-2 border-dashed border-border-theme/40 bg-app-bg/40 flex flex-col items-center justify-center gap-2 transition-all group-hover:border-brand/40 group-hover:bg-brand/5 overflow-hidden">
                              <ImageIcon className="w-8 h-8 text-subtitle/30 group-hover:text-brand/40 transition-colors" strokeWidth={1.5} />
                              <span className="text-[11px] font-semibold text-subtitle/40 group-hover:text-brand/50 text-center leading-tight px-3 transition-colors">
                                {t.settings.owner_section.upload_logo}
                                <br />
                                <span className="font-normal text-[10px]">JPG, PNG or SVG. Max 1MB.</span>
                              </span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const r = new FileReader();
                              r.onloadend = () => setLogoCropSrc(r.result as string);
                              r.readAsDataURL(file);
                              e.target.value = "";
                            }} />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-border-theme/20 shrink-0" />

                    {/* Organization details */}
                    <div className="pl-8 space-y-5">
                      <p className="text-sm font-semibold text-title">{t.settings.owner_section.name}</p>

                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={orgName}
                          onChange={e => setOrgName(e.target.value)}
                          readOnly={!canManageOrgSettings}
                          className={`w-96 px-4 py-3 border-2 rounded-2xl text-sm text-title font-semibold outline-none transition-all shadow-sm ${
                            canManageOrgSettings
                              ? "bg-white border-border-theme/50 focus:ring-2 focus:ring-brand/15 focus:border-brand"
                              : "bg-app-bg/50 border-border-theme/40 opacity-70 cursor-default"
                          }`}
                        />
                      </div>

                      {/* Toggle: show org name */}
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showOrgName}
                          onClick={() => setShowOrgName(v => !v)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                            showOrgName ? "bg-brand" : "bg-border-theme/40"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                              showOrgName ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <div>
                          <p className="text-sm font-semibold text-title leading-tight">{t.settings.owner_section.show_org_name}</p>
                          <p className="text-xs text-subtitle/50 mt-1 max-w-xs leading-snug">
                            When enabled, the organization name will be displayed alongside your logo in the top bar and public views.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Brand identity */}
                <div className="px-8 py-7 space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-title">{t.settings.branding_section.palette}</p>
                    <p className="text-xs text-subtitle/50 mt-1">{t.settings.branding_section.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {BRAND_PALETTES.map((palette) => {
                      const isSelected = selectedPalette === palette.id;
                      const paletteName = (t.settings.branding_section.palettes as Record<string, string>)[palette.id] || palette.name;
                      return (
                        <button
                          key={palette.id}
                          onClick={() => setSelectedPalette(palette.id)}
                          title={paletteName}
                          className={`relative w-12 h-12 rounded-2xl transition-all hover:scale-105 active:scale-95 ${palette.base} ${
                            isSelected ? "ring-2 ring-offset-2 ring-brand shadow-lg" : "opacity-80 hover:opacity-100"
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white drop-shadow" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Asset defaults */}
                <div className="px-8 py-7 space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-title">{t.settings.asset_section.title}</p>
                    <p className="text-xs text-subtitle/50 mt-1">{t.settings.asset_section.subtitle}</p>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {ASSET_ICONS.map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedIcon === item.id;
                      const iconLabel = (t.settings.asset_section.icons as Record<string, string>)[item.id] || item.label;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedIcon(item.id)}
                          className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl border-2 transition-all gap-1.5 ${
                            isSelected
                              ? "bg-brand/5 border-brand shadow-sm"
                              : "bg-white border-border-theme/30 hover:border-border-theme/60 hover:bg-app-bg/50"
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${isSelected ? "text-brand" : "text-subtitle/40"}`} strokeWidth={1.5} />
                          <span className={`text-[10px] font-semibold text-center leading-tight ${isSelected ? "text-brand" : "text-subtitle/50"}`}>{iconLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer actions */}
                <div className="px-8 py-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (org) {
                        setOrgName(org.name || "");
                        setShowOrgName(org.show_org_name ?? false);
                        setLogoPreview(org.logo_url || null);
                        setLogoFile(null);
                        const found = BRAND_PALETTES.find(p => p.id === org.brand_color || p.name === org.brand_color);
                        setSelectedPalette(found?.id || "fentri");
                        if (org.default_asset_icon) setSelectedIcon(org.default_asset_icon);
                      }
                    }}
                    className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-subtitle/60 hover:text-title hover:bg-app-bg/80 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 bg-brand hover:bg-brand/90 active:scale-95 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all shadow-sm shadow-brand/20 disabled:opacity-50"
                  >
                    {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Save changes</span>
                  </button>
                </div>

              </div>
            </ModuleContainer>
          </div>
        )}

        {activeTab === "my_profile" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-[280px_1fr] gap-5 items-start">

              {/* Left card */}
              <ModuleContainer>
                <div className="p-8 flex flex-col items-center text-center">
                  {/* Avatar */}
                  <div className="relative mb-5">
                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-brand/5 flex items-center justify-center ring-1 ring-border-theme/20">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt={profileName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl font-black text-brand tracking-tighter select-none">
                          {profileName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <label className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-brand text-white shadow-lg shadow-brand/25 flex items-center justify-center cursor-pointer active:scale-95 hover:scale-105 transition-all">
                      <Camera className="w-4 h-4" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.heic,.heif"
                        onChange={handleAvatarSelect}
                      />
                    </label>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={() => { setAvatarPreview(null); setAvatarFile(null); setRemoveAvatar(true); }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center active:scale-90 transition-all"
                        aria-label="Quitar foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <p className="text-base font-black text-title">{profileName || user?.email}</p>

                  <span className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                    user?.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user?.is_active ? "bg-green-500" : "bg-red-500"}`} />
                    {user?.is_active ? t.common.active : t.common.inactive}
                  </span>

                  <div className="mt-6 w-full border-t border-border-theme/20 pt-5 space-y-5 text-left">
                    {user?.organization?.name && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-subtitle/40">{t.settings.user_profile_section.organization}</p>
                        <p className="text-sm font-semibold text-title mt-1">{user.organization.name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-subtitle/40">{t.settings.user_profile_section.role}</p>
                      <span className={`mt-1.5 inline-flex items-center px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                        user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
                          ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                          : user?.role === "WORKER"
                          ? "bg-amber-50 text-amber-600 border-amber-100"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {user?.role === "SUPER_ADMIN" ? "Super Admin"
                          : user?.role === "ADMIN" ? t.users.modal.roles.admin
                          : user?.role === "WORKER" ? t.users.modal.roles.worker
                          : t.users.modal.roles.external}
                      </span>
                    </div>
                  </div>
                </div>
              </ModuleContainer>

              {/* Right form */}
              <ModuleContainer>
                <div className="p-8 space-y-6">
                  <div>
                    <p className="text-base font-black text-title">{t.settings.user_profile_section.title}</p>
                    <p className="text-sm text-subtitle/50 mt-1">{t.settings.user_profile_section.subtitle}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-subtitle/50">
                        {t.settings.user_profile_section.name}
                      </label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        className="w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-subtitle/50">
                        {t.settings.user_profile_section.email}
                      </label>
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(event) => setProfileEmail(event.target.value)}
                        className="w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-subtitle/50">
                        {t.settings.user_profile_section.phone}
                      </label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(event) => setProfilePhone(event.target.value)}
                        placeholder="+56 9 0000 0000"
                        className="w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-lg text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand placeholder:text-subtitle/30 placeholder:font-normal"
                      />
                    </div>

                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleProfileSave}
                      disabled={profileMutation.isPending}
                      className="flex items-center gap-2 bg-brand hover:bg-brand/90 active:scale-95 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-md shadow-brand/20 disabled:opacity-50"
                    >
                      {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>{t.settings.user_profile_section.save}</span>
                    </button>
                  </div>
                </div>
              </ModuleContainer>

            </div>
          </div>
        )}
        {/* Plans */}
        {activeTab === "plans" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PlanStatusCard />
          </div>
        )}

        {/* Security */}
        {activeTab === "security" && (
          <SecurityTab t={t} />
        )}

        {/* Notifications */}
        {activeTab === "notifications" && (
          <NotificationsTab t={t} />
        )}

        {activeTab === "ai" && canManageAiSettings && (
          <AiSettingsTab />
        )}

      </div>
      </div>
    </div>
  );
}

function AiSettingsTab() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ModuleContainer>
        <OpenAiSettingsForm compact={false} />
      </ModuleContainer>
    </div>
  );
}

function MobileAiSettingsTab() {
  return (
    <div className="p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-3xl border border-border-theme/30">
        <OpenAiSettingsForm compact />
      </div>
    </div>
  );
}

function OpenAiSettingsForm({ compact }: { compact: boolean }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-5.4-nano");
  const [translationsEnabled, setTranslationsEnabled] = useState(false);
  const [createdAfter, setCreatedAfter] = useState("");

  const { data: settings, isLoading } = useQuery<OpenAiSettings>({
    queryKey: ["openai-settings"],
    queryFn: aiSettingsService.getOpenAi,
  });

  React.useEffect(() => {
    if (!settings) return;
    setModel(settings.model || "gpt-5.4-nano");
    setTranslationsEnabled(settings.translations_enabled);
    setCreatedAfter(settings.translate_services_created_after?.slice(0, 10) ?? "");
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => aiSettingsService.updateOpenAi({
      api_key: apiKey.trim() || undefined,
      model: model.trim() || "gpt-5.4-nano",
      translations_enabled: translationsEnabled,
      translate_services_created_after: createdAfter || null,
    }),
    onSuccess: async () => {
      setApiKey("");
      await queryClient.invalidateQueries({ queryKey: ["openai-settings"] });
      showToast("Configuracion OpenAI guardada", "success");
    },
    onError: () => showToast("No se pudo guardar OpenAI", "error"),
  });

  const testMutation = useMutation({
    mutationFn: aiSettingsService.testOpenAi,
    onSuccess: () => showToast("Conexion OpenAI correcta", "success"),
    onError: () => showToast("No se pudo validar OpenAI", "error"),
  });

  const inputClass = "w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand placeholder:text-subtitle/30";

  if (isLoading) {
    return (
      <div className={compact ? "p-5" : "p-8"}>
        <div className="flex items-center gap-2 text-subtitle/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-bold">Cargando OpenAI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "p-5 space-y-5" : "p-8 space-y-6"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-black text-title">OpenAI</p>
          <p className="text-sm text-subtitle/50 mt-1">
            Configuracion global para traducir descripciones de servicios en toda la plataforma.
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
          settings?.api_key_configured ? "bg-green-50 text-green-600 border-green-100" : "bg-amber-50 text-amber-600 border-amber-100"
        }`}>
          {settings?.api_key_configured ? "Configurado" : "Pendiente"}
        </span>
      </div>

      <div className={compact ? "space-y-4" : "grid grid-cols-2 gap-5"}>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-subtitle/50">API key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={settings?.api_key_hint ? `Actual: ${settings.api_key_hint}` : "sk-..."}
            className={inputClass}
          />
          <p className="text-[11px] text-subtitle/45">Se guarda cifrada. Si dejas este campo vacio, se mantiene la key actual.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-subtitle/50">Modelo</label>
          <input
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-subtitle/50">Traducir solo servicios creados desde</label>
          <input
            type="date"
            value={createdAfter}
            onChange={(event) => setCreatedAfter(event.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setCreatedAfter("")}
            className="text-[11px] font-black uppercase tracking-wider text-brand"
          >
            Quitar limite de fecha
          </button>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border-theme/30 bg-app-bg/30 p-4">
          <button
            type="button"
            role="switch"
            aria-checked={translationsEnabled}
            onClick={() => setTranslationsEnabled((value) => !value)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              translationsEnabled ? "bg-brand" : "bg-border-theme/40"
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${translationsEnabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <div>
            <p className="text-sm font-bold text-title">Traduccion automatica</p>
            <p className="text-xs text-subtitle/50 mt-0.5">Traduce bajo demanda y cachea por servicio, idioma y hash.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-border-theme/20 pt-5">
        <button
          type="button"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !settings?.api_key_configured}
          className="flex items-center gap-2 rounded-2xl border border-border-theme/40 px-5 py-2.5 text-sm font-bold text-subtitle/70 transition-all hover:bg-app-bg disabled:opacity-40"
        >
          {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Probar conexion
        </button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar OpenAI
        </button>
      </div>
    </div>
  );
}

function NotificationsTab({ t }: { t: any }) {
  const n = t.settings.notifications_section;
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [systemLogs, setSystemLogs] = useState(true);

  React.useEffect(() => {
    if (!user) return;
    setEmailAlerts(user.email_notifications_enabled ?? true);
    setSystemLogs(user.security_alerts_enabled ?? true);
  }, [user]);

  const prefsMutation = useMutation({
    mutationFn: usersService.updateNotificationPreferences,
    onSuccess: () => refreshUser(),
    onError: () => showToast(n.save_error, "error"),
  });

  const toggle = (key: "email_alerts" | "system_logs") => {
    if (key === "email_alerts") {
      const next = !emailAlerts;
      setEmailAlerts(next);
      prefsMutation.mutate(
        { email_notifications_enabled: next },
        { onError: () => setEmailAlerts(!next) },
      );
    } else {
      const next = !systemLogs;
      setSystemLogs(next);
      prefsMutation.mutate(
        { security_alerts_enabled: next },
        { onError: () => setSystemLogs(!next) },
      );
    }
  };

  const items = [
    { key: "email_alerts" as const,    icon: Mail,       name: n.email_alerts_name,    desc: n.email_alerts_desc,    active: true,  checked: emailAlerts },
    { key: "system_logs" as const,     icon: Database,   name: n.system_logs_name,     desc: n.system_logs_desc,     active: true,  checked: systemLogs  },
    { key: "weekly_summary" as const,  icon: AlignLeft,  name: n.weekly_summary_name,  desc: n.weekly_summary_desc,  active: false, checked: false        },
    { key: "newsletter" as const,      icon: Megaphone,  name: n.newsletter_name,      desc: n.newsletter_desc,      active: false, checked: false        },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ModuleContainer>
        <div className="p-8 space-y-6">

          <div>
            <p className="text-base font-black text-title">{n.title}</p>
            <p className="text-sm text-subtitle/50 mt-1">{n.subtitle}</p>
          </div>

          <div className="space-y-3">
            {items.map(({ key, icon: Icon, name, desc, active, checked }) => {
              return (
                <div
                  key={key}
                  className={`flex items-center gap-4 p-4 rounded-2xl border border-border-theme/30 bg-app-bg/30 transition-all ${active ? "" : "opacity-70"}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-border-theme/25 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-subtitle/40" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-title">{name}</p>
                      {!active && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-border-theme/60 text-subtitle/50 border border-border-theme">
                          Proximamente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-subtitle/50 mt-0.5">{desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={!active}
                    onClick={() => active && toggle(key as "email_alerts" | "system_logs")}
                    className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${
                      !active
                        ? "bg-border-theme/40 cursor-not-allowed"
                        : checked
                        ? "bg-brand"
                        : "bg-border-theme/40"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        active && checked ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      </ModuleContainer>
    </div>
  );
}

function TwoFactorAppPanel({ s, compact = false }: { s: any; compact?: boolean }) {
  const { showToast } = useToast();
  const { language } = useLanguage();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBackupCodesOpen, setIsBackupCodesOpen] = useState(false);
  const [isDisableOpen, setIsDisableOpen] = useState(false);

  const { data: twoFaStatus, isLoading } = useQuery({
    queryKey: ["2fa-status"],
    queryFn: authService.getTwoFactorStatus,
  });

  const isEnabled = !!(twoFaStatus?.enabled && twoFaStatus?.method === 'app');
  const isOtherMethodActive = !!(twoFaStatus?.enabled && twoFaStatus?.method !== 'app');
  const backupCount = isEnabled ? (twoFaStatus?.backup_codes_remaining ?? 0) : 0;

  React.useEffect(() => {
    let cancelled = false;

    if (!setup?.otpauth_url) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(setup.otpauth_url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: compact ? 180 : 220,
      color: {
        dark: "#111827",
        light: "#FFFFFF",
      },
    })
      .then(dataUrl => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl("");
          showToast("No se pudo generar el QR 2FA", "error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [compact, setup?.otpauth_url, showToast]);

  const inputClass = compact
    ? "w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand"
    : "w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand";

  const startSetup = async () => {
    setIsWorking(true);
    setBackupCodes([]);
    try {
      const data = await authService.setupTwoFactor();
      setSetup(data);
      setQrDataUrl("");
      setIsQrOpen(true);
      setCode("");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo iniciar 2FA";
      showToast(Array.isArray(msg) ? msg[0] : msg, "error");
    } finally {
      setIsWorking(false);
    }
  };

  const verifySetup = async () => {
    if (!setup || !code.trim()) return;
    setIsWorking(true);
    try {
      const result = await authService.verifyTwoFactorSetup(setup.setup_token, code, language);
      setBackupCodes(result.backup_codes);
      setSetup(null);
      setIsQrOpen(false);
      setIsBackupCodesOpen(true);
      setCode("");
      await queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
      await refreshUser();
      showToast("2FA activado correctamente", "success");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Codigo 2FA invalido";
      showToast(Array.isArray(msg) ? msg[0] : msg, "error");
    } finally {
      setIsWorking(false);
    }
  };

  const cancelSetup = () => {
    setSetup(null);
    setIsQrOpen(false);
    setQrDataUrl("");
    setCode("");
  };

  const disable = async () => {
    if (!disableCode.trim()) return;
    setIsWorking(true);
    try {
      await authService.disableTwoFactor(disableCode, language);
      setDisableCode("");
      setBackupCodes([]);
      setIsDisableOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
      await refreshUser();
      showToast("2FA desactivado", "success");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo desactivar 2FA";
      showToast(Array.isArray(msg) ? msg[0] : msg, "error");
    } finally {
      setIsWorking(false);
    }
  };

  const qrModal = setup && isQrOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      onClick={cancelSetup}
    >
      <div
        className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl border border-border-theme/20 overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-theme/20 px-5 py-4">
          <div>
            <p className="text-base font-black text-title">Escanear QR 2FA</p>
            <p className="text-xs text-subtitle/50 mt-0.5">Google Authenticator o Microsoft Authenticator</p>
          </div>
          <button
            type="button"
            onClick={cancelSetup}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border-theme/30 text-subtitle hover:bg-app-bg"
            aria-label="Cerrar QR 2FA"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex justify-center">
            <div className="rounded-3xl border border-border-theme/30 bg-white p-3 shadow-sm">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR para configurar autenticacion de dos factores"
                  className="h-[220px] w-[220px]"
                />
              ) : (
                <div className="grid h-[220px] w-[220px] place-items-center rounded-2xl bg-app-bg text-xs font-bold text-subtitle/50">
                  Generando QR...
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-app-bg/60 border border-border-theme/20 p-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-subtitle/40">Clave manual</p>
            <p className="break-all font-mono text-sm font-black tracking-wider text-title">{setup.secret}</p>
          </div>

          <details className="text-xs text-subtitle/50">
            <summary className="cursor-pointer font-bold text-brand">URI otpauth avanzado</summary>
            <p className="mt-2 break-all font-mono">{setup.otpauth_url}</p>
          </details>

          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Codigo de 6 digitos"
            className={inputClass}
            disabled={isWorking}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={verifySetup}
              disabled={isWorking || !code.trim()}
              className="flex-1 rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-sm shadow-brand/20 disabled:opacity-50"
            >
              Verificar y activar
            </button>
            <button
              type="button"
              onClick={cancelSetup}
              className="rounded-2xl border border-border-theme/50 px-4 py-3 text-sm font-bold text-subtitle"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const backupCodesModal = backupCodes.length > 0 && isBackupCodesOpen ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl border border-border-theme/20 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border-theme/20 px-5 py-4">
          <div>
            <p className="text-base font-black text-title">Codigos de recuperacion</p>
            <p className="text-xs text-subtitle/50 mt-0.5">Guardalos antes de cerrar esta ventana</p>
          </div>
          <button
            type="button"
            onClick={() => setIsBackupCodesOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border-theme/30 text-subtitle hover:bg-app-bg"
            aria-label="Cerrar codigos de recuperacion"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map(item => (
              <code key={item} className="rounded-xl bg-app-bg px-3 py-2 text-xs font-black text-title text-center">{item}</code>
            ))}
          </div>
          <p className="text-xs font-semibold text-amber-700">
            Estos codigos se muestran una sola vez. Cada codigo sirve una vez para recuperar el acceso si pierdes la app autenticadora.
          </p>
          <button
            type="button"
            onClick={() => setIsBackupCodesOpen(false)}
            className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-sm shadow-brand/20"
          >
            Ya los guarde
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const disableModal = isEnabled && isDisableOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      onClick={() => { setIsDisableOpen(false); setDisableCode(""); }}
    >
      <div
        className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl border border-border-theme/20 overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-theme/20 px-5 py-4">
          <div>
            <p className="text-base font-black text-title">Desactivar 2FA</p>
            <p className="text-xs text-subtitle/50 mt-0.5">Confirma tu identidad para cambiar esta proteccion</p>
          </div>
          <button
            type="button"
            onClick={() => { setIsDisableOpen(false); setDisableCode(""); }}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border-theme/30 text-subtitle hover:bg-app-bg"
            aria-label="Cerrar desactivacion 2FA"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-subtitle/60">
            Ingresa el codigo actual de tu app autenticadora para desactivar el doble factor.
          </p>
          <input
            value={disableCode}
            onChange={e => setDisableCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Codigo de autenticacion"
            className={inputClass}
            disabled={isWorking}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={disable}
              disabled={isWorking || !disableCode.trim()}
              className="flex-1 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-500 border border-red-100 disabled:opacity-50"
            >
              Desactivar
            </button>
            <button
              type="button"
              onClick={() => { setIsDisableOpen(false); setDisableCode(""); }}
              className="rounded-2xl border border-border-theme/50 px-4 py-3 text-sm font-bold text-subtitle"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {typeof document !== "undefined" && qrModal
        ? ReactDOM.createPortal(qrModal, document.body)
        : null}
      {typeof document !== "undefined" && backupCodesModal
        ? ReactDOM.createPortal(backupCodesModal, document.body)
        : null}
      {typeof document !== "undefined" && disableModal
        ? ReactDOM.createPortal(disableModal, document.body)
        : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={compact ? "text-sm font-black text-title" : "text-base font-black text-title"}>{s.twofa_title}</p>
          <p className={compact ? "text-xs text-subtitle/50 mt-0.5" : "text-sm text-subtitle/50 mt-1"}>{s.twofa_subtitle}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
          isEnabled ? "bg-green-50 text-green-600 border-green-100" : "bg-amber-50 text-amber-500 border-amber-100"
        }`}>
          {isLoading ? "..." : isEnabled ? s.twofa_status_active : s.twofa_status_inactive}
        </span>
      </div>

      <div className={`rounded-2xl border-2 p-4 ${isEnabled ? "border-brand/30 bg-brand/5" : "border-border-theme/30 bg-app-bg/40"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEnabled ? "bg-brand/10" : "bg-white border border-border-theme/30"}`}>
            <Smartphone className={`w-5 h-5 ${isEnabled ? "text-brand" : "text-subtitle/40"}`} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${isEnabled ? "text-brand" : "text-title"}`}>{s.twofa_app_name}</p>
            <p className="text-xs text-subtitle/50 mt-0.5">{s.twofa_app_desc}</p>
          </div>
          {isLoading ? (
            <span className="text-xs text-subtitle/40">...</span>
          ) : isEnabled ? (
            <button
              type="button"
              onClick={() => setIsDisableOpen(true)}
              disabled={isWorking}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 disabled:opacity-50"
            >
              {s.deactivate}
            </button>
          ) : isOtherMethodActive ? null : (
            !setup && (
              <button
                type="button"
                onClick={startSetup}
                disabled={isWorking}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand/90 disabled:opacity-50"
              >
                {isWorking ? "..." : s.activate}
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <TwoFactorEmailPanel s={s} compact={compact} />
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-border-theme/25 bg-app-bg/30 opacity-60">
          <MessageSquare className="w-4 h-4 text-subtitle/40" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-title">{s.twofa_sms_name}</p>
            <p className="text-[11px] text-subtitle/50">{s.twofa_sms_desc} · Proximamente</p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Info className="w-4 h-4 text-subtitle/30 shrink-0 mt-0.5" />
        <p className="text-xs text-subtitle/40">{s.twofa_footer}</p>
      </div>
    </div>
  );
}

function TwoFactorEmailPanel({ s, compact = false }: { s: any; compact?: boolean }) {
  const { showToast } = useToast();
  const { language } = useLanguage();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isBackupCodesOpen, setIsBackupCodesOpen] = useState(false);
  const [isDisableOpen, setIsDisableOpen] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const { data: twoFaStatus, isLoading } = useQuery({
    queryKey: ["2fa-status"],
    queryFn: authService.getTwoFactorStatus,
  });

  const isEnabled = !!(twoFaStatus?.enabled && twoFaStatus?.method === 'email');
  const isOtherMethodActive = !!(twoFaStatus?.enabled && twoFaStatus?.method !== 'email');

  const inputClass = compact
    ? "w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand"
    : "w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand";

  const sendCode = async () => {
    setIsWorking(true);
    try {
      await authService.sendTwoFactorEmailCode(language);
      setCodeSent(true);
      setCode("");
      showToast("Código enviado a tu correo", "success");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo enviar el código";
      showToast(Array.isArray(msg) ? msg[0] : msg, "error");
    } finally {
      setIsWorking(false);
    }
  };

  const verifySetup = async () => {
    if (!code.trim()) return;
    setIsWorking(true);
    try {
      const result = await authService.verifyTwoFactorEmailSetup(code, language);
      setBackupCodes(result.backup_codes);
      setCode("");
      setCodeSent(false);
      setIsSetupOpen(false);
      setIsBackupCodesOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
      await refreshUser();
      showToast("2FA por correo activado correctamente", "success");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Código inválido";
      showToast(Array.isArray(msg) ? msg[0] : msg, "error");
    } finally {
      setIsWorking(false);
    }
  };

  const disable = async () => {
    if (!code.trim()) return;
    setIsWorking(true);
    try {
      await authService.disableTwoFactorEmail(code, language);
      setCode("");
      setCodeSent(false);
      setIsDisableOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
      await refreshUser();
      showToast("2FA por correo desactivado", "success");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo desactivar 2FA";
      showToast(Array.isArray(msg) ? msg[0] : msg, "error");
    } finally {
      setIsWorking(false);
    }
  };

  const closeSetup = () => { setIsSetupOpen(false); setCode(""); setCodeSent(false); };
  const closeDisable = () => { setIsDisableOpen(false); setCode(""); setCodeSent(false); };

  const setupModal = isSetupOpen ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm" onClick={closeSetup}>
      <div className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl border border-border-theme/20 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-border-theme/20 px-5 py-4">
          <div>
            <p className="text-base font-black text-title">Activar 2FA por correo</p>
            <p className="text-xs text-subtitle/50 mt-0.5">Verifica tu correo electrónico</p>
          </div>
          <button type="button" onClick={closeSetup} className="grid h-9 w-9 place-items-center rounded-xl border border-border-theme/30 text-subtitle hover:bg-app-bg" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          {!codeSent ? (
            <>
              <p className="text-sm text-subtitle/60">Se enviará un código de 6 dígitos a tu correo electrónico para confirmar la activación.</p>
              <button type="button" onClick={sendCode} disabled={isWorking} className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-sm shadow-brand/20 disabled:opacity-50">
                {isWorking ? "Enviando..." : "Enviar código"}
              </button>
              <button type="button" onClick={closeSetup} className="w-full rounded-2xl border border-border-theme/50 px-4 py-3 text-sm font-bold text-subtitle">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-subtitle/60">Ingresa el código de 6 dígitos enviado a tu correo.</p>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos" className={inputClass} disabled={isWorking} autoFocus />
              <div className="flex gap-2">
                <button type="button" onClick={verifySetup} disabled={isWorking || !code.trim()} className="flex-1 rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-sm shadow-brand/20 disabled:opacity-50">
                  Verificar y activar
                </button>
                <button type="button" onClick={sendCode} disabled={isWorking} className="rounded-2xl border border-border-theme/50 px-4 py-3 text-sm font-bold text-subtitle disabled:opacity-50">
                  Reenviar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const backupCodesModal = backupCodes.length > 0 && isBackupCodesOpen ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl border border-border-theme/20 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border-theme/20 px-5 py-4">
          <div>
            <p className="text-base font-black text-title">Codigos de recuperacion</p>
            <p className="text-xs text-subtitle/50 mt-0.5">Guardalos antes de cerrar esta ventana</p>
          </div>
          <button type="button" onClick={() => setIsBackupCodesOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-border-theme/30 text-subtitle hover:bg-app-bg" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map(item => (
              <code key={item} className="rounded-xl bg-app-bg px-3 py-2 text-xs font-black text-title text-center">{item}</code>
            ))}
          </div>
          <p className="text-xs font-semibold text-amber-700">
            Estos codigos se muestran una sola vez. Cada codigo sirve una vez si no tienes acceso a tu correo.
          </p>
          <button type="button" onClick={() => setIsBackupCodesOpen(false)} className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-sm shadow-brand/20">
            Ya los guarde
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const disableModal = isEnabled && isDisableOpen ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm" onClick={closeDisable}>
      <div className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl border border-border-theme/20 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-border-theme/20 px-5 py-4">
          <div>
            <p className="text-base font-black text-title">Desactivar 2FA por correo</p>
            <p className="text-xs text-subtitle/50 mt-0.5">Confirma con un código para desactivar</p>
          </div>
          <button type="button" onClick={closeDisable} className="grid h-9 w-9 place-items-center rounded-xl border border-border-theme/30 text-subtitle hover:bg-app-bg" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          {!codeSent ? (
            <>
              <p className="text-sm text-subtitle/60">Se enviará un código de verificación a tu correo para confirmar la desactivación.</p>
              <button type="button" onClick={sendCode} disabled={isWorking} className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-500 border border-red-100 disabled:opacity-50">
                {isWorking ? "Enviando..." : "Enviar código"}
              </button>
              <button type="button" onClick={closeDisable} className="w-full rounded-2xl border border-border-theme/50 px-4 py-3 text-sm font-bold text-subtitle">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-subtitle/60">Ingresa el código enviado a tu correo para desactivar 2FA.</p>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos" className={inputClass} disabled={isWorking} autoFocus />
              <div className="flex gap-2">
                <button type="button" onClick={disable} disabled={isWorking || !code.trim()} className="flex-1 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-500 border border-red-100 disabled:opacity-50">
                  Desactivar
                </button>
                <button type="button" onClick={closeDisable} className="rounded-2xl border border-border-theme/50 px-4 py-3 text-sm font-bold text-subtitle">
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {typeof document !== "undefined" && setupModal ? ReactDOM.createPortal(setupModal, document.body) : null}
      {typeof document !== "undefined" && backupCodesModal ? ReactDOM.createPortal(backupCodesModal, document.body) : null}
      {typeof document !== "undefined" && disableModal ? ReactDOM.createPortal(disableModal, document.body) : null}

      <div className={`rounded-2xl border-2 p-4 ${isEnabled ? "border-brand/30 bg-brand/5" : "border-border-theme/30 bg-app-bg/40"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEnabled ? "bg-brand/10" : "bg-white border border-border-theme/30"}`}>
            <Mail className={`w-5 h-5 ${isEnabled ? "text-brand" : "text-subtitle/40"}`} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${isEnabled ? "text-brand" : "text-title"}`}>{s.twofa_email_name}</p>
            <p className="text-xs text-subtitle/50 mt-0.5">{s.twofa_email_desc}</p>
          </div>
          {isLoading ? (
            <span className="text-xs text-subtitle/40">...</span>
          ) : isEnabled ? (
            <button type="button" onClick={() => { setIsDisableOpen(true); setCodeSent(false); }} disabled={isWorking} className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 disabled:opacity-50">
              {s.deactivate}
            </button>
          ) : isOtherMethodActive ? (
            <span className="text-[10px] font-semibold text-subtitle/30 text-right leading-tight max-w-[80px]">Desactiva el método actual primero</span>
          ) : (
            <button type="button" onClick={() => { setIsSetupOpen(true); setCodeSent(false); }} disabled={isWorking} className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand/90 disabled:opacity-50">
              {s.activate}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function SecurityTab({ t }: { t: any }) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const s = t.settings.security_section;

  const inputClass = "w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 gap-5 items-start">

        {/* Left — Password */}
        <ModuleContainer>
          <div className="p-8 space-y-6">
            <div>
              <p className="text-base font-black text-title">{s.password_title}</p>
              <p className="text-sm text-subtitle/50 mt-1">{s.password_subtitle}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-subtitle/40">{s.current_password}</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-subtitle/30 hover:text-subtitle/60 transition-colors">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-subtitle/40">{s.new_password}</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-subtitle/30 hover:text-subtitle/60 transition-colors">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-subtitle/40">{s.confirm_password}</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-subtitle/30 hover:text-subtitle/60 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="w-full py-3 rounded-2xl bg-brand text-white text-sm font-black tracking-tight transition-all hover:bg-brand/90 active:scale-95 shadow-md shadow-brand/20"
            >
              {s.update_password}
            </button>
          </div>
        </ModuleContainer>

        {/* Right — 2FA */}
        <ModuleContainer>
          <div className="p-8 space-y-6">
            <TwoFactorAppPanel s={s} />
          </div>
        </ModuleContainer>

      </div>

      {/* Devices section */}
      <div className="mt-5">
        <DevicesSection s={s} />
      </div>
    </div>
  );
}

type DeviceType = {
  id: string;
  name: string;
  os: string;
  browser: string;
  location: string;
  ip: string;
  firstAccess: string;
  lastSeen: string | null;
  isCurrent: boolean;
  kind: "laptop" | "mobile" | "desktop";
};

const MOCK_DEVICES: DeviceType[] = [
  {
    id: "1",
    name: 'MacBook Pro 16"',
    os: "macOS Sonoma",
    browser: "Chrome v126.0",
    location: "Santiago, Región Metro.",
    ip: "186.105.21.9",
    firstAccess: "May 10, 2026 · 09:14 AM",
    lastSeen: null,
    isCurrent: true,
    kind: "laptop",
  },
  {
    id: "2",
    name: "iPhone 15 Pro Max",
    os: "iOS 17.5.1",
    browser: "Yates App v2.4",
    location: "Valparaíso, Provincia",
    ip: "201.214.155.8",
    firstAccess: "May 18, 2026 · 03:42 PM",
    lastSeen: "2h ago",
    isCurrent: false,
    kind: "mobile",
  },
  {
    id: "3",
    name: "Windows Desktop PC",
    os: "Windows 11 Enterprise",
    browser: "Microsoft Edge v125",
    location: "Miami, Florida (US)",
    ip: "104.148.22.41",
    firstAccess: "Feb 20, 2026 · 06:15 PM",
    lastSeen: "1 week ago",
    isCurrent: false,
    kind: "desktop",
  },
  {
    id: "4",
    name: "iPad Pro M2",
    os: "iPadOS 17.4",
    browser: "Safari v17.4",
    location: "Buenos Aires, AR",
    ip: "190.220.31.7",
    firstAccess: "Apr 02, 2026 · 11:30 AM",
    lastSeen: "3 days ago",
    isCurrent: false,
    kind: "mobile",
  },
];

function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLastSeen(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapSessionToDevice(session: AuthSession): DeviceType {
  const type = session.device_type || "desktop";
  return {
    id: session.id,
    name: session.device_name || "Unknown Device",
    os: session.os || "Unknown OS",
    browser: session.browser || "Unknown browser",
    location: session.location || "Unknown location",
    ip: session.ip_address || "Unknown IP",
    firstAccess: formatSessionDate(session.first_seen_at),
    lastSeen: session.is_current ? null : formatLastSeen(session.last_seen_at),
    isCurrent: session.is_current,
    kind: type === "mobile" || type === "tablet" ? "mobile" : type === "desktop" ? "desktop" : "laptop",
  };
}

function DeviceIcon({ kind, active }: { kind: DeviceType["kind"]; active: boolean }) {
  const cls = `w-5 h-5 ${active ? "text-brand" : "text-subtitle/40"}`;
  if (kind === "laptop") return <Laptop className={cls} strokeWidth={1.5} />;
  if (kind === "mobile") return <Smartphone className={cls} strokeWidth={1.5} />;
  return <Monitor className={cls} strokeWidth={1.5} />;
}

function DevicesSection({ s }: { s: any }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: authService.getSessions,
  });

  const devices = sessions.map(mapSessionToDevice);
  const hasCurrentDevice = devices.some(device => device.isCurrent);
  const hasOnlyCurrentDevice = hasCurrentDevice && devices.length === 1;
  const hasOtherDevices = hasCurrentDevice && devices.some(device => !device.isCurrent);
  const [showOnlyCurrentMessage, setShowOnlyCurrentMessage] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: authService.revokeSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
      showToast("Sesión cerrada correctamente", "success");
    },
    onError: () => showToast("No se pudo cerrar la sesión", "error"),
  });

  const revokeOthersMutation = useMutation({
    mutationFn: authService.revokeOtherSessions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
      showToast("Se cerraron las demás sesiones", "success");
    },
    onError: () => showToast("No se pudieron cerrar las sesiones", "error"),
  });

  const removeDevice = (id: string) => revokeMutation.mutate(id);
  const handleRevokeOthers = () => {
    if (!hasOtherDevices) {
      setShowOnlyCurrentMessage(true);
      return;
    }
    setShowOnlyCurrentMessage(false);
    revokeOthersMutation.mutate();
  };

  return (
    <ModuleContainer>
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <p className="text-base font-black text-title">{s.devices_title}</p>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                  {devices.length} Active
                </span>
              </div>
              <p className="text-sm text-subtitle/50 mt-0.5">{s.devices_subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={revokeOthersMutation.isPending || !hasCurrentDevice}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-all active:scale-95 ${
              !hasOtherDevices ? "opacity-55 hover:bg-red-50" : ""
            }`}
          >
            {revokeOthersMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            {s.devices_signout_all}
          </button>
        </div>

        <div className="h-px bg-border-theme/20" />

        {/* Guardian banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4 text-amber-500" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-black text-amber-600 tracking-wider">{s.devices_guardian_title}</p>
            <p className="text-xs text-amber-600/80 mt-0.5">{s.devices_guardian_desc}</p>
          </div>
        </div>

        {/* Device cards — 4-col grid */}
        <div className="grid grid-cols-4 gap-3">
          {isLoading && (
            <div className="col-span-4 p-6 rounded-2xl border border-border-theme/30 bg-app-bg/30 text-sm font-bold text-subtitle/50">
              Cargando sesiones...
            </div>
          )}
          {!isLoading && hasOnlyCurrentDevice && showOnlyCurrentMessage && (
            <div className="col-span-4 p-4 rounded-2xl border border-brand/15 bg-brand/[0.03] text-xs font-bold text-brand">
              {s.devices_only_current}
            </div>
          )}
          {devices.map(device => (
            <div
              key={device.id}
              className={`relative flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all ${
                device.isCurrent
                  ? "border-brand/25 bg-brand/[0.03]"
                  : "border-border-theme/30 bg-app-bg/30"
              }`}
            >
              {/* Remove button */}
              {hasCurrentDevice && !device.isCurrent && (
                <button
                  type="button"
                  onClick={() => removeDevice(device.id)}
                  disabled={revokeMutation.isPending}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white border border-border-theme/30 flex items-center justify-center text-subtitle/30 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
                >
                  {revokeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                </button>
              )}

              {/* Icon + name */}
              <div className="flex items-start gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  device.isCurrent ? "bg-brand/10" : "bg-white border border-border-theme/25"
                }`}>
                  <DeviceIcon kind={device.kind} active={device.isCurrent} />
                </div>
                <div className="min-w-0 flex-1 pr-5">
                  <p className={`text-xs font-black leading-tight truncate ${device.isCurrent ? "text-brand" : "text-title"}`}>
                    {device.name}
                  </p>
                  <p className="text-[10px] text-subtitle/50 mt-0.5 leading-tight truncate">
                    {device.os} · {device.browser}
                  </p>
                </div>
              </div>

              {device.isCurrent && (
                <span className="self-start text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand text-white">
                  {s.devices_this_device}
                </span>
              )}

              {/* Location + IP */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-subtitle/30">{s.devices_location}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-brand/60 shrink-0" />
                    <p className="text-[10px] text-title/70 font-semibold truncate">{device.location}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-subtitle/30">{s.devices_ip}</p>
                  <p className="text-[10px] text-title/70 font-semibold mt-0.5 truncate">{device.ip}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-border-theme/15">
                <p className="text-[9px] text-subtitle/40">
                  <span className="font-semibold">{s.devices_first_access}</span>{" "}
                  {device.firstAccess}
                </p>
                {device.isCurrent ? (
                  <span className="text-[9px] font-black text-green-500 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                    {s.devices_active_now}
                  </span>
                ) : (
                  <span className="text-[9px] text-subtitle/40 font-semibold">{device.lastSeen}</span>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </ModuleContainer>
  );
}

function getTzOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
    return parts.find(p => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

const ALL_TIMEZONES: { value: string; label: string }[] = (() => {
  try {
    return (Intl as any).supportedValuesOf("timeZone").map((tz: string) => ({
      value: tz,
      label: `${tz} (${getTzOffset(tz)})`,
    }));
  } catch {
    return [{ value: "UTC", label: "UTC (GMT+0)" }];
  }
})();

function TimezoneSelect({ value, onChange, searchPlaceholder = "Search timezone...", noResults = "No results" }: { value: string; onChange: (v: string) => void; searchPlaceholder?: string; noResults?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() =>
    query.trim()
      ? ALL_TIMEZONES.filter(tz => tz.label.toLowerCase().includes(query.toLowerCase()))
      : ALL_TIMEZONES,
    [query]
  );

  const selected = ALL_TIMEZONES.find(tz => tz.value === value);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        const portal = document.getElementById("tz-portal");
        if (portal && !portal.contains(target)) {
          setOpen(false);
          setQuery("");
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const dropdown = open ? (
    <div
      id="tz-portal"
      style={dropdownStyle}
      className="z-[9999] bg-white border border-border-theme/50 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <div className="p-2 border-b border-border-theme/20">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full px-3 py-2 text-sm bg-app-bg/60 border border-border-theme/30 rounded-2xl outline-none focus:border-brand transition-all placeholder:text-subtitle/40"
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-subtitle/40 italic">{noResults}</p>
        ) : filtered.map(tz => (
          <button
            key={tz.value}
            type="button"
            onClick={() => { onChange(tz.value); setOpen(false); setQuery(""); }}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
              tz.value === value
                ? "bg-brand/10 text-brand font-semibold"
                : "text-title font-medium hover:bg-app-bg/80"
            }`}
          >
            {tz.label}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open ? () => { setOpen(false); setQuery(""); } : handleOpen}
        className="w-full flex items-center justify-between px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all hover:border-border-theme/70 focus:ring-2 focus:ring-brand/15 focus:border-brand"
      >
        <span className="truncate text-left">{selected?.label ?? value}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 ml-2 text-subtitle/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {typeof document !== "undefined" && dropdown
        ? ReactDOM.createPortal(dropdown, document.body)
        : null}
    </>
  );
}

function MobileNotificationsTab({ t }: { t: any }) {
  const n = t.settings.notifications_section;
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [systemLogs, setSystemLogs] = useState(true);

  React.useEffect(() => {
    if (!user) return;
    setEmailAlerts(user.email_notifications_enabled ?? true);
    setSystemLogs(user.security_alerts_enabled ?? true);
  }, [user]);

  const prefsMutation = useMutation({
    mutationFn: usersService.updateNotificationPreferences,
    onSuccess: () => refreshUser(),
    onError: () => showToast(n.save_error, "error"),
  });

  const toggle = (key: "email_alerts" | "system_logs") => {
    if (key === "email_alerts") {
      const next = !emailAlerts;
      setEmailAlerts(next);
      prefsMutation.mutate(
        { email_notifications_enabled: next },
        { onError: () => setEmailAlerts(!next) },
      );
    } else {
      const next = !systemLogs;
      setSystemLogs(next);
      prefsMutation.mutate(
        { security_alerts_enabled: next },
        { onError: () => setSystemLogs(!next) },
      );
    }
  };

  const items = [
    { key: "email_alerts" as const,   icon: Mail,      name: n.email_alerts_name,   desc: n.email_alerts_desc,   active: true,  checked: emailAlerts },
    { key: "system_logs" as const,    icon: Database,  name: n.system_logs_name,    desc: n.system_logs_desc,    active: true,  checked: systemLogs  },
    { key: "weekly_summary" as const, icon: AlignLeft, name: n.weekly_summary_name, desc: n.weekly_summary_desc, active: false, checked: false        },
    { key: "newsletter" as const,     icon: Megaphone, name: n.newsletter_name,     desc: n.newsletter_desc,     active: false, checked: false        },
  ];

  return (
    <div className="p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-3xl border border-border-theme/30 p-5 space-y-4">
        <div>
          <p className="text-sm font-black text-title">{n.title}</p>
          <p className="text-xs text-subtitle/50 mt-0.5">{n.subtitle}</p>
        </div>

        <div className="space-y-2">
          {items.map(({ key, icon: Icon, name, desc, active, checked }) => {
            return (
              <div
                key={key}
                className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 border-border-theme/30 bg-app-bg/30 transition-all ${active ? "" : "opacity-70"}`}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white border border-border-theme/20 transition-colors">
                  <Icon className="w-4 h-4 text-subtitle/40 transition-colors" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-title transition-colors">{name}</p>
                    {!active && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-border-theme/60 text-subtitle/50 border border-border-theme">
                        Proximamente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-subtitle/50 mt-0.5 leading-snug">{desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  disabled={!active}
                  onClick={() => active && toggle(key as "email_alerts" | "system_logs")}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
                    !active
                      ? "bg-border-theme/40 cursor-not-allowed"
                      : checked
                      ? "bg-brand"
                      : "bg-border-theme/40"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      active && checked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileSecurityTab({ t }: { t: any }) {
  const s = t.settings.security_section;

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: authService.getSessions,
  });

  const devices = sessions.map(mapSessionToDevice);
  const hasCurrentDevice = devices.some(device => device.isCurrent);
  const hasOnlyCurrentDevice = hasCurrentDevice && devices.length === 1;
  const hasOtherDevices = hasCurrentDevice && devices.some(device => !device.isCurrent);
  const [showOnlyCurrentMessage, setShowOnlyCurrentMessage] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: authService.revokeSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
      showToast("Sesión cerrada correctamente", "success");
    },
    onError: () => showToast("No se pudo cerrar la sesión", "error"),
  });

  const revokeOthersMutation = useMutation({
    mutationFn: authService.revokeOtherSessions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
      showToast("Se cerraron las demás sesiones", "success");
    },
    onError: () => showToast("No se pudieron cerrar las sesiones", "error"),
  });

  const removeDevice = (id: string) => revokeMutation.mutate(id);
  const handleRevokeOthers = () => {
    if (!hasOtherDevices) {
      setShowOnlyCurrentMessage(true);
      return;
    }
    setShowOnlyCurrentMessage(false);
    revokeOthersMutation.mutate();
  };

  const inputClass = "w-full px-4 py-3 border-2 border-border-theme/50 bg-white rounded-2xl text-sm text-title font-semibold shadow-sm outline-none transition-all focus:ring-2 focus:ring-brand/15 focus:border-brand";

  return (
    <div className="p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* Change Password */}
      <div className="bg-white rounded-3xl border border-border-theme/30 p-5 space-y-4">
        <div>
          <p className="text-sm font-black text-title">{s.password_title}</p>
          <p className="text-xs text-subtitle/50 mt-0.5">{s.password_subtitle}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-subtitle/50">{s.current_password}</label>
            <div className="relative">
              <input type={showCurrent ? "text" : "password"} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className={inputClass} />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-subtitle/30 hover:text-subtitle/60 transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-subtitle/50">{s.new_password}</label>
            <div className="relative">
              <input type={showNew ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)} className={inputClass} />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-subtitle/30 hover:text-subtitle/60 transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-subtitle/50">{s.confirm_password}</label>
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className={inputClass} />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-subtitle/30 hover:text-subtitle/60 transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="w-full py-3 rounded-2xl bg-brand text-white text-sm font-black tracking-tight transition-all hover:bg-brand/90 active:scale-95 shadow-md shadow-brand/20"
        >
          {s.update_password}
        </button>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-3xl border border-border-theme/30 p-5 space-y-4">
        <TwoFactorAppPanel s={s} compact />
      </div>

      {/* Active Devices */}
      <div className="bg-white rounded-3xl border border-border-theme/30 p-5 space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-title">{s.devices_title}</p>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
              {devices.length} Active
            </span>
          </div>
          <p className="text-xs text-subtitle/50">{s.devices_subtitle}</p>
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={revokeOthersMutation.isPending || !hasCurrentDevice}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-200 bg-red-50 active:scale-95 transition-all ${
              !hasOtherDevices ? "opacity-55" : ""
            }`}
          >
            {revokeOthersMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            {s.devices_signout_all}
          </button>
        </div>

        {/* Guardian banner */}
        <div className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-amber-50 border border-amber-100">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4 text-amber-500" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-black text-amber-600 tracking-wider">{s.devices_guardian_title}</p>
            <p className="text-xs text-amber-600/80 mt-0.5">{s.devices_guardian_desc}</p>
          </div>
        </div>

        {/* Device list */}
        <div className="space-y-2">
          {isLoadingSessions && (
            <div className="p-4 rounded-2xl border border-border-theme/30 bg-app-bg/30 text-xs font-bold text-subtitle/50">
              Cargando sesiones...
            </div>
          )}
          {!isLoadingSessions && hasOnlyCurrentDevice && showOnlyCurrentMessage && (
            <div className="p-3.5 rounded-2xl border border-brand/15 bg-brand/[0.03] text-xs font-bold text-brand">
              {s.devices_only_current}
            </div>
          )}
          {devices.map(device => (
            <div
              key={device.id}
              className={`relative flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${
                device.isCurrent ? "border-brand/25 bg-brand/[0.03]" : "border-border-theme/30 bg-app-bg/30"
              }`}
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                device.isCurrent ? "bg-brand/10" : "bg-white border border-border-theme/25"
              }`}>
                <DeviceIcon kind={device.kind} active={device.isCurrent} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-xs font-black leading-tight truncate ${device.isCurrent ? "text-brand" : "text-title"}`}>
                    {device.name}
                  </p>
                  {device.isCurrent && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand text-white shrink-0">
                      {s.devices_this_device}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-subtitle/50">{device.os} · {device.browser}</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-brand/60 shrink-0" />
                    <p className="text-[11px] text-title/70 font-semibold">{device.location}</p>
                  </div>
                  <p className="text-[11px] text-subtitle/40">{device.ip}</p>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <p className="text-[10px] text-subtitle/40">
                    <span className="font-semibold">{s.devices_first_access}</span> {device.firstAccess}
                  </p>
                  {device.isCurrent ? (
                    <span className="text-[10px] font-black text-green-500 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                      {s.devices_active_now}
                    </span>
                  ) : (
                    <span className="text-[10px] text-subtitle/40 font-semibold">{device.lastSeen}</span>
                  )}
                </div>
              </div>

              {/* Remove button */}
              {hasCurrentDevice && !device.isCurrent && (
                <button
                  type="button"
                  onClick={() => removeDevice(device.id)}
                  disabled={revokeMutation.isPending}
                  className="shrink-0 w-7 h-7 rounded-full bg-white border border-border-theme/30 flex items-center justify-center text-subtitle/30 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
                >
                  {revokeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// Minimalist Check Icon for selected items
function Check({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="4" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}
