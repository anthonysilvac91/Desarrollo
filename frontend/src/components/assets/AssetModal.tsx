"use client";

import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Combobox from "@/components/ui/Combobox";
import { Camera, Ship, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsService } from "@/services/assets.service";
import { useToast } from "@/lib/ToastContext";
import { companiesService } from "@/services/companies.service";
import { useAuth } from "@/lib/AuthContext";

export interface AssetFormData {
  name: string;
  company_id: string;
  location: string;
  photo: File | null;
}

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset?: any | null; // El activo a editar (si existe)
}

export default function AssetModal({ isOpen, onClose, asset, onSuccess }: AssetModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company_id: "",
    location: "",
    photo: null as File | null,
  });

  const queryClient = useQueryClient();

  const handleQuickCreateCompany = async (name: string) => {
    try {
      setLoading(true);
      const newCompany = await companiesService.create({ name });
      
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setFormData(prev => ({ ...prev, company_id: newCompany.id }));
      showToast("Empresa creada", "success");
    } catch (error) {
      console.error(error);
      showToast("Error al crear empresa", "error");
    } finally {
      setLoading(false);
    }
  };

  const [preview, setPreview] = useState<string | null>(null);

  // Fetch real companies from the database
  const { data: companiesData = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesService.findAll(),
    enabled: isOpen
  });
  
  const companies = Array.isArray(companiesData) ? companiesData : companiesData.data || [];

  // Hydrate form when editing
  React.useEffect(() => {
    if (isOpen && asset) {
      setFormData({
        name: asset.name || "",
        company_id: asset.company?.id || asset.customer?.id || "",
        location: asset.location || "",
        photo: null,
      });
      setPreview(asset.thumbnail_url || null);
    } else if (isOpen && !asset) {
      // Reset form if opening for creation
      setFormData({ name: "", company_id: "", location: "", photo: null });
      setPreview(null);
    }
  }, [isOpen, asset]);

  const companyOptions = companies.map((c: any) => ({ id: c.id, name: c.name }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, photo: file });
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      showToast("El nombre es obligatorio", "error");
      return;
    }

    try {
      setLoading(true);

      const data = new FormData();
      data.append("name", formData.name);
      data.append("location", formData.location);
      
      if (formData.company_id && formData.company_id !== "") {
        data.append("customer_id", formData.company_id);
      }

      if (formData.photo) {
        data.append("photo", formData.photo);
      }

      console.log('📤 Enviando barco:', { 
        name: formData.name, 
        company_id: formData.company_id 
      });

      if (asset?.id) {
        // Modo Edición
        await assetsService.update(asset.id, data);
        showToast(t.feedback?.save_success || "Cambios guardados", "success");
      } else {
        // Modo Creación
        await assetsService.create(data);
        showToast(t.feedback?.save_success || "Embarcación creada", "success");
      }

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({ name: "", company_id: "", location: "", photo: null });
      setPreview(null);
    } catch (err) {
      console.error(err);
      showToast(t.feedback.generic_error, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={asset ? "Editar Embarcación" : t.assets.add_new}>
      <div className="flex flex-col space-y-8 mt-2">
        {/* Photo Upload Area */}
        <div className="flex justify-center">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[32px] bg-gray-50 border-2 border-dashed border-border-theme flex items-center justify-center overflow-hidden transition-all group-hover:border-brand/40 group-hover:bg-brand/5">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-subtitle/30">
                  <Ship className="w-10 h-10 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Photo</span>
                </div>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 bg-brand text-white p-3 rounded-2xl shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all">
              <Camera className="w-5 h-5" />
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Asset Name */}
          <div className="flex flex-col space-y-2">
            <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
              Nombre de la embarcación
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
              placeholder="Ej. Black Pearl"
            />
          </div>

          {/* Client (Combobox) */}
          <Combobox
            label="Empresa"
            options={companyOptions}
            value={formData.company_id}
            onChange={(val) => setFormData({ ...formData, company_id: val })}
            placeholder="Selecciona una empresa..."
            onCreate={
              (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") 
                ? handleQuickCreateCompany 
                : undefined
            }
          />

          {/* Location */}
          <div className="flex flex-col space-y-2">
            <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
              {t.assets.table.location}
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
              placeholder="Ej. Marina Ibiza, Pantalán 5"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center space-x-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-4 px-6 rounded-2xl text-sm font-bold text-subtitle hover:bg-gray-100 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !formData.name}
            className="flex-[2] py-4 px-6 rounded-2xl text-sm font-black text-white bg-brand shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>{asset ? "Guardar Cambios" : "Crear Embarcación"}</span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
