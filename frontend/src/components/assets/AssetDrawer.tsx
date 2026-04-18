"use client";

import React, { useState, useEffect } from "react";
import Drawer from "@/components/ui/Drawer";
import { useRouter } from "next/navigation";
import { MapPin, Ship, Calendar, Camera, Loader2, Maximize2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { Asset, assetsService, Service } from "@/services/assets.service";

interface AssetDrawerProps {
  asset: Asset | null;
  onClose: () => void;
}

// Fallback image component for thumbnails/cards
const JobThumbnail = ({ src }: { src: string }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className="w-full h-full bg-gray-50 flex items-center justify-center border border-gray-100 rounded-lg">
        <Camera className="w-5 h-5 text-subtitle/20" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt="Job proof" 
      className="w-full h-full object-cover rounded-lg" 
      onError={() => setError(true)}
    />
  );
};

export default function AssetDrawer({ asset: initialAsset, onClose }: AssetDrawerProps) {
  const router = useRouter();
  const [fullAsset, setFullAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (initialAsset?.id) {
      setLoading(true);
      assetsService.findOne(initialAsset.id)
        .then(data => setFullAsset(data))
        .catch(err => console.error("Error loading asset detail:", err))
        .finally(() => setLoading(false));
    } else {
      setFullAsset(null);
    }
  }, [initialAsset?.id]);

  if (!initialAsset) return <Drawer isOpen={false} onClose={onClose}><div /></Drawer>;

  // Usar fullAsset si está disponible, si no el inicial
  const currentAsset = fullAsset || initialAsset;
  const history = currentAsset.services || [];

  // Left action for the drawer (Expand icon)
  const ExpandAction = (
    <button 
      onClick={() => {
        onClose();
        router.push(`/assets/${asset.id}`);
      }}
      className="p-2.5 rounded-full hover:bg-app-bg text-subtitle/40 hover:text-brand transition-all group"
    >
      <Maximize2 className="w-6 h-6" />
    </button>
  );

  return (
    <Drawer isOpen={!!asset} onClose={onClose} leftAction={ExpandAction}>
      <div className="flex flex-col min-h-full">
        
        {/* Header Section */}
        <div className="p-10 pb-6 flex flex-col items-center text-center space-y-5 bg-gradient-to-b from-gray-50/50 to-white pt-24">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gray-50 flex items-center justify-center relative ring-1 ring-border-theme/20">
            {asset.thumbnail_url ? (
              <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover" />
            ) : (
              <Ship className="w-10 h-10 text-brand/30" />
            )}
          </div>
          <div className="flex flex-col space-y-1">
            <h2 className="text-3xl font-black text-title tracking-tight mb-1">{asset.name}</h2>
            <span className="text-brand font-black text-sm uppercase tracking-[0.2em]">
              {currentAsset.client?.name || "No Client"}
            </span>
          </div>
        </div>

        {/* Action Info Summary */}
        <div className="px-10 py-6 grid grid-cols-2 gap-4 border-y border-gray-50">
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">
              {t.assets.drawer.location}
            </span>
            <span className="text-sm font-bold text-title">{asset.location}</span>
          </div>
          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50">
            <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">
              {t.assets.drawer.jobs}
            </span>
            <span className="text-sm font-bold text-title">{asset.jobs_count || 0} {t.assets.drawer.total}</span>
          </div>
        </div>

        {/* Maintenance History */}
        <div className="px-10 py-8 space-y-6 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">
              {t.assets.drawer.maintenance_history}
            </h3>
            {/* LINK REMOVED as requested */}
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-brand/20" /></div>
            ) : history.map((service) => (
              <div 
                key={service.id} 
                onClick={() => router.push(`/app/service/${service.id}`)}
                className="group p-5 bg-white border border-border-theme/50 rounded-2xl hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 transition-all min-h-[140px] flex flex-col cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-brand/10 px-3 py-1 rounded-full flex items-center">
                    <Calendar className="w-3 h-3 text-brand mr-2" />
                    <span className="text-[10px] font-black text-brand uppercase tracking-wider">
                      {new Date(service.created_at).toLocaleDateString("en-GB", { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}
                    </span>
                  </div>
                </div>
                <h4 className="text-base font-bold text-title mb-2 group-hover:text-brand transition-colors truncate">{service.title}</h4>
                <p className="text-sm text-subtitle/70 leading-relaxed mb-4 font-medium line-clamp-2 overflow-hidden">
                  {service.description}
                </p>
                {/* Image Thumbnails */}
                {service.attachments && service.attachments.length > 0 && (
                  <div className="flex items-center gap-2.5 mt-auto">
                    {service.attachments.slice(0, 4).map((att, idx) => (
                      <div key={idx} className="w-12 h-12 rounded-lg border border-border-theme/20 overflow-hidden shadow-sm hover:scale-110 transition-transform bg-white">
                        <JobThumbnail src={att.file_url} />
                      </div>
                    ))}
                    {service.attachments.length > 4 && (
                      <div className="text-[10px] font-black text-subtitle opacity-30">+{service.attachments.length - 4}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-10 pt-4">
          <div className="w-full py-4 text-center text-xs font-bold text-subtitle/30 border-2 border-dashed border-border-theme/40 rounded-2xl">
            {t.assets.drawer.all_loaded}
          </div>
        </div>

      </div>
    </Drawer>
  );
}
