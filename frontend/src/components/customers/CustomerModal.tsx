"use client";

import React, { useState, useEffect } from "react";
import { X, Building2, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { customersService, CustomerFormData } from "@/services/customers.service";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerToEdit?: any;
}

export default function CustomerModal({ isOpen, onClose, onSuccess, customerToEdit }: CustomerModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<CustomerFormData>({
    name: ""
  });

  useEffect(() => {
    if (isOpen) {
      if (customerToEdit) {
        setFormData({
          name: customerToEdit.name || ""
        });
      } else {
        setFormData({ name: "" });
      }
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (customerToEdit) {
        await customersService.update(customerToEdit.id, formData);
        showToast("Empresa actualizada correctamente", "success");
      } else {
        await customersService.create(formData);
        showToast("Empresa creada correctamente", "success");
      }
      onSuccess();
      onClose();
    } catch (error) {
      showToast("Error al guardar la empresa", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-title/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="px-8 pt-10 pb-6 flex justify-between items-center border-b border-gray-50">
          <div>
            <h2 className="text-2xl font-black text-title tracking-tight">
              {customerToEdit ? "Editar Empresa" : "Nueva Empresa"}
            </h2>
            <p className="text-subtitle/50 text-xs font-bold uppercase tracking-widest mt-1">
              Registro de Clientes
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-subtitle transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">
              Nombre de la Empresa
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-brand">
                <Building2 className="h-5 w-5 opacity-30" />
              </div>
              <input
                required
                type="text"
                className="block w-full pl-14 pr-4 py-4 border border-border-theme/40 rounded-2xl bg-app-bg text-title font-bold placeholder:text-subtitle/20 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all text-sm"
                placeholder="Ej. Marina Azul, Servicios Norte..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !formData.name.trim()}
            className="w-full py-5 bg-brand text-white rounded-[20px] text-lg font-black shadow-xl shadow-brand/20 hover:bg-brand/90 hover:scale-[1.01] active:scale-[0.99] transition-all mt-4 flex items-center justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Guardar Empresa"}
          </button>
        </form>
      </div>
    </div>
  );
}
