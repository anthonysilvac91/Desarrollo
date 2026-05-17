"use client";

import React, { useState } from "react";
import { 
  Building2, 
  Camera, 
  Ship, 
  Car, 
  Home, 
  Square, 
  Palette, 
  Upload,
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
  AtSign,
  LockKeyhole
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import ModuleContainer from "@/components/ui/ModuleContainer";
import { organizationsService } from "@/services/organizations.service";
import { usersService } from "@/services/users.service";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/ToastContext";
import { useAuth } from "@/lib/AuthContext";

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
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { refreshUser, user } = useAuth();
  const canManageOrgSettings = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  
  // States for changes
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [showOrgName, setShowOrgName] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
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
    if (avatarFile) fd.append("avatar", avatarFile);
    if (newPassword) {
      fd.append("current_password", currentPassword);
      fd.append("new_password", newPassword);
    }
    profileMutation.mutate(fd);
  };

  const tabs = canManageOrgSettings
    ? [
        { id: "profile", label: t.settings.tabs.profile, icon: Building2 },
        { id: "my_profile", label: t.settings.tabs.my_profile, icon: UserIcon },
        { id: "branding_assets", label: t.settings.tabs.branding_assets, icon: Palette },
      ]
    : [{ id: "my_profile", label: t.settings.tabs.my_profile, icon: UserIcon }];

  const requestedTab = searchParams.get("tab");
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : tabs[0].id;

  const handleTabClick = (tabId: string) => {
    router.replace(tabId === "profile" ? "/settings" : `/settings?tab=${tabId}`);
  };

  if (canManageOrgSettings && isLoading) return <div className="p-20 text-center animate-pulse text-subtitle/40 font-black uppercase">Cargando...</div>;

  return (
    <div className="flex flex-col space-y-6">
      
      {/* Horizontal Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-border-theme/40 pb-px mb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center space-x-3 px-8 py-3.5 text-sm font-black transition-all rounded-2xl ${
                isActive ? "bg-brand/10 text-brand shadow-sm shadow-brand/5" : "text-subtitle/40 hover:text-subtitle hover:bg-app-bg/50"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-brand" : "opacity-40"}`} />
              <span className="tracking-tight uppercase tracking-[0.05em]">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full">
        {/* Profile Section */}
        {activeTab === "profile" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ModuleContainer>
              <div className="p-10 lg:p-14 space-y-12">
                 {/* Logo Upload Section */}
                 <div className="flex items-center space-x-12">
                    <div className="relative group shrink-0">
                      <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-[40px] bg-app-bg border-[3px] border-white shadow-2xl flex items-center justify-center overflow-hidden transition-all group-hover:scale-105">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-4" />
                        ) : (
                          <div className="flex flex-col items-center space-y-3 opacity-30">
                            <ImageIcon className="w-12 h-12 text-subtitle" strokeWidth={1.5} />
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-subtitle">{t.settings.owner_section.upload_logo}</span>
                          </div>
                        )}
                      </div>
                      <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center cursor-pointer hover:bg-brand hover:text-white hover:scale-110 active:scale-95 transition-all text-subtitle">
                        <Upload className="w-5 h-5" />
                        <input type="file" className="hidden" accept="image/*" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setLogoFile(file);
                            const r = new FileReader();
                            r.onloadend = () => setLogoPreview(r.result as string);
                            r.readAsDataURL(file);
                          }
                        }} />
                      </label>
                    </div>
                    <div className="space-y-2">
                       <p className="text-xs font-black text-brand uppercase tracking-[0.2em] mb-2">{t.settings.owner_section.title}</p>
                      <h3 className="text-2xl lg:text-3xl font-black text-title tracking-tight">{t.settings.owner_section.logo}</h3>
                      <p className="text-[15px] text-subtitle/50 font-medium max-w-sm leading-relaxed">{t.settings.owner_section.logo_help}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
                        {t.settings.owner_section.name}
                      </label>
                      <input
                        type="text"
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        readOnly={!canManageOrgSettings}
                        className={`w-full px-8 py-5 border rounded-3xl text-title font-bold outline-none transition-all ${
                          canManageOrgSettings
                            ? "bg-white border-border-theme/60 focus:ring-2 focus:ring-brand/10 focus:border-brand"
                            : "bg-app-bg/50 border-border-theme/40 opacity-70 cursor-default"
                        }`}
                      />
                      <label className="flex items-center space-x-3 cursor-pointer group mt-2 pl-1">
                        <div
                          onClick={() => setShowOrgName(v => !v)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            showOrgName ? "bg-brand border-brand" : "border-border-theme/40 bg-white"
                          }`}
                        >
                          {showOrgName && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-subtitle/60 group-hover:text-title transition-colors">
                          {t.settings.owner_section.show_org_name}
                        </span>
                      </label>
                    </div>
                 </div>

                 <div className="pt-6 flex justify-end">
                    <button 
                      onClick={handleSave}
                      disabled={mutation.isPending}
                      className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25 disabled:opacity-50"
                    >
                      {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 stroke-[3px]" />}
                      <span>{t.common.save}</span>
                    </button>
                 </div>
              </div>
            </ModuleContainer>
          </div>
        )}

        {activeTab === "my_profile" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ModuleContainer>
              <div className="p-10 lg:p-14 space-y-12">
                <div className="flex flex-col lg:flex-row lg:items-center gap-10">
                  <div className="relative group shrink-0 w-fit">
                    <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-full bg-app-bg border-[3px] border-white shadow-2xl flex items-center justify-center overflow-hidden transition-all group-hover:scale-105">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt={profileName} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-14 h-14 text-subtitle/25" strokeWidth={1.5} />
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center cursor-pointer hover:bg-brand hover:text-white hover:scale-110 active:scale-95 transition-all text-subtitle">
                      <Camera className="w-5 h-5" />
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

                  <div className="space-y-2">
                    <p className="text-xs font-black text-brand uppercase tracking-[0.2em] mb-2">{t.settings.user_profile_section.title}</p>
                    <h3 className="text-2xl lg:text-3xl font-black text-title tracking-tight">{profileName || user?.email}</h3>
                    <p className="text-[15px] text-subtitle/50 font-medium max-w-lg leading-relaxed">{t.settings.user_profile_section.subtitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
                      {t.settings.user_profile_section.name}
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-subtitle/25" />
                      <input
                        type="text"
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        className="w-full pl-14 pr-8 py-5 bg-white border border-border-theme/60 rounded-3xl text-title font-bold outline-none transition-all focus:ring-2 focus:ring-brand/10 focus:border-brand"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
                      {t.settings.user_profile_section.email}
                    </label>
                    <div className="relative">
                      <AtSign className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-subtitle/25" />
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(event) => setProfileEmail(event.target.value)}
                        className="w-full pl-14 pr-8 py-5 bg-white border border-border-theme/60 rounded-3xl text-title font-bold outline-none transition-all focus:ring-2 focus:ring-brand/10 focus:border-brand"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-50 pt-10 space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-2xl lg:text-3xl font-black text-title tracking-tight">{t.settings.user_profile_section.password_title}</h3>
                    <p className="text-sm text-subtitle/60 font-medium tracking-tight">{t.settings.user_profile_section.password_subtitle}</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
                        {t.settings.user_profile_section.current_password}
                      </label>
                      <div className="relative">
                        <LockKeyhole className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-subtitle/25" />
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          className="w-full pl-14 pr-8 py-5 bg-white border border-border-theme/60 rounded-3xl text-title font-bold outline-none transition-all focus:ring-2 focus:ring-brand/10 focus:border-brand"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
                        {t.settings.user_profile_section.new_password}
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="w-full px-8 py-5 bg-white border border-border-theme/60 rounded-3xl text-title font-bold outline-none transition-all focus:ring-2 focus:ring-brand/10 focus:border-brand"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
                        {t.settings.user_profile_section.confirm_password}
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="w-full px-8 py-5 bg-white border border-border-theme/60 rounded-3xl text-title font-bold outline-none transition-all focus:ring-2 focus:ring-brand/10 focus:border-brand"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button
                    onClick={handleProfileSave}
                    disabled={profileMutation.isPending}
                    className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25 disabled:opacity-50"
                  >
                    {profileMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 stroke-[3px]" />}
                    <span>{t.common.save}</span>
                  </button>
                </div>
              </div>
            </ModuleContainer>
          </div>
        )}

        {/* Identity & Assets Combined Section */}
        {activeTab === "branding_assets" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ModuleContainer>
              <div className="p-10 lg:p-14 space-y-10">
                
                {/* Color Selector */}
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h1 className="text-2xl lg:text-3xl font-black text-title tracking-tight">{t.settings.branding_section.palette}</h1>
                    <p className="text-sm text-subtitle/60 font-medium tracking-tight">{t.settings.branding_section.subtitle}</p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    {BRAND_PALETTES.map((palette) => {
                      const isSelected = selectedPalette === palette.id;
                      const paletteName = (t.settings.branding_section.palettes as Record<string, string>)[palette.id] || palette.name;
                      return (
                        <button
                          key={palette.id}
                          onClick={() => setSelectedPalette(palette.id)}
                          title={paletteName}
                          className={`relative p-1 rounded-[18px] transition-all bg-white border-2 hover:scale-105 active:scale-95 ${
                            isSelected ? "border-brand shadow-2xl shadow-brand/10" : "border-transparent"
                          }`}
                        >
                          <div className={`w-24 h-12 rounded-[14px] flex items-center justify-center space-x-1.5 ${palette.base}`}>
                            {palette.shades.map((shade, idx) => (
                              <div key={idx} className={`w-2 h-2 rounded-sm opacity-40 ${shade}`} />
                            ))}
                          </div>
                            {isSelected && (
                              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-brand rounded-full border-2 border-white flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Default Icons Section */}
                <div className="space-y-8 border-t border-gray-50 pt-10">
                  <div className="space-y-2">
                    <h1 className="text-2xl lg:text-3xl font-black text-title tracking-tight">{t.settings.asset_section.title}</h1>
                    <p className="text-sm text-subtitle/60 font-medium tracking-tight">{t.settings.asset_section.subtitle}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-8 gap-4">
                    {ASSET_ICONS.map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedIcon === item.id;
                      const iconLabel = (t.settings.asset_section.icons as Record<string, string>)[item.id] || item.label;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedIcon(item.id)}
                          className={`flex flex-col items-center justify-center p-5 rounded-[28px] border-2 transition-all ${
                            isSelected ? "bg-brand/5 border-brand shadow-xl shadow-brand/5" : "bg-app-bg/30 border-transparent hover:bg-app-bg"
                          }`}
                        >
                          <Icon className={`w-6 h-6 mb-2 ${isSelected ? "text-brand" : "text-subtitle/30"}`} />
                          <span className={`text-[9px] font-black uppercase tracking-widest text-center ${isSelected ? "text-brand" : "text-subtitle/40"}`}>{iconLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                    <button 
                      onClick={handleSave}
                      disabled={mutation.isPending}
                      className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25 disabled:opacity-50"
                    >
                      {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 stroke-[3px]" />}
                      <span>{t.common.save}</span>
                    </button>
                 </div>

              </div>
            </ModuleContainer>
          </div>
        )}
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
