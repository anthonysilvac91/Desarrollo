"use client";

import React, { useState } from "react";
import { Calendar, Camera, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/formatDate";

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

const Thumbnail = ({ src }: { src?: string | null }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className="w-full h-full bg-gray-50 flex items-center justify-center border border-gray-100 rounded-lg">
        <Camera className="w-5 h-5 text-subtitle/20" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Evidencia"
      className="w-full h-full object-cover rounded-lg"
      onError={() => setError(true)}
    />
  );
};

export interface ServiceForCard {
  id?: string;
  title: string;
  description?: string | null;
  created_at: string;
  worker?: { name: string } | null;
  asset?: { owner?: { id?: string; name: string } | null } | null;
  attachments?: { file_url?: string | null }[];
}

interface ServiceHistoryCardProps {
  service: ServiceForCard;
  /** "worker" muestra el nombre del operador; "owner" muestra el owner del activo */
  secondaryBadge: "worker" | "owner";
  viewDetailsLabel: string;
  onViewDetails: () => void;
}

export default function ServiceHistoryCard({
  service,
  secondaryBadge,
  viewDetailsLabel,
  onViewDetails,
}: ServiceHistoryCardProps) {
  const badgeName =
    secondaryBadge === "worker"
      ? service.worker?.name
      : service.asset?.owner?.name;

  return (
    <div className="group bg-surface border border-border-theme/40 rounded-2xl hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 transition-all min-h-35 flex flex-col overflow-hidden">
      <div className="p-5 flex flex-1 flex-col">
        {/* Badges: fecha + badge secundario */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="bg-brand/10 px-3 py-1 rounded-full flex shrink-0 items-center">
            <Calendar className="w-3 h-3 text-brand mr-2" />
            <span className="text-[10px] font-black text-brand uppercase tracking-wider">
              {formatDate(service.created_at)}
            </span>
          </div>
          {badgeName && (
            <div className="bg-app-bg px-3 py-1 rounded-full flex min-w-0 max-w-[52%] items-center border border-border-theme/40">
              <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[7px] font-black text-brand">
                {getInitials(badgeName)}
              </span>
              <span className="truncate text-[10px] font-black text-subtitle/60 uppercase tracking-wider">
                {badgeName}
              </span>
            </div>
          )}
        </div>

        {/* Título */}
        <button
          type="button"
          onClick={onViewDetails}
          className="mb-2 block w-full truncate text-left text-base font-bold text-title transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:text-brand cursor-pointer"
        >
          {service.title}
        </button>

        {/* Descripción (2 líneas) */}
        <p className="text-sm text-subtitle/70 leading-relaxed mb-4 font-medium whitespace-pre-wrap overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
          {service.description}
        </p>

        {/* Thumbnails de adjuntos */}
        {service.attachments && service.attachments.length > 0 && (
          <div className="flex items-center gap-2.5 mt-auto">
            {service.attachments.slice(0, 4).map((att, idx) => (
              <button
                key={idx}
                type="button"
                onClick={onViewDetails}
                className="w-12 h-12 rounded-lg border border-border-theme/20 overflow-hidden shadow-sm hover:scale-110 transition-transform bg-white"
                aria-label={`${viewDetailsLabel}: ${service.title}`}
              >
                <Thumbnail src={att.file_url} />
              </button>
            ))}
            {service.attachments.length > 4 && (
              <div className="text-[10px] font-black text-subtitle opacity-30">
                +{service.attachments.length - 4}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botón Ver detalles */}
      <button
        type="button"
        onClick={onViewDetails}
        className="flex min-h-13 w-full items-center justify-between border-t border-border-theme/30 px-5 py-3 text-brand transition-all hover:bg-brand/5 active:bg-brand/10 cursor-pointer"
      >
        <span className="text-sm font-black">{viewDetailsLabel}</span>
        <ChevronRight className="w-5 h-5 shrink-0" />
      </button>
    </div>
  );
}
