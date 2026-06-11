"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  Camera,
  Download,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { servicesService } from "@/services/services.service";
import { formatDate } from "@/lib/formatDate";

const PALETTE_COLORS: Record<string, string> = {
  recall: "#0058BC",
  ocean: "#06b6d4",
  teal: "#14b8a6",
  forest: "#10b981",
  amber: "#f59e0b",
  orange: "#f97316",
  rose: "#f43f5e",
  pink: "#ec4899",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  slate: "#64748b",
};

function fileNameFromUrl(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").filter(Boolean).pop();
    return name || fallback;
  } catch {
    return fallback;
  }
}

function resolveBrandColor(color?: string | null) {
  if (!color) return undefined;
  return PALETTE_COLORS[color] || color;
}

export default function SharedServicePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-service-share", token],
    queryFn: () => servicesService.findPublicShare(token),
    enabled: !!token,
    retry: false,
  });

  const service = data?.service;
  const brandColor = resolveBrandColor(service?.organization?.brand_color);
  const imageAttachments = useMemo(
    () => (service?.attachments ?? []).filter((item) => item.file_url && item.file_type?.startsWith("image/")),
    [service?.attachments],
  );
  const coverImage = imageAttachments[0]?.file_url ?? service?.asset?.thumbnail_url ?? null;

  if (isLoading) {
    return (
      <main className="min-h-screen bg-app-bg flex items-center justify-center px-6">
        <div className="rounded-3xl bg-surface px-6 py-5 shadow-soft border border-border-theme/50 flex items-center gap-3 text-brand">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-black uppercase tracking-widest">Cargando servicio</span>
        </div>
      </main>
    );
  }

  if (isError || !service) {
    return (
      <main className="min-h-screen bg-app-bg flex items-center justify-center px-6">
        <section className="max-w-md text-center rounded-[32px] bg-surface border border-border-theme/50 px-7 py-10 shadow-soft">
          <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-error/10 flex items-center justify-center">
            <FileText className="w-7 h-7 text-error" />
          </div>
          <h1 className="text-2xl font-black text-title mb-2">Link no disponible</h1>
          <p className="text-sm text-subtitle leading-relaxed">
            El enlace puede haber expirado, estar desactivado o no existir.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-app-bg text-title"
      style={brandColor ? ({ "--theme-primary": brandColor } as CSSProperties) : undefined}
    >
      <section className="bg-surface border-b border-border-theme/60">
        <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {service.organization?.logo_url ? (
                <img
                  src={service.organization.logo_url}
                  alt=""
                  className="h-12 w-12 rounded-2xl object-cover border border-border-theme/70 bg-white"
                />
              ) : (
                <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-brand" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-subtitle/45">
                  Servicio compartido
                </p>
                <p className="truncate text-base font-black text-title">
                  {service.organization?.name ?? "Recall"}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-brand">
              <ShieldCheck className="w-3.5 h-3.5" />
              Solo lectura
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="overflow-hidden rounded-[32px] border border-border-theme/50 bg-surface shadow-soft">
            <div className="relative aspect-[4/3] min-h-80 bg-title">
              {coverImage ? (
                <img src={coverImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand/10">
                  <Camera className="h-12 w-12 text-brand/50" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/25 to-transparent p-5 sm:p-7">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-brand">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(service.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white ring-1 ring-white/20">
                    <Camera className="w-3.5 h-3.5" />
                    {imageAttachments.length} {imageAttachments.length === 1 ? "foto" : "fotos"}
                  </span>
                </div>
                <h1 className="max-w-3xl text-3xl font-black tracking-normal text-white sm:text-5xl">
                  {service.title}
                </h1>
              </div>
            </div>
          </div>

          <aside className="rounded-[32px] border border-border-theme/50 bg-surface p-5 shadow-soft sm:p-6">
            <div className="mb-5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-subtitle/45">
                Resumen
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-subtitle">
                {service.description || "Sin descripcion registrada."}
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl bg-app-bg/70 border border-border-theme/50 p-4">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-subtitle/45">Activo</p>
                <p className="text-base font-black text-title">{service.asset?.name ?? "Sin activo"}</p>
                {service.asset?.location && (
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-subtitle">
                    <MapPin className="w-4 h-4 text-brand" />
                    {service.asset.location}
                  </p>
                )}
              </div>

              {service.worker?.name && (
                <div className="rounded-2xl bg-app-bg/70 border border-border-theme/50 p-4">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-subtitle/45">Responsable</p>
                  <p className="flex items-center gap-2 text-base font-black text-title">
                    <UserRound className="w-4 h-4 text-brand" />
                    {service.worker.name}
                  </p>
                </div>
              )}

              <div className="rounded-2xl bg-brand/10 border border-brand/20 p-4">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-brand/70">Descargas</p>
                <p className="text-sm font-bold text-title">
                  {data.allow_downloads
                    ? "Las fotos se pueden descargar individualmente."
                    : "La descarga de fotos esta desactivada."}
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-subtitle/45">Evidencia visual</p>
              <h2 className="text-2xl font-black text-title">Galeria del servicio</h2>
            </div>
          </div>

          {imageAttachments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {imageAttachments.map((attachment, index) => {
                const url = attachment.file_url ?? "";
                const fallbackName = `servicio-${service.id}-foto-${index + 1}.webp`;
                const downloadName = attachment.file_name || fileNameFromUrl(url, fallbackName);

                return (
                  <figure
                    key={`${url}-${index}`}
                    className="group overflow-hidden rounded-[28px] border border-border-theme/50 bg-surface shadow-soft"
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-app-bg overflow-hidden">
                      <img
                        src={url}
                        alt={`Evidencia ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </a>
                    <figcaption className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-title">Foto {index + 1}</p>
                        <p className="truncate text-xs font-semibold text-subtitle/50">{downloadName}</p>
                      </div>
                      {data.allow_downloads && (
                        <a
                          href={url}
                          download={downloadName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/20 active:scale-95 transition-transform"
                          aria-label={`Descargar foto ${index + 1}`}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-border-theme bg-surface px-5 py-14 text-center text-subtitle/45">
              <Camera className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm font-black uppercase tracking-widest">Sin fotos adjuntas</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
