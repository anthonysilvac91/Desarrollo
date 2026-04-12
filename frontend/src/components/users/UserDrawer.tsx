"use client";

import React from "react";
import { X, Mail, Building2, Shield, Clock, MapPin, User as UserIcon, Calendar, Key } from "lucide-react";

interface UserDisplay {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  status: "Active" | "Inactive";
  last_access: string;
}

interface UserDrawerProps {
  user: UserDisplay | null;
  onClose: () => void;
}

export default function UserDrawer({ user, onClose }: UserDrawerProps) {
  if (!user) return null;

  const initials = user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const isActive = user.status === "Active";

  return (
    <>
      <div 
        className={`fixed inset-0 bg-title/20 backdrop-blur-sm z-[110] transition-opacity duration-500 ${user ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      
      <div className={`fixed inset-y-0 right-0 w-full max-w-[500px] bg-white shadow-2xl z-[120] transform transition-transform duration-500 ease-out flex flex-col ${user ? "translate-x-0" : "translate-x-full"}`}>
        
        {/* Close Button Overlay */}
        <button 
          onClick={onClose}
          className="absolute top-6 left-[-60px] w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-title hover:text-brand transition-all invisible lg:visible"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header Section */}
        <div className="p-10 pb-8 flex flex-col items-center text-center space-y-5 bg-gradient-to-b from-gray-50/50 to-white pt-24 border-b border-gray-50 relative">
          
          {/* Mobile Close Button */}
          <button 
            onClick={onClose} 
            className="absolute top-8 right-8 p-2 text-subtitle/20 hover:text-title transition-colors lg:hidden"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl bg-brand/5 flex items-center justify-center relative ring-1 ring-border-theme/20">
             <span className="text-3xl font-black text-brand tracking-tighter">{initials}</span>
             <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
          </div>
          <div className="flex flex-col space-y-1">
            <h2 className="text-3xl font-black text-title tracking-tight">{user.name}</h2>
            <div className="flex items-center justify-center text-brand font-black text-sm uppercase tracking-[0.2em]">
              <Shield className="w-3.5 h-3.5 mr-2" />
              {user.role}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="px-10 py-8 grid grid-cols-1 gap-6 flex-1 overflow-y-auto">
          
          <div className="space-y-6">
            <h3 className="text-[11px] font-black text-subtitle opacity-30 uppercase tracking-[0.2em] mb-4">Información de contacto</h3>
            
            <div className="flex items-center space-x-5 p-5 bg-gray-50/50 rounded-3xl border border-gray-100/50 group hover:border-brand/20 transition-all">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-subtitle/40 group-hover:text-brand transition-colors">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest block mb-0.5">Email Corporativo</span>
                <span className="text-[15px] font-bold text-title">{user.email}</span>
              </div>
            </div>

            <div className="flex items-center space-x-5 p-5 bg-gray-50/50 rounded-3xl border border-gray-100/50 group hover:border-brand/20 transition-all">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-subtitle/40 group-hover:text-brand transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest block mb-0.5">Empresa / Origen</span>
                <span className="text-[15px] font-bold text-title">{user.company}</span>
              </div>
            </div>

            <div className="flex items-center space-x-5 p-5 bg-gray-50/50 rounded-3xl border border-gray-100/50 group hover:border-brand/20 transition-all">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-subtitle/40 group-hover:text-brand transition-colors">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-subtitle opacity-40 uppercase tracking-widest block mb-0.5">Último Acceso Registrado</span>
                <span className="text-[15px] font-bold text-title">{user.last_access}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-gray-50 bg-gray-50/30">
          <button className="w-full py-5 bg-white border border-border-theme/40 text-brand rounded-[20px] text-sm font-black shadow-sm hover:bg-brand hover:text-white hover:border-brand transition-all active:scale-[0.98] flex items-center justify-center space-x-3">
            <Key className="w-4 h-4" />
            <span>Restablecer Contraseña</span>
          </button>
        </div>

      </div>
    </>
  );
}
