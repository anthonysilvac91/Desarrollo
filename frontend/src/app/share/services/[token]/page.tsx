"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Camera, Download, FileText, Loader2, MapPin, UserRound } from "lucide-react";
import { servicesService } from "@/services/services.service";
import { formatDate } from "@/lib/formatDate";

function fileNameFromUrl(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").filter(Boolean).pop();
    return name || fallback;
  } catch {
    return fallback;
  }
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
  const imageAttachments = useMemo(
    () => (service?.attachments ?? []).filter((item) => item.file_url && item.file_type?.startsWith("image/")),
    [service?.attachments],
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-app-bg flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-brand">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-black uppercase tracking-widest">Cargando servicio</span>
        </div>
      </main>
    );
  }

  if (isError || !service) {
    return (
      <main className="min-h-screen bg-app-bg flex items-center justify-center px-6">
        <section className="max-w-md text-center">
          <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-error/10 flex items-center justify-center">
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
    <main className="min-h-screen bg-app-bg text-title">
      <section className="border-b border-border-theme bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            {service.organization?.logo_url ? (
              <img
                src={service.organization.logo_url}
                alt=""
                className="h-11 w-11 rounded-xl object-cover border border-border-theme"
              />
            ) : (
              <div className="h-11 w-11 rounded-xl bg-brand/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-subtitle/50">
                Servicio compartido
              </p>
              <p className="font-black text-title truncate">
                {service.organization?.name ?? "Recall"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <section className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-brand">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(service.created_at)}
            </span>
            {service.worker?.name && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-subtitle border border-border-theme">
                <UserRound className="w-3.5 h-3.5" />
                {service.worker.name}
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-normal text-title mb-4">
            {service.title}
          </h1>

          {service.description && (
            <p className="max-w-3xl whitespace-pre-wrap text-base leading-relaxed text-subtitle">
              {service.description}
            </p>
          )}
        </section>

        <section className="mb-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface border border-border-theme p-5">
            <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-subtitle/45">Activo</p>
            <p className="text-lg font-black text-title">{service.asset?.name ?? "Sin activo"}</p>
            {service.asset?.location && (
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-subtitle">
                <MapPin className="w-4 h-4 text-brand" />
                {service.asset.location}
              </p>
            )}
          </div>
          <div className="rounded-2xl bg-surface border border-border-theme p-5">
            <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-subtitle/45">Evidencia</p>
            <p className="text-lg font-black text-title">
              {imageAttachments.length} {imageAttachments.length === 1 ? "foto" : "fotos"}
            </p>
            <p className="mt-2 text-sm font-medium text-subtitle">
              {data.allow_downloads ? "Descarga disponible" : "Descarga desactivada"}
            </p>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-subtitle/55">Galeria</h2>
          </div>

          {imageAttachments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {imageAttachments.map((attachment, index) => {
                const url = attachment.file_url ?? "";
                const fallbackName = `servicio-${service.id}-foto-${index + 1}.webp`;
                const downloadName = attachment.file_name || fileNameFromUrl(url, fallbackName);

                return (
                  <figure key={`${url}-${index}`} className="overflow-hidden rounded-2xl border border-border-theme bg-surface">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-app-bg">
                      <img src={url} alt={`Evidencia ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                    <figcaption className="flex items-center justify-between gap-3 p-3">
                      <span className="text-xs font-black text-subtitle/60">
                        Foto {index + 1}
                      </span>
                      {data.allow_downloads && (
                        <a
                          href={url}
                          download={downloadName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white active:scale-95 transition-transform"
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
            <div className="rounded-2xl border border-border-theme bg-surface px-5 py-12 text-center text-subtitle/45">
              <Camera className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm font-black uppercase tracking-widest">Sin fotos adjuntas</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
