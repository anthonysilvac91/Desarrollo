"use client";

import React, { useState } from "react";
import { 
  Building2, 
  Mail, 
  Phone, 
  Camera, 
  Ship, 
  Car, 
  Home, 
  Square, 
  Palette, 
  Upload,
  Save,
  ImageIcon,
  Globe,
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
  Loader2
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import ModuleContainer from "@/components/ui/ModuleContainer";
import { organizationsService } from "@/services/organizations.service";
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
  const { showToast } = useToast();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab ] = useState("profile");
  
  // States for changes
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  const { data: org, isLoading } = useQuery({
    queryKey: ["my-organization"],
    queryFn: () => organizationsService.getMyOrganization(),
  });

  const mutation = useMutation({
    mutationFn: (fd: FormData) => organizationsService.updateSettings(fd),
    onSuccess: () => {
      showToast(t.common?.success_message || "Cambios guardados", "success");
      queryClient.invalidateQueries({ queryKey: ["my-organization"] });
      refreshUser();
    },
    onError: () => showToast("Error al guardar cambios", "error"),
  });

  // Effect to sync initial state
  React.useEffect(() => {
    if (org) {
      if (org.logo_url) setLogoPreview(org.logo_url);
      if (org.brand_color) {
        const found = BRAND_PALETTES.find(p => p.id === org.brand_color || p.name === org.brand_color);
        setSelectedPalette(found?.id || "recall");
      }
      if (org.default_asset_icon) setSelectedIcon(org.default_asset_icon);
    }
  }, [org]);

  const handleSave = async () => {
    const fd = new FormData();
    if (logoFile) fd.append("logo", logoFile);
    if (selectedPalette) fd.append("brand_color", selectedPalette);
    if (selectedIcon) fd.append("default_asset_icon", selectedIcon);
    
    // Also include text fields if you want to make them dynamic (currently they are hardcoded placeholders)
    mutation.mutate(fd);
  };

  const tabs = [
    { id: "profile", label: t.settings.tabs.profile, icon: Building2 },
    { id: "branding_assets", label: t.settings.tabs.branding_assets, icon: Palette },
  ];

  if (isLoading) return <div className="p-20 text-center animate-pulse text-subtitle/40 font-black uppercase">Cargando...</div>;

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
              onClick={() => setActiveTab(tab.id)}
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
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-subtitle">{t.settings.company_section.upload_logo}</span>
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
                       <p className="text-xs font-black text-brand uppercase tracking-[0.2em] mb-2">{t.settings.company_section.title}</p>
                      <h3 className="text-2xl lg:text-3xl font-black text-title tracking-tight">{t.settings.company_section.logo}</h3>
                      <p className="text-[15px] text-subtitle/50 font-medium max-w-sm leading-relaxed">{t.settings.company_section.logo_help}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{t.settings.company_section.name}</label>
                      <input type="text" readOnly defaultValue={org?.name} className="w-full px-8 py-5 bg-app-bg/50 border border-border-theme/40 rounded-3xl text-title font-bold opacity-70 outline-none" />
                    </div>
                    {/* (Website, Email, etc could be added to schema later if needed) */}
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
                      const paletteName = (t.settings.branding_section.palettes as any)[palette.id] || palette.name;
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
                      const iconLabel = (t.settings.asset_section.icons as any)[item.id] || item.label;
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
