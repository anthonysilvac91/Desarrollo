"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { organizationsService } from "@/services/organizations.service";
import { useToast } from "@/lib/ToastContext";
import { Loader2, Check } from "lucide-react";

const OrgSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  slug: z.string().min(3, "El slug debe tener al menos 3 caracteres").regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  admin_email: z.string().email("Correo de administrador inválido"),
});

type OrgFormData = z.infer<typeof OrgSchema>;

interface OrganizationFormProps {
  onSuccess: () => void;
}

export default function OrganizationForm({ onSuccess }: OrganizationFormProps) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<OrgFormData>({
    resolver: zodResolver(OrgSchema),
  });

  const onSubmit = async (data: OrgFormData) => {
    setIsSubmitting(true);
    try {
      const response = await organizationsService.create(data);
      showToast("Organización creada exitosamente", "success");
      setInvitationToken(response.initial_invitation_token || null);
      // No cerramos inmediatamente para que el Maestro vea el token generado
    } catch (error: any) {
      console.error("Error creating org:", error);
      const message = error.response?.data?.message || "No se pudo crear la organización";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (invitationToken) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mb-6">
          <Check className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-title mb-2">Organización Creada</h3>
        <p className="text-subtitle/60 text-sm mb-6 max-w-xs">
          Comparte este token con el administrador inicial para que complete su registro:
        </p>
        <div className="w-full bg-app-bg p-4 rounded-2xl border border-dashed border-brand/40 font-mono text-sm break-all mb-8 select-all">
          {invitationToken}
        </div>
        <Button onClick={onSuccess} className="w-full py-4 rounded-2xl font-black uppercase tracking-widest h-auto">
          Finalizar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
      <div className="space-y-2">
        <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">Nombre de la Organización</label>
        <Input 
          {...register("name")} 
          placeholder="Ej: Oceanic Yachts" 
          error={errors.name?.message}
          className="h-14 px-5 rounded-2xl bg-app-bg border-none font-bold"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">Slug (URL)</label>
        <Input 
          {...register("slug")} 
          placeholder="oceanic-yachts" 
          error={errors.slug?.message}
          className="h-14 px-5 rounded-2xl bg-app-bg border-none font-bold"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">Email del Administrador</label>
        <Input 
          {...register("admin_email")} 
          placeholder="admin@empresa.com" 
          error={errors.admin_email?.message}
          className="h-14 px-5 rounded-2xl bg-app-bg border-none font-bold"
        />
      </div>

      <div className="pt-4">
        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className="w-full py-5 rounded-2xl h-auto font-black uppercase tracking-widest shadow-xl shadow-brand/20"
        >
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Crear Organización"}
        </Button>
      </div>
    </form>
  );
}
