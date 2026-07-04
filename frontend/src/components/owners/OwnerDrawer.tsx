"use client";

import React, { useRef, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { Building2, ChevronRight, Inbox, Loader2, MapPin, MoreVertical, Pencil, Power, Trash2, Wrench } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import AssetIcon from "@/components/ui/AssetIcon";
import { Owner, OwnerAsset, ownersService } from "@/services/owners.service";
import { useQuery } from "@tanstack/react-query";

interface OwnerDrawerProps {
  owner: Owner | null;
  onClose: () => void;
  onEdit?: (owner: Owner) => void;
  onDelete?: (owner: Owner) => void;
  onToggleStatus?: (owner: Owner) => void;
  onAssetClick?: (asset: OwnerAsset, owner: Owner) => void;
  readOnly?: boolean;
}

const OwnerLogo = ({ owner }: { owner: Owner }) => (
  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-brand/5 flex items-center justify-center ring-1 ring-border-theme/20">
    {owner.logo_url ? (
      <img src={owner.logo_url} alt={owner.name} className="w-full h-full object-contain p-4" loading="lazy" />
    ) : (
      <Building2 className="w-10 h-10 text-brand" />
    )}
  </div>
);

const AssetRow = ({
  asset,
  iconId,
  t,
  onClick,
}: {
  asset: OwnerAsset;
  iconId?: string | null;
  t: ReturnType<typeof useLanguage>["t"];
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full bg-surface rounded-2xl border border-border-theme/40 shadow-sm overflow-hidden text-left active:scale-[0.99] transition-transform"
  >
    <div className="flex items-center gap-4 p-4">
    <div className={`w-16 h-16 rounded-full overflow-hidden border-2 border-app-bg shadow-sm shrink-0 bg-app-bg flex items-center justify-center ${asset.is_active === false ? "grayscale opacity-40" : ""}`}>
      {asset.thumbnail_url ? (
        <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <AssetIcon iconId={iconId} className="w-9 h-9 text-brand" strokeWidth={1.5} />
      )}
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-bold text-title text-sm truncate flex-1 ${asset.is_active === false ? "opacity-40" : ""}`}>
          {asset.name}
        </span>
        {asset.is_active === false
          ? <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">{t.common.inactive}</span>
          : <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-700 border border-green-200">{t.common.active}</span>
        }
      </div>
      <p className="text-xs font-bold text-brand truncate mb-0.5">{asset.category || "---"}</p>
      {asset.location && (
        <div className="flex items-center mt-1">
          <MapPin className="w-3 h-3 mr-1 text-subtitle/40 shrink-0" />
          <span className="text-xs text-subtitle/60 truncate">{asset.location}</span>
        </div>
      )}
    </div>

    <div className="flex h-9 w-9 shrink-0 items-center justify-center text-brand">
      <ChevronRight className="w-5 h-5 shrink-0" />
    </div>
    </div>
  </button>
);

export default function OwnerDrawer({ owner, onClose, onEdit, onDelete, onToggleStatus, onAssetClick, readOnly = false }: OwnerDrawerProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const assetIconId = user?.organization?.default_asset_icon;
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isActionsMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isActionsMenuOpen]);

  const { data: ownerDetail, isLoading } = useQuery({
    queryKey: ["owner", owner?.id],
    queryFn: () => ownersService.findOne(owner!.id),
    enabled: !!owner?.id && !readOnly,
  });

  if (!owner) return <Drawer isOpen={false} onClose={onClose}><div /></Drawer>;

  const currentOwner = ownerDetail ?? owner;
  const assets: OwnerAsset[] = currentOwner.assets ?? currentOwner.owner_assets ?? [];

  return (
    <Drawer
      isOpen={!!owner}
      onClose={onClose}
      panelClassName="bg-app-bg"
      closeButtonClassName="p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-title active:scale-90 transition-all shrink-0"
      leftAction={readOnly ? undefined : (
        <div ref={actionsMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsActionsMenuOpen(v => !v)}
            className="p-4 rounded-full bg-surface shadow-2xl border border-border-theme/20 text-brand active:scale-90 transition-all"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {isActionsMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-border-theme/40 z-50 overflow-hidden py-1">
              <button
                type="button"
                onClick={() => {
                  setIsActionsMenuOpen(false);
                  onEdit?.(currentOwner);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-bg transition-colors text-left"
              >
                <Pencil className="w-4 h-4 text-subtitle/50 shrink-0" />
                <span className="text-sm font-semibold text-title">{t.common.edit}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsActionsMenuOpen(false);
                  onToggleStatus?.(currentOwner);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-bg transition-colors text-left"
              >
                <Power className="w-4 h-4 shrink-0" style={{ color: currentOwner.is_active ? "#f59e0b" : "#22c55e" }} />
                <span className="text-sm font-semibold text-title">
                  {currentOwner.is_active ? t.common.deactivate : t.common.activate}
                </span>
              </button>
              <div className="mx-3 my-1 border-t border-border-theme/20" />
              <button
                type="button"
                onClick={() => {
                  setIsActionsMenuOpen(false);
                  onDelete?.(currentOwner);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-error/5 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4 text-error/60 shrink-0" />
                <span className="text-sm font-semibold text-error/80">{t.common.delete}</span>
              </button>
            </div>
          )}
        </div>
      )}
    >
      <div className="flex flex-col min-h-full">
        <div className="p-10 pb-6 flex flex-col items-center text-center space-y-5 pt-16 lg:pt-24">
          <OwnerLogo owner={currentOwner} />

          <div className="flex flex-col items-center space-y-2">
            <h2 className="text-3xl font-black text-title tracking-tight">{currentOwner.name}</h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              currentOwner.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${currentOwner.is_active ? "bg-green-500" : "bg-red-500"}`} />
              {currentOwner.is_active ? t.common.active : t.common.inactive}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 py-4">
          <div className="bg-surface rounded-2xl p-4 border border-border-theme/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <AssetIcon iconId={assetIconId} className="w-4 h-4 text-brand" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black text-subtitle/40 uppercase tracking-widest block">
                {t.owners.table.assets}
              </span>
              <span className="text-sm font-bold text-title block">
                {isLoading ? "---" : currentOwner.assets_count ?? assets.length}
              </span>
            </div>
          </div>
          <div className="bg-surface rounded-2xl p-4 border border-border-theme/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4 text-brand" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black text-subtitle/40 uppercase tracking-widest block">
                {t.owners.table.services}
              </span>
              <span className="text-sm font-bold text-title block">
                {isLoading ? "---" : currentOwner.services_count ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-8 space-y-4 flex-1">
          <h3 className="text-[13px] font-black text-title uppercase tracking-[0.15em]">
            {t.sidebar.assets}
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-border-theme/20 rounded-3xl flex flex-col items-center justify-center text-center space-y-2">
              <Inbox className="w-8 h-8 text-subtitle/20" />
              <p className="text-sm font-black text-subtitle/40 uppercase tracking-widest">
                {t.assets.states.empty_title}
              </p>
              <p className="text-xs text-subtitle/30 font-medium max-w-50">
                {t.assets.states.empty_subtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  iconId={assetIconId}
                  t={t}
                  onClick={() => onAssetClick?.(asset, currentOwner)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
