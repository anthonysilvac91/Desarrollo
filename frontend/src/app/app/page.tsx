"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronRight, Activity, Calendar, Ship, Search } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";

// --- MOCK DATA ---
const MOCK_ASSETS = [
  { 
    id: "1", 
    name: "Lady Nelly", 
    category: "Motor Yacht - 24m", 
    location: "Marina Ibiza, Amarre 42", 
    status: "OPERATIVO",
    thumbnail_url: "https://images.unsplash.com/photo-1567899378494-47b22a2ad96a?auto=format&fit=crop&q=80&w=400&h=400",
    client: { name: "Roberto García" },
  },
  { 
    id: "2", 
    name: "Sea Breeze", 
    category: "Catamaran - 15m", 
    location: "Palma Royal Yacht Club", 
    status: "ATENCIÓN",
    thumbnail_url: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&q=80&w=400&h=400",
    client: { name: "Thomas Müller" },
  },
  { 
    id: "3", 
    name: "Azimut 58", 
    category: "Sailing Yacht - 18m", 
    location: "Puerto Banús, Dock 3", 
    status: "OPERATIVO",
    thumbnail_url: "https://images.unsplash.com/photo-1621275471769-e6aa3e15bb71?auto=format&fit=crop&q=80&w=400&h=400", 
    client: { name: "Elena Martínez" },
  }
];

const AssetImage = ({ src, alt }: { src: string; alt: string }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return <Ship className="w-6 h-6 text-brand opacity-30" />;
  }
  return <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setError(true)} />;
};

export default function WorkerHomePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filteredAssets = MOCK_ASSETS.filter(asset => 
    asset.name.toLowerCase().includes(search.toLowerCase()) ||
    asset.location.toLowerCase().includes(search.toLowerCase()) ||
    asset.client.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <MobileHeader title="Mis Activos" showBack={false} />
      
      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-24">
        
        <div className="mb-6">
          <h2 className="text-2xl font-black text-title tracking-tight mb-1">Hola, Alex 👋</h2>
          <p className="text-sm font-bold text-subtitle/60">Aquí están tus activos asignados.</p>
        </div>

        {/* Search Bar - Stylized as in FiltersBar but for mobile */}
        <div className="relative w-full mb-8">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-subtitle opacity-30" />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-[22px] leading-5 bg-surface text-title placeholder:text-subtitle/30 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/40 text-base transition-all shadow-sm font-bold"
            placeholder="Buscar barco, ubicación o cliente..."
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
                 {asset.client.name}
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
           <div className="py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
               <Search className="w-8 h-8 text-subtitle opacity-20" />
             </div>
             <p className="text-base font-bold text-title">No se encontraron resultados</p>
             <p className="text-sm font-medium text-subtitle/50 mt-1 px-8">Intenta buscar con otros términos o limpia el campo de búsqueda.</p>
           </div>
        )}
      </main>
    </>
  );
}
