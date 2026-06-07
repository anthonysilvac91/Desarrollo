"use client";

import React, { useState } from "react";
import ReactDOM from "react-dom";
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
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import ModuleContainer from "@/components/ui/ModuleContainer";
import { organizationsService } from "@/services/organizations.service";
import { usersService } from "@/services/users.service";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import LogoCropModal from "@/components/ui/LogoCropModal";

const BRAND_PALETTES = [
  { id: "recall", name: "Recall Blue", base: "bg-blue-600", shades: ["bg-blue-400", "bg-blue-700", "bg-blue-900"] },
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
  { id: "camera", label: "Inspección", icon: Camera },
];

export default function SettingsPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { refreshUser, user } = useAuth();
  const canManageOrgSettings = user?.role === "ADMIN";
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
        setSelectedPalette(found?.id || "recall");
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
    if (newPassword) {
      fd.append("current_password", currentPassword);
      fd.append("new_password", newPassword);
    }
    profileMutation.mutate(fd);
  };

  const allTabs = [
    ...(canManageOrgSettings ? [{ id: "profile", label: t.settings.tabs.profile, icon: Building2 }] : []),
    { id: "my_profile",      label: t.settings.tabs.my_profile,    icon: UserIcon    },
    { id: "plans",           label: t.settings.tabs.plans,          icon: CreditCard  },
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
      {/* ── Mobile Settings ── */}
      <div className="lg:hidden flex flex-col">
        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-border-theme/30 scrollbar-none bg-white">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  isActive ? "text-brand" : "text-subtitle/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2 : 1.5} />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="pb-32">
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

        {/* Sticky bottom actions — only on profile tab */}
        {activeTab === "profile" && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border-theme/20 px-4 py-4 flex items-center gap-3 z-20">
            <button
              type="button"
              onClick={() => {
                if (org) {
                  setOrgName(org.name || "");
                  setShowOrgName(org.show_org_name ?? false);
                  setLogoPreview(org.logo_url || null);
                  setLogoFile(null);
                  const found = BRAND_PALETTES.find(p => p.id === org.brand_color || p.name === org.brand_color);
                  setSelectedPalette(found?.id || "recall");
                  if (org.default_asset_icon) setSelectedIcon(org.default_asset_icon);
                }
              }}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-subtitle/60 border border-border-theme/40 hover:bg-app-bg/80 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 active:scale-95 text-white py-3 rounded-2xl text-sm font-semibold transition-all shadow-sm shadow-brand/20 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save changes</span>
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
                        setSelectedPalette(found?.id || "recall");
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
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            setAvatarFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => setAvatarPreview(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
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

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-subtitle/50">
                        {t.settings.user_profile_section.timezone}
                      </label>
                      <TimezoneSelect
                        value={profileTimezone}
                        onChange={setProfileTimezone}
                        searchPlaceholder={language === "es" ? "Buscar zona horaria..." : "Search timezone..."}
                        noResults={language === "es" ? "Sin resultados" : "No results"}
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
        {/* Plans placeholder */}
        {activeTab === "plans" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ModuleContainer>
              <div className="px-8 py-16 flex flex-col items-center justify-center gap-3 text-center">
                <CreditCard className="w-10 h-10 text-subtitle/20" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-subtitle/40">{t.settings.tabs.plans}</p>
                <p className="text-xs text-subtitle/30">Próximamente</p>
              </div>
            </ModuleContainer>
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

      </div>
      </div>
    </div>
  );
}

function NotificationsTab({ t }: { t: any }) {
  const n = t.settings.notifications_section;

  const [enabled, setEnabled] = useState({
    email_alerts: true,
    system_logs: true,
    weekly_summary: true,
    newsletter: false,
  });

  const toggle = (key: keyof typeof enabled) =>
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));

  const items = [
    { key: "email_alerts" as const,    icon: Mail,       name: n.email_alerts_name,    desc: n.email_alerts_desc    },
    { key: "system_logs" as const,     icon: Database,   name: n.system_logs_name,     desc: n.system_logs_desc     },
    { key: "weekly_summary" as const,  icon: AlignLeft,  name: n.weekly_summary_name,  desc: n.weekly_summary_desc  },
    { key: "newsletter" as const,      icon: Megaphone,  name: n.newsletter_name,      desc: n.newsletter_desc      },
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
            {items.map(({ key, icon: Icon, name, desc }) => {
              const on = enabled[key];
              return (
                <div
                  key={key}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border-theme/30 bg-app-bg/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-brand" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-title">{name}</p>
                    <p className="text-xs text-subtitle/50 mt-0.5">{desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${
                      on ? "bg-brand" : "bg-border-theme/40"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        on ? "translate-x-6" : "translate-x-0"
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

function SecurityTab({ t }: { t: any }) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [twoFaMethod, setTwoFaMethod] = useState<"app" | "sms" | "email" | null>(null);

  const s = t.settings.security_section;

  const twoFaMethods = [
    {
      id: "app" as const,
      icon: Smartphone,
      name: s.twofa_app_name,
      desc: s.twofa_app_desc,
    },
    {
      id: "sms" as const,
      icon: MessageSquare,
      name: s.twofa_sms_name,
      desc: s.twofa_sms_desc,
    },
    {
      id: "email" as const,
      icon: Mail,
      name: s.twofa_email_name,
      desc: s.twofa_email_desc,
    },
  ];

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
              className="w-full py-3 rounded-2xl bg-title text-white text-sm font-black tracking-tight transition-all hover:bg-title/90 active:scale-95 shadow-md"
            >
              {s.update_password}
            </button>
          </div>
        </ModuleContainer>

        {/* Right — 2FA */}
        <ModuleContainer>
          <div className="p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-black text-title">{s.twofa_title}</p>
                <p className="text-sm text-subtitle/50 mt-1">{s.twofa_subtitle}</p>
              </div>
              <span className={`shrink-0 mt-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                twoFaMethod
                  ? "bg-green-50 text-green-600 border-green-100"
                  : "bg-amber-50 text-amber-500 border-amber-100"
              }`}>
                {twoFaMethod ? s.twofa_status_active : s.twofa_status_inactive}
              </span>
            </div>

            <div className="space-y-3">
              {twoFaMethods.map(method => {
                const Icon = method.icon;
                const isActive = twoFaMethod === method.id;
                return (
                  <div
                    key={method.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                      isActive
                        ? "border-brand/30 bg-brand/5"
                        : "border-border-theme/30 bg-app-bg/40"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? "bg-brand/10" : "bg-white border border-border-theme/30"
                    }`}>
                      <Icon className={`w-5 h-5 ${isActive ? "text-brand" : "text-subtitle/40"}`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isActive ? "text-brand" : "text-title"}`}>{method.name}</p>
                      <p className="text-xs text-subtitle/50 mt-0.5">{method.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwoFaMethod(isActive ? null : method.id)}
                      className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        isActive
                          ? "bg-red-50 text-red-500 border border-red-100 hover:bg-red-100"
                          : "bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand/90"
                      }`}
                    >
                      {isActive ? s.deactivate : s.activate}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 pt-1">
              <Info className="w-4 h-4 text-subtitle/30 shrink-0 mt-0.5" />
              <p className="text-xs text-subtitle/40">{s.twofa_footer}</p>
            </div>
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

function DeviceIcon({ kind, active }: { kind: DeviceType["kind"]; active: boolean }) {
  const cls = `w-5 h-5 ${active ? "text-brand" : "text-subtitle/40"}`;
  if (kind === "laptop") return <Laptop className={cls} strokeWidth={1.5} />;
  if (kind === "mobile") return <Smartphone className={cls} strokeWidth={1.5} />;
  return <Monitor className={cls} strokeWidth={1.5} />;
}

function DevicesSection({ s }: { s: any }) {
  const [devices, setDevices] = useState<DeviceType[]>(MOCK_DEVICES);

  const removeDevice = (id: string) => setDevices(prev => prev.filter(d => d.id !== id));

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
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
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
              {!device.isCurrent && (
                <button
                  type="button"
                  onClick={() => removeDevice(device.id)}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white border border-border-theme/30 flex items-center justify-center text-subtitle/30 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
                >
                  <X className="w-3 h-3" />
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
