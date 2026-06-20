"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { AlertTriangle } from "lucide-react";

interface DeletedBadgeProps {
  name?: string;
  className?: string;
}

export default function DeletedBadge({ name, className = "" }: DeletedBadgeProps) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold text-warning ${className}`}>
      <AlertTriangle className="w-3 h-3" />
      {name ? (
        <span>
          <span className="line-through opacity-60">{name}</span>
          <span className="ml-1 text-[10px] opacity-80">({t.trash.deleted_badge})</span>
        </span>
      ) : (
        <span>{t.trash.deleted_badge}</span>
      )}
    </span>
  );
}
