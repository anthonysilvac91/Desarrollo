"use client";

import React, { useState, useMemo } from "react";
import ModuleContainer from "@/components/ui/ModuleContainer";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import { Trash2, Wrench, User, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import ServiceDrawer from "@/components/services/ServiceDrawer";
import ConfirmModal from "@/components/ui/ConfirmModal";

// Types for Service (Job) Display
interface ServiceDisplay {
  id: string;
  title: string;
  asset_name: string;
  asset_location: string;
  worker_name: string;
  client_name: string;
  date: string;
  description: string;
  images: string[];
}

// Helper to format Date to dd-mm-yyyy
const formatDateToString = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Initial Mock Data
const INITIAL_SERVICES: ServiceDisplay[] = [
  { 
    id: "s1", 
    title: "Hull Maintenance & Cleaning", 
    asset_name: "Lady Nelly", 
    asset_location: "Marina Ibiza, Amarre 42",
    worker_name: "Alex Thompson", 
    client_name: "Roberto García", 
    date: formatDateToString(new Date()),
    description: "Se realizó una limpieza profunda del casco incluyendo la eliminación de incrustaciones marinas y aplicación de capa protectora. Se revisaron las válvulas de fondo y se limpiaron los filtros de refrigeración del motor principal.",
    images: [
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5927?auto=format&fit=crop&q=80&w=400&h=400",
      "https://images.unsplash.com/photo-1563299284-f7486d3967a6?auto=format&fit=crop&q=80&w=400&h=400",
      "https://images.unsplash.com/photo-1567899378494-47b22a2ad96a?auto=format&fit=crop&q=80&w=400&h=400"
    ]
  },
  { 
    id: "s2", 
    title: "Engine Diagnostics", 
    asset_name: "Sea Breeze", 
    asset_location: "Palma Royal Yacht Club",
    worker_name: "Juan Pérez", 
    client_name: "Thomas Müller", 
    date: formatDateToString(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
    description: "Escaneo completo de la centralita del motor Volvo Penta. Se detectó un sensor de temperatura defectuoso que fue reemplazado de inmediato. Niveles de aceite y refrigerante dentro de los parámetros normales.",
    images: [
      "https://images.unsplash.com/photo-1589139225-33ec7c8ec19d?auto=format&fit=crop&q=80&w=400&h=400",
      "https://images.unsplash.com/photo-1540946484617-452a3bccf974?auto=format&fit=crop&q=80&w=400&h=400"
    ]
  },
  { 
    id: "s3", 
    title: "Electrical System Refit", 
    asset_name: "Lady Nelly", 
    asset_location: "Marina Ibiza, Amarre 42",
    worker_name: "Alex Thompson", 
    client_name: "Roberto García", 
    date: formatDateToString(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)),
    description: "Actualización completa del cuadro eléctrico principal. Se sustituyeron los disyuntores antiguos por modelos inteligentes con monitoreo remoto. Se revisó la instalación de las baterías de servicio.",
    images: [
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400&h=400"
    ]
  },
  { 
    id: "s4", 
    title: "Teak Deck Sanding", 
    asset_name: "Azimut 58", 
    asset_location: "Puerto Banús, Dock 3",
    worker_name: "Maria Silva", 
    client_name: "Elena Martínez", 
    date: "20-05-2023",
    description: "Lijado manual de la cubierta de teca para recuperar el color original de la madera. Se aplicaron tres capas de aceite nutritivo de alta resistencia UV. El acabado final muestra una textura uniforme y natural.",
    images: []
  },
  { 
    id: "s5", 
    title: "Upholstery Cleaning", 
    asset_name: "Polaris", 
    asset_location: "Port de Saint-Tropez",
    worker_name: "Juan Pérez", 
    client_name: "Sophie Laurent", 
    date: "15-01-2024",
    description: "Limpieza con vapor a alta presión de toda la tapicería exterior del flybridge. Se utilizaron productos biodegradables especializados para ambientes marinos. Se trataron manchas localizadas de óxido y sal.",
    images: [
      "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&q=80&w=400&h=400"
    ]
  },
];

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceDisplay[]>(INITIAL_SERVICES);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<{preset: string, start?: string, end?: string}>({ preset: "Todo" });
  const [selectedService, setSelectedService] = useState<ServiceDisplay | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceDisplay | null>(null);
  const { t } = useLanguage();

  // Filter logic
  const filteredData = useMemo(() => {
    return services.filter((item) => {
      // 1. Text Search
      const searchLower = search.toLowerCase();
      const matchesSearch = search === "" || (
        item.title.toLowerCase().includes(searchLower) ||
        item.asset_name.toLowerCase().includes(searchLower) ||
        item.worker_name.toLowerCase().includes(searchLower) ||
        item.client_name.toLowerCase().includes(searchLower)
      );

      if (!matchesSearch) return false;

      // 2. Date Parsing (dd-mm-yyyy to Date)
      const [day, month, year] = item.date.split('-').map(Number);
      const itemDate = new Date(year, month - 1, day);
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const itemDateNoTime = new Date(itemDate);
      itemDateNoTime.setHours(0, 0, 0, 0);

      if (dateFilter.preset === "Hoy") {
        return itemDateNoTime.getTime() === now.getTime();
      }
      
      if (dateFilter.preset === "Mes") {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      
      if (dateFilter.preset === "Año") {
        return itemDate.getFullYear() === now.getFullYear();
      }
      
      if (dateFilter.preset === "Personalizado" && dateFilter.start && dateFilter.end) {
        const start = new Date(dateFilter.start);
        const end = new Date(dateFilter.end);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return itemDate >= start && itemDate <= end;
      }

      return true;
    });
  }, [search, dateFilter, services]);

  const handleDateChange = (preset: string, start?: string, end?: string) => {
    setDateFilter({ preset, start, end });
  };

  const handleDeleteRequest = (e: React.MouseEvent, service: ServiceDisplay) => {
    e.stopPropagation();
    setServiceToDelete(service);
  };

  const handleConfirmDelete = () => {
    if (serviceToDelete) {
      setServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      setServiceToDelete(null);
    }
  };

  const displayData = filteredData.slice(0, 5);

  const columns: ColumnDef<ServiceDisplay>[] = [
    { 
      key: "service", 
      header: t.services.table.service,
      cell: (item) => (
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand flex-shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <span className="font-bold text-title text-[17px]">{item.title}</span>
        </div>
      )
    },
    { 
      key: "asset", 
      header: t.services.table.asset,
      cell: (item) => (
        <span className="font-semibold text-subtitle/80 text-[15px] group cursor-pointer hover:text-brand transition-colors">{item.asset_name}</span>
      )
    },
    { 
      key: "worker", 
      header: t.services.table.operator,
      cell: (item) => (
        <div className="flex items-center text-subtitle/80">
          <User className="w-4 h-4 mr-2" />
          <span className="font-semibold text-[15px]">{item.worker_name}</span>
        </div>
      )
    },
    { 
      key: "client", 
      header: t.services.table.client,
      cell: (item) => (
        <span className="font-bold text-subtitle/80 text-[15px]">{item.client_name}</span>
      )
    },
    { 
      key: "date", 
      header: t.services.table.date,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center text-subtitle/70">
          <Calendar className="w-4 h-4 mr-2" />
          <span className="font-semibold text-[15px]">{item.date}</span>
        </div>
      )
    },
    {
      key: "actions",
      header: t.services.table.actions,
      align: "center",
      cell: (item) => (
        <div className="flex items-center justify-center">
          <button 
            onClick={(e) => handleDeleteRequest(e, item)}
            className="p-2.5 text-error/40 hover:text-error hover:bg-error/5 rounded-full transition-all"
            title="Eliminar servicio"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  const pagination = (
    <>
      <div className="text-[15px] text-subtitle font-medium">
        {t.services.pagination.showing} <span className="text-title font-bold">{displayData.length}</span> {t.services.pagination.of} <span className="text-title font-bold">{filteredData.length}</span> {t.services.pagination.services}
      </div>
      <div className="flex items-center space-x-2">
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20" disabled>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-lg shadow-brand/20">1</button>
        <button className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col space-y-8">
      <FiltersBar 
        searchPlaceholder={t.services.search_placeholder}
        onSearchChange={setSearch}
        onDateChange={handleDateChange}
        showQuickFilters={true}
      />

      <div className="flex-1">
        <ModuleContainer>
          <DataTable 
            data={displayData} 
            columns={columns} 
            keyExtractor={(item) => item.id}
            footer={pagination}
            onRowClick={(item) => setSelectedService(item)}
          />
        </ModuleContainer>
      </div>

      <ServiceDrawer 
        service={selectedService} 
        onClose={() => setSelectedService(null)} 
      />

      <ConfirmModal 
        isOpen={!!serviceToDelete}
        onClose={() => setServiceToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t.confirm_modal.delete_service_title}
        description={t.confirm_modal.delete_description}
        confirmText={t.confirm_modal.confirm_delete}
        cancelText={t.confirm_modal.cancel_delete}
        variant="danger"
      />
    </div>
  );
}
