"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { organizationsService, Organization } from "@/services/organizations.service";
import ModuleContainer from "@/components/ui/ModuleContainer";
import ModuleHeader from "@/components/ui/ModuleHeader";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import OrganizationForm from "@/components/master/OrganizationForm";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { 
  Building2, 
  Plus, 
  ToggleLeft, 
  ToggleRight, 
  Clock, 
  Globe,
  Loader2,
  AlertCircle
} from "lucide-react";

export default function MasterOrganizationsPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: organizations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsService.findAll(),
  });

  const handleToggleStatus = async (org: Organization) => {
    try {
      await organizationsService.toggleStatus(org.id, !org.is_active);
      showToast(
        `Organización ${!org.is_active ? "activada" : "desactivada"} correctamente`,
        "success"
      );
      refetch();
    } catch (error) {
      showToast("Error al cambiar el estado de la organización", "error");
    }
  };

  const columns: ColumnDef<Organization>[] = [
    {
      key: "name",
      header: t.sidebar.organizations,
      cell: (org) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-app-bg flex items-center justify-center text-brand font-black shrink-0 border border-border-theme/40">
            {org.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-title">{org.name}</span>
            <span className="text-xs text-subtitle opacity-40 font-bold uppercase tracking-wider flex items-center">
              <Globe className="w-2.5 h-2.5 mr-1" />
              {org.slug}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "created_at",
      header: t.users.table.last_access,
      cell: (org) => (
        <div className="flex items-center text-subtitle/60">
          <Clock className="w-4 h-4 mr-2 opacity-30" />
          <span className="text-sm font-semibold">
            {new Date(org.created_at).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: t.users.table.status,
      cell: (org) => (
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
            org.is_active
              ? "bg-brand/10 text-brand"
              : "bg-subtitle/10 text-subtitle opacity-40"
          }`}
        >
          {org.is_active ? t.common.active : t.common.inactive}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (org) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleStatus(org);
          }}
          className={`p-2 rounded-xl transition-all ${
            org.is_active 
              ? "text-brand hover:bg-brand/10" 
              : "text-subtitle/30 hover:text-subtitle hover:bg-subtitle/10"
          }`}
          title={org.is_active ? "Desactivar" : "Activar"}
        >
          {org.is_active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
        </button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-40">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="text-sm font-bold text-subtitle/40 uppercase tracking-widest">Sincronizando organizaciones...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-40 text-center">
        <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-title mb-2">Error de conexión</h3>
        <p className="text-subtitle/60 text-sm mb-6 max-w-xs">No pudimos cargar la lista de organizaciones maestras.</p>
        <button 
          onClick={() => refetch()}
          className="px-6 py-3 bg-title text-white rounded-2xl font-bold text-sm shadow-xl shadow-title/20 active:scale-95 transition-all"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <ModuleContainer>
      <ModuleHeader
        title={t.sidebar.organizations}
        description="Gestión multitenant de la plataforma Recall"
        icon={Building2}
        action={{
          label: "Nueva Organización",
          icon: Plus,
          onClick: () => setIsModalOpen(true),
        }}
      />

      <div className="bg-surface rounded-figma shadow-soft border border-border-theme/40 overflow-hidden mt-6">
        <DataTable
          data={organizations}
          columns={columns}
          keyExtractor={(org) => org.id}
          emptyMessage="No hay organizaciones registradas."
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Crear Organización"
      >
        <OrganizationForm 
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }} 
        />
      </Modal>
    </ModuleContainer>
  );
}
