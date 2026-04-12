"use client";

import React, { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { useRouter } from "next/navigation";
import { MapPin, Ship, Calendar, Camera, Loader2, Maximize2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface JobHistory {
  id: string;
  date: string;
  title: string;
  description: string;
  images: string[];
}

interface AssetDetail {
  id: string;
  name: string;
  category: string;
  location: string;
  jobs_count: number;
  thumbnail_url: string;
  client: {
    name: string;
  };
}

interface AssetDrawerProps {
  asset: AssetDetail | null;
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

// Mock History Data
const MOCK_HISTORY_EXTENDED: JobHistory[] = [
  {
    id: "j1",
    date: "12 Oct 2023",
    title: "Hull Maintenance & Cleaning",
    description: "Full exterior hull cleaning and anti-fouling treatment applied to the lower sections. This ensures maximum speed and efficiency during navigation while preventing marine growth accumulating on the surface.",
    images: [
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5927?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1563299284-f7486d3967a6?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1567899378494-47b22a2ad96a?auto=format&fit=crop&q=80&w=200&h=200"
    ]
  },
  {
    id: "j2",
    date: "28 Sep 2023",
    title: "Engine Diagnostics & Oil Change",
    description: "Routine check of the main propulsion system and replacement of all filters. Checked cooling system for leaks and validated sensor outputs on the main control panel.",
    images: [
      "https://images.unsplash.com/photo-1589139225-33ec7c8ec19d?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/broken-link-test"
    ]
  },
  {
    id: "j3",
    date: "15 Aug 2023",
    title: "Electrical System Refit",
    description: "Upgraded the internal distribution board and replaced aging wiring in the main cabin. Integrated new LED lighting system for better energy efficiency.",
    images: ["https://images.unsplash.com/photo-1540946484617-452a3bccf974?auto=format&fit=crop&q=80&w=200&h=200"]
  },
  {
    id: "j4",
    date: "02 Jul 2023",
    title: "Teak Deck Sanding",
    description: "Restored the natural wood finish of the upper deck area through careful hand sanding and oiling. Protected the surface with UV resistant coating.",
    images: []
  }
];

export default function AssetDrawer({ asset, onClose }: AssetDrawerProps) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(2);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { t } = useLanguage();

  if (!asset) return <Drawer isOpen={false} onClose={onClose} children={<div />} />;

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await new Promise(r => setTimeout(r, 600));
    setVisibleCount(prev => Math.min(prev + 2, MOCK_HISTORY_EXTENDED.length));
    setIsLoadingMore(false);
  };

  const history = MOCK_HISTORY_EXTENDED.slice(0, visibleCount);
  const hasMore = visibleCount < MOCK_HISTORY_EXTENDED.length;

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
              {asset.client.name}
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
            {history.map((job) => (
              <div 
                key={job.id} 
                className="group p-5 bg-white border border-border-theme/50 rounded-2xl hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 transition-all min-h-[180px] flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-brand/10 px-3 py-1 rounded-full flex items-center">
                    <Calendar className="w-3 h-3 text-brand mr-2" />
                    <span className="text-[10px] font-black text-brand uppercase tracking-wider">{job.date}</span>
                  </div>
                </div>
                <h4 className="text-base font-bold text-title mb-2 group-hover:text-brand transition-colors truncate">{job.title}</h4>
                <p className="text-sm text-subtitle/70 leading-relaxed mb-4 font-medium line-clamp-2 overflow-hidden">
                  {job.description}
                </p>
                {/* Image Thumbnails */}
                {job.images.length > 0 && (
                  <div className="flex items-center gap-2.5 mt-auto">
                    {job.images.map((img, idx) => (
                      <div key={idx} className="w-12 h-12 rounded-lg border border-border-theme/20 overflow-hidden shadow-sm hover:scale-110 transition-transform bg-white">
                        <JobThumbnail src={img} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Link - Load More */}
        <div className="p-10 pt-4">
          {hasMore ? (
            <button 
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full py-4 text-sm font-black text-brand border-2 border-brand/20 bg-brand/5 hover:bg-brand/10 rounded-2xl transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-brand" />
                  <span>{t.assets.drawer.loading}</span>
                </>
              ) : (
                <span>{t.assets.drawer.load_more}</span>
              )}
            </button>
          ) : (
            <div className="w-full py-4 text-center text-xs font-bold text-subtitle/30 border-2 border-dashed border-border-theme/40 rounded-2xl">
              {t.assets.drawer.all_loaded}
            </div>
          )}
        </div>

      </div>
    </Drawer>
  );
}
