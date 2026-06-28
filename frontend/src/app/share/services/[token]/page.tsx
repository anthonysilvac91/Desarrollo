"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Archive, Calendar, Camera, Download, FileDown, FileText, Loader2 } from "lucide-react";
import { servicesService } from "@/services/services.service";
import { formatDate } from "@/lib/formatDate";
import AssetIcon from "@/components/ui/AssetIcon";
import { useLanguage } from "@/lib/LanguageContext";
import { TranslatedDescription } from "@/components/services/TranslatedDescription";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");

function fileNameFromUrl(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").filter(Boolean).pop();
    return name || fallback;
  } catch {
    return fallback;
  }
}

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");

export default function SharedServicePage() {
  const params = useParams<{ token: string }>();
  const { language } = useLanguage();
  const token = params.token;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-service-share", token, language],
    queryFn: () => servicesService.findPublicShare(token, language),
    enabled: !!token,
    retry: false,
  });

  const service = data?.service;
  const imageAttachments = useMemo(
    () => (service?.attachments ?? []).filter((item) => item.file_url && item.file_type?.startsWith("image/")),
    [service?.attachments],
  );
  const photosZipUrl = `${apiBaseUrl}/public/service-shares/${token}/photos.zip`;
  const reportPdfUrl = `${apiBaseUrl}/public/service-shares/${token}/report.pdf`;

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
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-8 sm:py-7">
          <div className="flex items-center gap-4">
            {service.organization?.logo_url ? (
              <img
                src={service.organization.logo_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-2xl object-cover border border-border-theme shadow-sm sm:h-20 sm:w-20"
              />
            ) : (
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-brand/10 flex items-center justify-center border border-brand/10 sm:h-20 sm:w-20">
                <FileText className="w-7 h-7 text-brand" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xl font-black text-title truncate sm:text-3xl">
                {service.organization?.name ?? "Fentri"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        <section className="mb-7 sm:mb-8">
          <div className="mb-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
            {service.asset?.thumbnail_url ? (
              <img
                src={service.asset.thumbnail_url}
                alt=""
                className="h-28 w-28 shrink-0 rounded-full border-4 border-white object-cover shadow-xl ring-1 ring-border-theme/20 sm:h-32 sm:w-32"
              />
            ) : (
              <div className="h-28 w-28 shrink-0 rounded-full border-4 border-white bg-gray-50 shadow-xl ring-1 ring-border-theme/20 flex items-center justify-center sm:h-32 sm:w-32">
                <AssetIcon
                  iconId={service.organization?.default_asset_icon}
                  className="h-12 w-12 text-brand sm:h-14 sm:w-14"
                  strokeWidth={1.5}
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 sm:order-2 lg:order-none">
                  <div className="mb-3 hidden flex-wrap items-center justify-center gap-1.5 sm:flex sm:justify-start sm:gap-2">
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand/10 px-3 text-[11px] font-black uppercase tracking-wider text-brand">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(service.created_at)}
                    </span>
                    {service.worker?.name && (
                      <span className="inline-flex h-8 items-center gap-2 bg-brand/10 border border-brand/20 rounded-full pl-1 pr-2.5">
                        <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-black text-white">
                            {getInitials(service.worker.name)}
                          </span>
                        </span>
                        <span className="max-w-32 truncate text-xs font-bold text-brand">
                          {service.worker.name}
                        </span>
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-black leading-tight tracking-normal text-title [overflow-wrap:anywhere] sm:text-4xl">
                    {service.title}
                  </h1>
                  <p className="mt-1.5 truncate text-xs font-black uppercase tracking-[0.16em] text-brand sm:mt-2 sm:text-base sm:tracking-[0.2em]">
                    {service.asset?.name ?? "Sin activo"}
                  </p>
                </div>
                <div className="mx-auto grid w-full max-w-xs grid-cols-2 gap-2 sm:order-3 sm:mx-0 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap lg:order-none">
                  <a
                    href={data.allow_downloads ? photosZipUrl : undefined}
                    aria-disabled={!data.allow_downloads}
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-center text-[9px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 sm:min-h-11 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs ${
                      data.allow_downloads
                        ? "bg-title text-white hover:bg-title/90"
                        : "pointer-events-none bg-subtitle/10 text-subtitle/35"
                    }`}
                  >
                    <Archive className="h-4 w-4" />
                    Fotos ZIP
                  </a>
                  <a
                    href={reportPdfUrl}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-brand/20 bg-brand px-2.5 py-2.5 text-center text-[9px] font-black uppercase tracking-wider text-white shadow-sm shadow-brand/15 transition-all hover:bg-brand/90 active:scale-95 sm:min-h-11 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs"
                  >
                    <FileDown className="h-4 w-4" />
                    Reporte PDF
                  </a>
                </div>
                <div className="order-last flex flex-wrap items-center justify-center gap-1.5 sm:hidden">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand/10 px-2.5 text-[10px] font-black uppercase tracking-wider text-brand">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(service.created_at)}
                  </span>
                  {service.worker?.name && (
                    <span className="inline-flex h-8 items-center gap-2 bg-brand/10 border border-brand/20 rounded-full pl-1 pr-2.5">
                      <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-black text-white">
                          {getInitials(service.worker.name)}
                        </span>
                      </span>
                      <span className="max-w-28 truncate text-xs font-bold text-brand">
                        {service.worker.name}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {service.description && (
            <div className="max-w-3xl">
              <TranslatedDescription
                description={service.description}
                originalDescription={service.original_description}
                isTranslated={service.is_translated}
                emptyText="Sin descripcion"
                className="whitespace-pre-wrap text-sm leading-relaxed text-subtitle sm:text-base"
              />
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-subtitle/55">Galeria</h2>
          </div>

          {imageAttachments.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {imageAttachments.map((attachment, index) => {
                const url = attachment.file_url ?? "";
                const fallbackName = `servicio-${service.id}-foto-${index + 1}.webp`;
                const downloadName = attachment.file_name || fileNameFromUrl(url, fallbackName);

                return (
                  <figure key={`${url}-${index}`} className="overflow-hidden rounded-2xl border border-border-theme bg-surface">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-app-bg sm:aspect-square">
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
