import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronRight, Ship, Search, Loader2, AlertCircle, Inbox } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";
import { assetsService, Asset } from "@/services/assets.service";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery } from "@tanstack/react-query";

const AssetImage = ({ src, alt }: { src?: string; alt: string }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return <Ship className="w-6 h-6 text-brand opacity-30" />;
  }
  return <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setError(true)} />;
};

export default function WorkerHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const { data: assets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["assets"],
    queryFn: () => assetsService.findAll(),
  });

  const filteredAssets = assets.filter(asset => 
    asset.name.toLowerCase().includes(search.toLowerCase()) ||
    (asset.location?.toLowerCase().includes(search.toLowerCase())) ||
    (asset.client?.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-app-bg px-10 text-center">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="text-sm font-black text-subtitle/40 uppercase tracking-widest">{t.mobile.home.loading}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-app-bg px-10 text-center space-y-4">
        <div className="p-4 bg-error/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div>
          <h3 className="text-xl font-black text-title">{t.mobile.home.error_title}</h3>
          <p className="text-sm font-medium text-subtitle/60">{t.mobile.home.error_subtitle}</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="w-full py-4 bg-title text-white rounded-2xl font-black text-sm shadow-xl shadow-title/20 active:scale-95 transition-all"
        >
          {t.mobile.home.retry}
        </button>
      </div>
    );
  }

  return (
    <>
      <MobileHeader title={t.mobile.nav.assets} showBack={false} />
      
      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-24">
        
        <div className="mb-6">
          <h2 className="text-2xl font-black text-title tracking-tight mb-1">{t.mobile.home.greeting}, {user?.name?.split(' ')[0] || 'Worker'} 👋</h2>
          <p className="text-sm font-bold text-subtitle/60">{t.mobile.home.subtitle}</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full mb-8">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-subtitle opacity-30" />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-[22px] leading-5 bg-surface text-title placeholder:text-subtitle/30 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 text-base transition-all shadow-sm font-bold"
            placeholder={t.mobile.home.search_placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredAssets.map((asset) => (
          <div 
            key={asset.id}
            onClick={() => router.push(`/app/assets/${asset.id}`)}
            className="group active:scale-95 transition-transform duration-200 bg-surface rounded-3xl p-4 border border-border-theme/40 shadow-sm flex items-center cursor-pointer"
          >
            {/* Thumbnail */}
            <div className="w-[72px] h-[72px] bg-app-bg rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-border-theme/20 shadow-inner mr-4">
               <AssetImage src={asset.thumbnail_url} alt={asset.name} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
               <h3 className="text-base font-bold text-title truncate">{asset.name}</h3>
               <div className="flex items-center text-xs font-semibold text-subtitle/60 mt-1">
                 <MapPin className="w-3.5 h-3.5 mr-1 text-brand" />
                 <span className="truncate">{asset.location}</span>
               </div>
               <div className="text-[10px] font-black text-brand uppercase tracking-widest mt-1">
                 {asset.client?.name || t.common.unassigned}
               </div>
            </div>

            {/* Chevron Action */}
            <div className="flex-shrink-0 ml-2 w-8 h-8 rounded-full bg-app-bg flex items-center justify-center group-active:bg-brand group-active:text-white text-subtitle/30 transition-colors">
               <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        ))}
        </div>

        {/* Empty State */}
        {filteredAssets.length === 0 && (
           <div className="py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 bg-surface/30 rounded-[32px] border-2 border-dashed border-border-theme/20">
             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
               <Inbox className="w-8 h-8 text-subtitle opacity-20" />
             </div>
             <p className="text-base font-black text-title">{t.mobile.home.no_results_title}</p>
             <p className="text-sm font-medium text-subtitle/40 mt-1 px-8">{t.mobile.home.no_results_subtitle}</p>
           </div>
        )}
      </main>
    </>
  );
}
