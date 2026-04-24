"use client";

import React, { useState, useEffect } from "react";
import { X, User, Mail, Phone, MapPin, Loader2, Building2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { usersService } from "@/services/users.service";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (client?: any) => void;
  client?: any | null;
  initialName?: string;
}

export default function ClientModal({ isOpen, onClose, onSuccess, client, initialName }: ClientModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    if (isOpen && client) {
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
      });
    } else if (isOpen) {
      setFormData({ 
        name: initialName || "", 
        email: "", 
        phone: "", 
        address: "" 
      });
    }
  }, [isOpen, client, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalEmail = formData.email || `${formData.name.toLowerCase().replace(/\s+/g, '.')}.${Math.random().toString(36).slice(-4)}@recall.app`;
      
      if (client?.id) {
        // Update existing client
        await usersService.update(client.id, {
          ...formData,
          email: finalEmail
        });
        showToast(t.clients.states.save_success, "success");
        onSuccess({ id: client.id, name: formData.name });
      } else {
        // Create new client (Role CLIENT)
        const newClient = await usersService.create({
          ...formData,
          email: finalEmail,
          role: "CLIENT",
          password: Math.random().toString(36).slice(-8), // Temporary random password
        });
        showToast(t.clients.states.save_success, "success");
        onSuccess(newClient);
      }
      onClose();
    } catch (error) {
      showToast(t.feedback.generic_error, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={client ? t.common.edit : t.clients.modal.title}
    >
      <form onSubmit={handleSubmit} className="flex flex-col space-y-6 mt-2">
        {/* Full Name / Business Name */}
        <div className="flex flex-col space-y-2">
          <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
            {t.clients.modal.full_name}
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-subtitle/30 group-focus-within:text-brand transition-colors">
              <Building2 className="w-5 h-5" />
            </div>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
              placeholder={t.clients.modal.full_name}
            />
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col space-y-2">
          <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
            {t.clients.modal.email}
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-subtitle/30 group-focus-within:text-brand transition-colors">
              <Mail className="w-5 h-5" />
            </div>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
              placeholder="email@ejemplo.com"
            />
          </div>
        </div>

        {/* Phone & Address Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col space-y-2">
            <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
              {t.clients.modal.phone}
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-subtitle/30 group-focus-within:text-brand transition-colors">
                <Phone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
                placeholder="+34 ..."
              />
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
              {t.clients.modal.address}
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-subtitle/30 group-focus-within:text-brand transition-colors">
                <MapPin className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
                placeholder="Pantalán / Localización"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center space-x-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 px-6 rounded-2xl text-sm font-bold text-subtitle hover:bg-gray-100 transition-all"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={loading || !formData.name}
            className="flex-[2] py-4 px-6 rounded-2xl text-sm font-black text-white bg-brand shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>{client ? t.common.save : t.clients.modal.submit}</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
