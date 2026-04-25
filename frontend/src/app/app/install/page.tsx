"use client";

import React from "react";
import { Download, Share, PlusSquare, Ship } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function InstallAppPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen w-full bg-brand flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="w-20 h-20 bg-white/10 rounded-[28px] flex items-center justify-center mb-8 backdrop-blur-md shadow-2xl">
        <Ship className="w-10 h-10 text-white stroke-[2px]" />
      </div>

      <h1 className="text-3xl font-black tracking-tight mb-4">
        Instala la App
      </h1>
      
      <p className="text-white/80 font-medium mb-12 max-w-[280px] leading-relaxed">
        Para acceder a tu área de trabajo, debes instalar esta aplicación en tu teléfono.
      </p>

      <div className="w-full max-w-[320px] bg-white/10 backdrop-blur-md rounded-3xl p-6 mb-8 text-left space-y-6">
        <div className="flex items-start space-x-4">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Share className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Paso 1</p>
            <p className="text-white/70 text-xs mt-1">Toca el botón de Compartir en tu navegador (safari o chrome).</p>
          </div>
        </div>

        <div className="flex items-start space-x-4">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <PlusSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Paso 2</p>
            <p className="text-white/70 text-xs mt-1">Selecciona la opción "Añadir a la pantalla de inicio".</p>
          </div>
        </div>

        <div className="flex items-start space-x-4">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Download className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Paso 3</p>
            <p className="text-white/70 text-xs mt-1">Abre la app desde tu pantalla de inicio para continuar.</p>
          </div>
        </div>
      </div>

      <button 
        onClick={logout}
        className="text-white/50 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
