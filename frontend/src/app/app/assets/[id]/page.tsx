"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MapPin, Plus, Calendar, Building2, Camera, Ship, Briefcase, Loader2 } from "lucide-react";
import MobileHeader from "@/components/layout/MobileHeader";
import { assetsService, Asset } from "@/services/assets.service";

export default function WorkerAssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const data = await assetsService.findOne(params.id as string);
        setAsset(data);
      } catch (err) {
        console.error("Error fetching asset:", err);
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchAsset();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-app-bg text-brand">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-title font-bold text-lg">Asset not found</p>
        <button onClick={() => router.back()} className="mt-4 text-brand font-black text-sm uppercase">Go Back</button>
      </div>
    );
  }

const AssetImage = ({ src, alt }: { src: string; alt: string }) => {
  const [error, setError] = useState(false);

  // Si cambia la URL, reiniciamos el estado de error para intentar cargar la nueva
  React.useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
    return (
      <div className="w-full h-full bg-brand/5 flex items-center justify-center text-brand/30">
        <Ship className="w-12 h-12" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      key={src}
      src={src} 
      alt={alt} 
      className="w-full h-full object-cover" 
      onError={() => setError(true)} 
    />
  );
};

const JobGallery = ({ images }: { images: string[] }) => {
  if (!images || images.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mt-4">
      {images.slice(0, 3).map((_, i) => (
        <div key={i} className="w-12 h-12 rounded-xl bg-gray-50/50 border border-border-theme/20 flex items-center justify-center shadow-sm overflow-hidden">
          <Camera className="w-5 h-5 text-subtitle opacity-30" />
        </div>
      ))}
      {images.length > 3 && (
        <div className="w-12 h-12 rounded-xl bg-surface border border-border-theme/20 flex items-center justify-center shadow-sm text-[10px] font-black text-subtitle opacity-40">
          +{images.length - 3}
        </div>
      )}
    </div>
  );
};

const JobDescription = ({ description }: { description: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (textRef.current) {
      const el = textRef.current;
      // Change detection to match 3 lines
      if (el.scrollHeight > el.clientHeight || description.split('\n').length > 3) {
        setShowButton(true);
      }
    }
  }, [description]);

  return (
    <div className="mb-3">
      <p 
        ref={textRef}
        className={`text-xs font-semibold text-subtitle/70 leading-relaxed ${isExpanded ? "" : "line-clamp-3"}`}
      >
        {description}
      </p>
      {showButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="mt-2 text-[9px] font-black uppercase text-brand tracking-widest hover:opacity-70 transition-opacity"
        >
          {isExpanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
};

export default function WorkerAssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  // Using direct mock. In reality, would fetch based on params.id.
  const asset = MOCK_ASSET;

  return (
    <>
      <MobileHeader title={asset.name} showBack={true} />
      
      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-2 pb-28">
        {/* Asset Quick Summary - Centered Premium Design */}
        <div className="flex flex-col items-center justify-center pt-2 pb-8">
           {/* Circular Avatar */}
           <div className="w-28 h-28 rounded-full bg-surface border-4 border-white shadow-xl flex items-center justify-center mb-6 overflow-hidden ring-1 ring-border-theme/20">
              <AssetImage src={asset.thumbnail_url} alt={asset.name} />
           </div>

           {/* Asset Info */}
           <div className="text-center px-4 mb-8">
              <h1 className="text-3xl font-black text-title tracking-tight mb-2">{asset.name}</h1>
              <div className="flex items-center justify-center text-[11px] font-black text-brand uppercase tracking-[0.2em]">
                  <MapPin className="w-3.5 h-3.5 mr-2" />
                  <span>{asset.location}</span>
              </div>
           </div>

           {/* Stats Grid */}
           <div className="grid grid-cols-2 gap-4 w-full px-4 max-w-sm">
               <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
                  <span className="text-sm font-bold text-title truncate">{asset.client?.name || "Sin Cliente"}</span>
                </div>
              </div>
              <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 text-left">
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest mb-1 block">Total Services</span>
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-3.5 h-3.5 text-brand" />
                  <span className="text-sm font-bold text-title">{asset.services?.length || 0}</span>
                </div>
              </div>
           </div>
        </div>

        {/* Timeline Header */}
        <div className="mb-4">
           <h3 className="text-sm font-black text-title uppercase tracking-widest text-center opacity-40">Service History</h3>
        </div>

        {/* Timeline Cards */}
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[23px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border-theme/40 before:to-transparent">
           {(asset.services || []).map((job) => (
             <div 
                key={job.id} 
                onClick={() => router.push(`/app/service/${job.id}`)}
                className="relative flex items-center gap-4 md:odd:flex-row-reverse group is-active active:scale-[0.98] transition-transform cursor-pointer"
             >
                {/* Timeline dot */}
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-app-bg bg-brand/10 text-brand shadow-sm z-10 flex-shrink-0">
                   <div className="w-3 h-3 bg-brand rounded-full"></div>
                </div>

                {/* Job Card content */}
                <div className="w-[calc(100%-4rem)] p-5 rounded-2xl bg-surface border border-border-theme/40 shadow-sm">
                   {/* Date Tag */}
                   <div className="flex items-center bg-brand/5 rounded-full px-3 py-1 w-fit mb-3 border border-brand/5">
                     <Calendar className="w-3 h-3 mr-2 text-brand" />
                      <span className="text-[10px] font-black uppercase text-brand tracking-widest">
                         {new Date(job.created_at).toLocaleDateString("en-GB", { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}
                      </span>
                   </div>

                   <h4 className="text-lg font-semibold text-title mb-1 leading-tight">{job.title}</h4>
                    
                   <JobDescription description={job.description || ""} />

                   <JobGallery images={job.attachments.map(a => a.file_url)} />
                </div>
             </div>
           ))}
        </div>
      </main>

      {/* FAB - Fixed Bottom Area */}
      <div className="absolute flex justify-center bottom-0 w-full p-5 bg-gradient-to-t from-app-bg via-app-bg/90 to-transparent pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <button 
          onClick={() => router.push(`/app/assets/${asset.id}/new-service`)}
          className="w-full flex items-center justify-center space-x-2 bg-brand text-white py-4 rounded-full font-black text-base shadow-xl shadow-brand/30 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6 stroke-[3px]" />
          <span>Add Service</span>
        </button>
      </div>
    </>
  );
}
