"use client";

import { useState } from "react";

interface TranslatedDescriptionProps {
  description?: string | null;
  originalDescription?: string | null;
  isTranslated?: boolean;
  emptyText: string;
  className?: string;
  clampClassName?: string;
}

export function TranslatedDescription({
  description,
  originalDescription,
  isTranslated,
  emptyText,
  className,
  clampClassName,
}: TranslatedDescriptionProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const text = showOriginal ? originalDescription : description;

  return (
    <div className="space-y-2">
      <p className={`${className ?? ""} ${clampClassName ?? ""}`}>
        {text || <span className="italic text-subtitle/30">{emptyText}</span>}
      </p>
      {isTranslated && originalDescription && originalDescription !== description && (
        <button
          type="button"
          onClick={() => setShowOriginal((value) => !value)}
          className="text-[10px] font-black uppercase tracking-widest text-brand hover:text-brand/70 transition-colors"
        >
          {showOriginal ? "Ver traduccion" : "Ver original"}
        </button>
      )}
    </div>
  );
}
