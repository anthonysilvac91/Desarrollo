"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobsService } from "@/services/jobs.service";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function EditJobPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const jobId = Array.isArray(id) ? id[0] : id;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    is_public: false,
    archived: false,
  });

  const { data: job, isLoading } = useQuery({
    queryKey: ["jobs", jobId],
    queryFn: () => jobsService.findOne(jobId),
  });

  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || "",
        description: job.description || "",
        is_public: job.is_public ?? false,
        archived: job.archived ?? false,
      });
    }
  }, [job]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => jobsService.update(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      router.push("/admin/jobs");
    },
  });

  if (isLoading) return <div>Cargando detalles...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/jobs" className="text-gray-500 hover:text-gray-900">
          &larr; Volver
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Editar Trabajo</h1>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <form 
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(formData);
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <Input 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              className="w-full flex min-h-[100px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="is_public"
              checked={formData.is_public}
              onChange={(e) => setFormData({...formData, is_public: e.target.checked})}
              className="w-4 h-4 text-gray-900 rounded focus:ring-gray-900"
            />
            <label htmlFor="is_public" className="text-sm font-medium text-gray-700">Público</label>
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="archived"
              checked={formData.archived}
              onChange={(e) => setFormData({...formData, archived: e.target.checked})}
              className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
            />
            <label htmlFor="archived" className="text-sm font-medium text-red-600">Archivado</label>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => router.push("/admin/jobs")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
