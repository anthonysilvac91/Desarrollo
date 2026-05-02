"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { organizationsService } from "@/services/organizations.service";
import { useToast } from "@/lib/ToastContext";
import { Loader2 } from "lucide-react";

const OrgSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  slug: z
    .string()
    .min(3, "El slug debe tener al menos 3 caracteres")
    .regex(/^[a-z0-9-]+$/, "Solo minusculas, numeros y guiones"),
  admin_email: z.string().email("Correo de administrador invalido"),
});

type OrgFormData = z.infer<typeof OrgSchema>;

interface OrganizationFormProps {
  onSuccess: () => void;
}

export default function OrganizationForm({ onSuccess }: OrganizationFormProps) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await organizationsService.create(data);
      showToast("Organizacion creada exitosamente", "success");
      reset();
      onSuccess();
    } catch (error: unknown) {
      console.error("Error creating org:", error);
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "No se pudo crear la organizacion";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
      <div className="space-y-2">
        <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
          Nombre de la Organizacion
        </label>
        <Input
          {...register("name")}
          placeholder="Ej: Oceanic Yachts"
          error={errors.name?.message}
          className="h-14 px-5 rounded-2xl bg-app-bg border-none font-bold"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
          Slug (URL)
        </label>
        <Input
          {...register("slug")}
          placeholder="oceanic-yachts"
          error={errors.slug?.message}
          className="h-14 px-5 rounded-2xl bg-app-bg border-none font-bold"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-widest ml-1">
          Email del Administrador
        </label>
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
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Crear Organizacion"}
        </Button>
      </div>
    </form>
  );
}
