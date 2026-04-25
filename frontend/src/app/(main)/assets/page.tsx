"use client";

import React, { useState, useMemo } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import AssetModal from "@/components/assets/AssetModal";
import AssetDrawer from "@/components/assets/AssetDrawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Plus, MapPin, ChevronLeft, ChevronRight, Pencil, Trash2, Ship, Calendar } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { assetsService, Asset } from "@/services/assets.service";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/lib/ToastContext";
import { useDebounce } from "@/hooks/useDebounce";
import AssetIcon from "@/components/ui/AssetIcon";
import { Loader2, AlertCircle, Inbox } from "lucide-react";

// Asset Image Component
const AssetImage = ({ src, alt, iconId }: { src: string; alt: string | undefined; iconId?: string | null }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return <AssetIcon iconId={iconId} className="w-7 h-7 text-brand opacity-30" />;
  }
  return <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setError(true)} />;
};

export default function AssetsPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);

  const [page, setPage] = useState(1);
  const limit = 10;

  const queryParams = { page, limit, search: debouncedSearch };

  const { data: responseData, isLoading, isError, refetch } = useQuery({
    queryKey: ["assets", queryParams],
    queryFn: () => assetsService.findAll(queryParams),
  });

  const rawAssets = Array.isArray(responseData) ? responseData : responseData?.data || [];
  const meta = !Array.isArray(responseData) && responseData?.meta ? responseData.meta : { total: rawAssets.length, page: 1, limit: 10, totalPages: 1 };

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Client and Category filtering is still local for the current page
  const filteredData = useMemo(() => {
    return rawAssets.filter((item: any) => {
      const matchesClient = selectedClients.length === 0 || (item.client && selectedClients.includes(item.client.name));
      const matchesCategory = selectedCategories.length === 0 || (item.category && selectedCategories.includes(item.category));
      return matchesClient && matchesCategory;
    });
  }, [selectedClients, selectedCategories, rawAssets]);

  const toggleClient = (client: string) => {
    setSelectedClients(prev => prev.includes(client) ? prev.filter(c => c !== client) : [...prev, client]);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  };

  const clearFilters = () => {
    setSelectedClients([]);
    setSelectedCategories([]);
  };

  const handleDeleteRequest = (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation();
    setAssetToDelete(asset);
  };

  const handleConfirmDelete = async () => {
    if (assetToDelete) {
      try {
        await assetsService.delete(assetToDelete.id);
        showToast(t.feedback.delete_asset_success, "success");
        setAssetToDelete(null);
        refetch();
      } catch (err) {
        showToast(t.feedback.delete_asset_error, "error");
      }
    }
  };

  // Eliminated .slice(0, 10) since backend handles it
  const displayData = filteredData;

  const columns: ColumnDef<Asset>[] = [
    { 
      key: "asset", 
      header: t.assets.table.asset,
      cell: (item) => (
        <div className="flex items-center space-x-5">
          <div className={`w-14 h-14 rounded-full overflow-hidden border-2 border-surface shadow-sm flex-shrink-0 bg-app-bg flex items-center justify-center relative ${!item.is_active ? 'grayscale opacity-40' : ''}`}>
            <AssetImage 
              src={item.thumbnail_url || ""} 
              alt={item.name} 
              iconId={user?.organization?.default_asset_icon}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-title text-[17px] ${!item.is_active ? 'opacity-40' : ''}`}>{item.name}</span>
              {!item.is_active && (
                <span className="px-2 py-0.5 rounded-full bg-error/10 text-error text-[10px] font-black uppercase tracking-wider border border-error/20">
                  {t.common?.inactive || "INACTIVO"}
                </span>
              )}
            </div>
          </div>
        </div>
      )
    },
    { 
      key: "client", 
      header: t.assets.table.client,
      cell: (item) => {
        const clientName = item.client?.name || item.client_access?.[0]?.client?.name || "---";
        return <span className="font-bold text-subtitle/80 text-[15px]">{clientName}</span>;
      }
    },
    { 
      key: "location", 
      header: t.assets.table.location,
      cell: (item) => (
        <div className="flex items-center text-subtitle/70">
          <MapPin className="w-4 h-4 mr-2 text-brand" />
          <span className="text-[15px] font-semibold">{item.location || "N/A"}</span>
        </div>
      )
    },
    { 
      key: "jobs", 
      header: t.assets.table.services,
      align: "center",
      cell: (item: any) => (
        <div className="flex items-center justify-center">
          <span className="min-w-[50px] h-9 flex items-center justify-center text-[15px] font-bold text-title bg-app-bg rounded-lg border border-border-theme/40 px-2 transition-all">
            {item._count?.services || 0}
          </span>
        </div>
      )
    },
    { 
      key: "last_job", 
      header: t.assets.table.last_service, 
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center text-subtitle/70">
          <Calendar className="w-4 h-4 mr-2" />
          <span className="font-semibold text-[15px]">{item.last_service?.date || "---"}</span>
        </div>
      )
    },
    {
      key: "actions",
      header: t.assets.table.actions,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center space-x-3">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setAssetToEdit(item);
              setIsModalOpen(true);
            }}
            className="p-2.5 text-subtitle/40 hover:text-brand transition-colors"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button 
            onClick={(e) => handleDeleteRequest(e, item)}
            className="p-2.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  const pagination = (
    <>
      <div className="text-[15px] text-subtitle font-medium tracking-tight">
        {t.assets.pagination.showing} <span className="text-title font-bold">{displayData.length}</span> {t.assets.pagination.of} <span className="text-title font-bold">{meta.total}</span> {t.assets.pagination.assets}
      </div>
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-md shadow-brand/20">{page}</button>
        <button 
          onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
          disabled={page >= meta.totalPages}
          className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col space-y-10">
      <FiltersBar 
        searchPlaceholder={t.assets.search_placeholder}
        onSearchChange={setSearch}
        actions={
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25"
          >
            <Plus className="w-5 h-5 stroke-[4px]" />
            <span>{t.assets.add_new}</span>
          </button>
        }
      />

      <div className="flex-1 min-h-[400px]">
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-20 animate-pulse">
            <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
            <p className="font-black text-subtitle/40 tracking-wider text-xs uppercase">{t.assets.states.loading}</p>
          </div>
        ) : isError ? (
          <ModuleContainer>
            <div className="w-full flex flex-col items-center justify-center py-20 space-y-4">
              <div className="p-4 bg-error/10 rounded-full">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <div className="text-center">
                <p className="font-black text-title text-xl">{t.assets.states.error_title}</p>
                <p className="text-subtitle font-medium">{t.assets.states.error_subtitle}</p>
              </div>
              <button 
                onClick={() => refetch()}
                className="px-6 py-2 bg-app-bg hover:bg-border-theme/20 border border-border-theme/40 rounded-xl text-title font-bold text-sm transition-all"
              >
                {t.common.retry}
              </button>
            </div>
          </ModuleContainer>
        ) : rawAssets.length === 0 ? (
          <ModuleContainer>
            <div className="w-full flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full" />
                <div className="relative p-6 bg-white border-2 border-brand/5 shadow-2xl shadow-brand/5 rounded-[40px]">
                  <Inbox className="w-12 h-12 text-brand/20" />
                </div>
              </div>
              <div className="text-center space-y-2 max-w-xs">
                <p className="font-black text-title text-2xl tracking-tight">{t.assets.states.empty_title}</p>
                <p className="text-subtitle font-medium leading-relaxed">{t.assets.states.empty_subtitle}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center space-x-3 bg-brand text-white px-8 py-4 rounded-full text-base font-black transition-all shadow-xl shadow-brand/20 hover:scale-105 active:scale-95"
              >
                <Plus className="w-5 h-5 stroke-[3px]" />
                <span>{t.assets.add_new}</span>
              </button>
            </div>
          </ModuleContainer>
        ) : (
          <ModuleContainer>
            <DataTable 
              data={displayData} 
              columns={columns} 
              keyExtractor={(item) => item.id}
              footer={pagination}
              onRowClick={(item) => setSelectedAsset(item)}
            />
          </ModuleContainer>
        )}
      </div>

      <AssetModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setAssetToEdit(null);
        }} 
        asset={assetToEdit}
        onSuccess={() => {
          setIsModalOpen(false);
          setAssetToEdit(null);
          refetch();
        }} 
      />

      <AssetDrawer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

      <ConfirmModal 
        isOpen={!!assetToDelete}
        onClose={() => setAssetToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t.confirm_modal.delete_asset_title}
        description={t.confirm_modal.delete_description}
        confirmText={t.confirm_modal.confirm_delete}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
      />
    </div>
  );
}
