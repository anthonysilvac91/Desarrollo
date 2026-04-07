"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgService } from "@/services/org.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    auto_publish_jobs: false,
    worker_edit_policy: "DISABLED",
    worker_edit_window_hours: 0,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["org-settings"],
    queryFn: orgService.getSettings,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        auto_publish_jobs: settings.auto_publish_jobs ?? false,
        worker_edit_policy: settings.worker_edit_policy ?? "DISABLED",
        worker_edit_window_hours: settings.worker_edit_window_hours ?? 0,
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: orgService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-settings"] });
      alert("Configuración guardada correctamente");
    },
  });

  if (isLoading) return <div>Cargando configuración...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Configuración de Organización</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona las reglas y políticas generales de tu organización.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <form 
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            // Aseguramos que el número se mande como tal
            updateMutation.mutate({
              ...formData,
              worker_edit_window_hours: Number(formData.worker_edit_window_hours)
            });
          }}
        >
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <label htmlFor="auto_publish" className="text-sm font-medium text-gray-900">Autopublicar Trabajos</label>
              <p className="text-sm text-gray-500">Publicar automáticamente los trabajos al crearse.</p>
            </div>
            <input 
              type="checkbox" 
              id="auto_publish"
              checked={formData.auto_publish_jobs}
              onChange={(e) => setFormData({...formData, auto_publish_jobs: e.target.checked})}
              className="w-5 h-5 text-gray-900 rounded focus:ring-gray-900"
            />
          </div>

          <div className="space-y-3 pb-4 border-b border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-900">Política de Edición para Operarios</label>
              <p className="text-sm text-gray-500 mb-2">Permita que los operarios editen el trabajo asignado.</p>
            </div>
            <select
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm rounded-md shadow-sm border bg-white"
              value={formData.worker_edit_policy}
              onChange={(e) => setFormData({...formData, worker_edit_policy: e.target.value})}
            >
              <option value="DISABLED">Deshabilitado (Nunca)</option>
              <option value="ALWAYS">Siempre</option>
              <option value="TIME_WINDOW">Ventana de Tiempo</option>
            </select>
          </div>

          {formData.worker_edit_policy === "TIME_WINDOW" && (
            <div className="space-y-2 pb-4">
              <label className="block text-sm font-medium text-gray-900">Horas de Ventana de Edición</label>
              <Input 
                type="number"
                min="0"
                value={formData.worker_edit_window_hours}
                onChange={(e) => setFormData({...formData, worker_edit_window_hours: e.target.valueAsNumber})}
              />
              <p className="text-sm text-gray-500">
                Horas tras la creación en las que se permite edición.
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
