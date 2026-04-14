"use client";

import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Combobox from "@/components/ui/Combobox";
import { Camera, Ship, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export interface AssetFormData {
  name: string;
  client: string;
  location: string;
  photo: File | null;
}

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AssetFormData) => void;
}

// Mock clients for the combobox
const MOCK_CLIENTS = [
  { id: "1", name: "Roberto García" },
  { id: "2", name: "Elena Martínez" },
  { id: "3", name: "Thomas Müller" },
  { id: "4", name: "Sophie Laurent" },
];

export default function AssetModal({ isOpen, onClose, onSubmit }: AssetModalProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    client: "",
    location: "",
    photo: null as File | null,
  });

  const [preview, setPreview] = useState<string | null>(null);

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
    // Basic validation
    if (!formData.name || !formData.client) return;

    setLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000));
    onSubmit(formData);
    setLoading(false);
    onClose();
    // Reset form
    setFormData({ name: "", client: "", location: "", photo: null });
    setPreview(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.assets.add_new}>
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
              {t.assets.table.asset} Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-5 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
              placeholder="e.g. Blue Horizon"
            />
          </div>

          {/* Client (Combobox) */}
          <Combobox
            label={t.assets.table.client}
            options={MOCK_CLIENTS}
            value={formData.client}
            onChange={(val) => setFormData({ ...formData, client: val })}
            placeholder="Search or type a new client..."
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
              placeholder="e.g. Marina Ibiza, Dock 5"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center space-x-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-4 px-6 rounded-2xl text-sm font-bold text-subtitle hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !formData.name || !formData.client}
            className="flex-[2] py-4 px-6 rounded-2xl text-sm font-black text-white bg-brand shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>Save Asset</span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
