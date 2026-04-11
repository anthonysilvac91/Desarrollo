"use client";

import React, { useState, useMemo } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import AssetModal from "@/components/assets/AssetModal";
import { Plus, MapPin, ChevronLeft, ChevronRight, Pencil, Trash2, Ship } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

// Types based on the Assets Service for future integration
interface AssetDisplay {
  id: string;
  name: string;
  category: string;
  location: string;
  thumbnail_url: string;
  client: {
    name: string;
    action_type: string;
  };
  last_job: {
    date: string;
  };
}

// Asset Image Component with automatic fallback handling
const AssetImage = ({ src, alt }: { src: string; alt: string }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return <Ship className="w-7 h-7 text-brand opacity-30" />;
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className="w-full h-full object-cover" 
      onError={() => setError(true)}
    />
  );
};

// Mock Data
const mockAssets: AssetDisplay[] = [
  { 
    id: "1", 
    name: "Lady Nelly", 
    category: "Motor Yacht - 24m", 
    location: "Marina Ibiza, Amarre 42", 
    thumbnail_url: "", 
    client: { name: "Roberto García", action_type: "Hull maintenance" },
    last_job: { date: "12-10-2023" }
  },
  { 
    id: "2", 
    name: "Sea Breeze", 
    category: "Catamaran - 15m", 
    location: "Palma Royal Yacht Club", 
    thumbnail_url: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&q=80&w=200&h=200",
    client: { name: "Thomas Müller", action_type: "Electrical" },
    last_job: { date: "28-09-2023" }
  },
  { 
    id: "3", 
    name: "Azimut 58", 
    category: "Sailing Yacht - 18m", 
    location: "Puerto Banús, Dock 3", 
    thumbnail_url: "https://images.unsplash.com/photo-1563299284-f7486d3967a6?auto=format&fit=crop&q=80&w=200&h=200", 
    client: { name: "Elena Martínez", action_type: "Hull cleaning" },
    last_job: { date: "05-10-2023" }
  },
  { 
    id: "4", 
    name: "Polaris", 
    category: "Motor Yacht - 32m", 
    location: "Port de Saint-Tropez", 
    thumbnail_url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5927?auto=format&fit=crop&q=80&w=200&h=200", 
    client: { name: "Sophie Laurent", action_type: "Maintenance" },
    last_job: { date: "22-09-2023" }
  },
  { 
    id: "5", 
    name: "Amaryllis", 
    category: "Classic Yacht - 40m", 
    location: "Marina Port Vell", 
    thumbnail_url: "", 
    client: { name: "Julian Rossi", action_type: "Carpentry" },
    last_job: { date: "15-09-2023" }
  },
];

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLanguage();

  // Filter logic for functional search
  const filteredData = useMemo(() => {
    return mockAssets.filter((item) => {
      const searchLower = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(searchLower) ||
        item.client.name.toLowerCase().includes(searchLower) ||
        item.location.toLowerCase().includes(searchLower)
      );
    });
  }, [search]);

  // Paginated view (only top 5 as requested to fit viewport)
  const displayData = filteredData.slice(0, 5);

  const handleAddAsset = (data: any) => {
    console.log("Saving new asset:", data);
  };

  const columns: ColumnDef<AssetDisplay>[] = [
    { 
      key: "asset", 
      header: t.assets.table.asset,
      cell: (item) => (
        <div className="flex items-center space-x-5">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0 bg-gray-50 flex items-center justify-center relative">
            <AssetImage src={item.thumbnail_url} alt={item.name} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-title text-[17px]">{item.name}</span>
          </div>
        </div>
      )
    },
    { 
      key: "client", 
      header: t.assets.table.client,
      cell: (item) => (
        <span className="font-semibold text-subtitle/80 text-[15px]">{item.client.name}</span>
      )
    },
    { 
      key: "location", 
      header: t.assets.table.location,
      cell: (item) => (
        <div className="flex items-center text-subtitle/70">
          <MapPin className="w-4 h-4 mr-2 text-brand" />
          <span className="text-[15px] font-semibold">{item.location}</span>
        </div>
      )
    },
    { 
      key: "last_job", 
      header: t.assets.table.last_job,
      align: "center",
      cell: (item) => (
        <span className="text-subtitle/70 font-semibold text-[15px]">{item.last_job.date}</span>
      )
    },
    {
      key: "actions",
      header: t.assets.table.actions,
      align: "center",
      cell: () => (
        <div className="flex items-center justify-center space-x-3">
          <button className="p-2.5 text-subtitle/40 hover:text-brand transition-colors">
            < Pencil className="w-5 h-5" />
          </button>
          <button className="p-2.5 text-error/40 hover:text-error transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  const pagination = (
    <>
      <div className="text-[15px] text-subtitle font-medium tracking-tight">
        {t.assets.pagination.showing} <span className="text-title font-bold">{displayData.length}</span> {t.assets.pagination.of} <span className="text-title font-bold">{filteredData.length}</span> {t.assets.pagination.assets}
      </div>
      <div className="flex items-center space-x-2">
        <button className="p-2 rounded-md hover:bg-gray-100 text-subtitle/40 transition-colors disabled:opacity-20" disabled>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-md shadow-brand/20">1</button>
        <button className="p-2 rounded-md hover:bg-gray-100 text-subtitle/40 transition-colors disabled:opacity-20" disabled>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col space-y-10">
      {/* Search & Actions */}
      <FiltersBar 
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

      {/* Table section */}
      <div className="flex-1">
        <ModuleContainer>
          <DataTable 
            data={displayData} 
            columns={columns} 
            keyExtractor={(item) => item.id}
            footer={pagination}
            emptyMessage={search ? "No matches found for your search." : undefined}
          />
        </ModuleContainer>
      </div>

      {/* Add New Asset Modal */}
      <AssetModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleAddAsset} 
      />
    </div>
  );
}
